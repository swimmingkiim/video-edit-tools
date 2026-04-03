import Ffmpeg from 'fluent-ffmpeg';
import { VideoInput, AddSubtitlesOptions, AddSubtitlesStyle, SubtitleEntry, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { ok, err } from '../utils/result.js';
import { generateTmpFilePath, cleanupTmpFile } from '../utils/tmp.js';
import fs from 'node:fs/promises';

function formatTimeCode(t: number | string): string {
    if (typeof t === 'string') return t.replace('.', ',');
    const date = new Date(t * 1000);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * Convert a #RRGGBB hex string to FFmpeg ASS force_style color format (&H00BBGGRR).
 * ASS uses BGR channel order with a leading alpha byte (00 = fully opaque).
 */
function hexToASS(hex: string): string {
    const h = hex.replace('#', '').padEnd(6, '0');
    const r = h.slice(0, 2);
    const g = h.slice(2, 4);
    const b = h.slice(4, 6);
    return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Build the force_style string for FFmpeg's subtitles= filter.
 * Maps AddSubtitlesStyle properties to ASS override parameters.
 */
function buildForceStyle(style: AddSubtitlesStyle): string {
    const parts: string[] = [];

    if (style.fontSize) parts.push(`FontSize=${style.fontSize}`);
    if (style.fontFamily) parts.push(`FontName=${style.fontFamily}`);

    // fontColor takes precedence over legacy color
    const textColor = style.fontColor ?? style.color;
    if (textColor) parts.push(`PrimaryColour=${hexToASS(textColor)}`);

    if (style.outlineColor) parts.push(`OutlineColour=${hexToASS(style.outlineColor)}`);
    if (style.outlineWidth !== undefined) parts.push(`Outline=${style.outlineWidth}`);
    if (style.bold) parts.push('Bold=1');
    if (style.italic) parts.push('Italic=1');
    if (style.alignment !== undefined) parts.push(`Alignment=${style.alignment}`);
    if (style.marginV !== undefined) parts.push(`MarginV=${style.marginV}`);

    if (style.backgroundOpacity !== undefined && style.backgroundOpacity > 0) {
        // BorderStyle=4 = opaque box behind text
        // BackColour alpha: 00 = fully opaque, FF = fully transparent
        const alpha = Math.round((1 - Math.min(1, style.backgroundOpacity)) * 255)
            .toString(16).padStart(2, '0').toUpperCase();
        parts.push('BorderStyle=4');
        parts.push(`BackColour=&H${alpha}000000`);
    }

    // Legacy position mapping → Alignment (overrides explicit alignment if position given)
    if (style.position && style.alignment === undefined) {
        const posMap: Record<string, number> = { bottom: 2, top: 6, center: 5 };
        const al = posMap[style.position];
        if (al) parts.push(`Alignment=${al}`);
    }

    return parts.join(',');
}

export async function addSubtitles(input: VideoInput, options: AddSubtitlesOptions): Promise<Result<Buffer>> {
    const loaded = await loadVideo(input);
    if (!loaded.ok) return loaded;
    const { path: inputPath, cleanup } = loaded.data;

    let srtPath = '';
    let cleanupSrt = async () => {};
    const mode = options.mode ?? 'soft';

    try {
        // 1. Resolve subtitle file path (or generate temp SRT from entries)
        if (typeof options.subtitles === 'string') {
            srtPath = options.subtitles;
        } else {
            srtPath = generateTmpFilePath('srt');
            cleanupSrt = () => cleanupTmpFile(srtPath);
            let srtContent = '';
            options.subtitles.forEach((sub: SubtitleEntry, index: number) => {
                srtContent += `${index + 1}\n`;
                srtContent += `${formatTimeCode(sub.startTime)} --> ${formatTimeCode(sub.endTime)}\n`;
                srtContent += `${sub.text}\n\n`;
            });
            await fs.writeFile(srtPath, srtContent);
        }

        const outputPath = generateTmpFilePath('mp4');

        await new Promise<void>((resolve, reject) => {
            if (mode === 'soft') {
                // ── Soft mode ─────────────────────────────────────────────────────────
                // Embed subtitle as a selectable stream. No video/audio re-encode.
                // Uses mov_text codec (mp4-compatible). Subtitle styling is handled
                // by the player, not by FFmpeg — style options are ignored here.
                Ffmpeg(inputPath)
                    .input(srtPath)
                    .outputOptions([
                        '-c:v copy',
                        '-c:a copy',
                        '-c:s mov_text',
                        '-map 0:v',
                        '-map 0:a?',
                        '-map 1:0'
                    ])
                    .output(outputPath)
                    .on('end', () => resolve())
                    .on('error', (e: Error) => reject(new Error(`addSubtitles (soft) failed: ${e.message}`)))
                    .run();
            } else {
                // ── Hard mode ─────────────────────────────────────────────────────────
                // Burn subtitle text into video frames using the subtitles= filter
                // with optional force_style ASS overrides for full styling control.
                const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
                let filter = `subtitles='${escapedSrtPath}'`;

                if (options.style) {
                    const forceStyle = buildForceStyle(options.style);
                    if (forceStyle) filter += `:force_style='${forceStyle}'`;
                }

                Ffmpeg(inputPath)
                    .videoFilters([filter])
                    .output(outputPath)
                    .on('end', () => resolve())
                    .on('error', (e: Error) => reject(new Error(`addSubtitles (hard) failed: ${e.message}`)))
                    .run();
            }
        });

        const buffer = await fs.readFile(outputPath);
        await cleanupTmpFile(outputPath);
        return ok(buffer);

    } catch (e: any) {
        return err(ErrorCode.PROCESSING_FAILED, `addSubtitles failed: ${e.message}`);
    } finally {
        await cleanup();
        await cleanupSrt();
    }
}
