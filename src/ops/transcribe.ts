import { env, pipeline } from '@xenova/transformers';
import Ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { VideoInput, TranscribeOptions, TranscribeResult, Result, ErrorCode } from '../types.js';
import { loadVideo } from '../utils/load-video.js';
import { ok, err } from '../utils/result.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Configure transformers.js for Node.js — disable browser-only APIs
env.allowLocalModels = false;
env.useBrowserCache = false;

// Ensure ffmpeg path is set (may already be set via run-ffmpeg.ts but be explicit)
Ffmpeg.setFfmpegPath(ffmpegPath.path);

/** Per-model pipeline cache — keyed by Xenova model ID string. */
let cachedPipeline: { instance: any; modelId: string } | null = null;

const MODEL_DOWNLOAD_SIZES: Record<string, string> = {
    'tiny':     '~75 MB',
    'base':     '~150 MB',
    'small':    '~490 MB',
    'medium':   '~1.5 GB',
    'large-v3': '~3 GB',
};

function formatTimestamp(seconds: number, format: 'srt' | 'vtt'): string {
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const rem = seconds % 3600;
    const mm = String(Math.floor(rem / 60)).padStart(2, '0');
    const ss = String(Math.floor(rem % 60)).padStart(2, '0');
    const ms = String(Math.round((seconds % 1) * 1000)).padStart(3, '0');
    const sep = format === 'srt' ? ',' : '.';
    return `${hh}:${mm}:${ss}${sep}${ms}`;
}

/**
 * Decodes video/audio to a 16kHz mono Float32Array using FFmpeg piped output.
 *
 * This bypasses the browser-only AudioContext API that @xenova/transformers falls
 * back to when given a file path in a Node.js environment. Passing raw Float32Array
 * data directly to the pipeline avoids the "AudioContext not available" error.
 *
 * Reference: https://huggingface.co/docs/transformers.js/guides/node-audio-processing
 */
function extractPCMFloat32(inputPath: string): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        const cmd = Ffmpeg(inputPath)
            .audioChannels(1)        // mono
            .audioFrequency(16000)   // 16 kHz — Whisper's required sample rate
            .toFormat('f32le')       // raw 32-bit float little-endian PCM
            .on('error', (e: Error) => reject(new Error(`ffmpeg PCM extract failed: ${e.message}`)));

        const stream = cmd.pipe();
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
            const full = Buffer.concat(chunks);
            // Slice to get a properly aligned ArrayBuffer from the Node Buffer
            const ab = full.buffer.slice(full.byteOffset, full.byteOffset + full.byteLength);
            resolve(new Float32Array(ab));
        });
        stream.on('error', (e: Error) => reject(e));
    });
}

export async function transcribe(input: VideoInput, options?: TranscribeOptions): Promise<Result<TranscribeResult>> {
    const warnings: string[] = [];

    const modelSize = options?.model || 'base';
    const modelId = `Xenova/whisper-${modelSize}`;

    const loaded = await loadVideo(input);
    if (!loaded.ok) return loaded;
    const { path: inputPath, cleanup } = loaded.data;

    try {
        // 1. Decode audio to Float32Array via FFmpeg (16kHz mono, no AudioContext needed)
        const audioData = await extractPCMFloat32(inputPath);

        // 2. Load Whisper model — reload if a different model is requested
        if (!cachedPipeline || cachedPipeline.modelId !== modelId) {
            const sizeHint = MODEL_DOWNLOAD_SIZES[modelSize] ?? 'unknown size';
            warnings.push(`Downloading Whisper model '${modelSize}' (${sizeHint}) — this only happens once per model...`);
            cachedPipeline = {
                instance: await pipeline('automatic-speech-recognition', modelId),
                modelId
            };
        }

        // 3. Build generate_kwargs — pass hotwords as an initial prompt to bias
        // the Whisper decoder toward branded/technical terms without fine-tuning.
        // NOTE: @xenova/transformers v2 spreads generate_kwargs into model.generate().
        // Whisper's decoder accepts a `prompt` string as soft context for the first chunk.
        // If the installed version does not support this key it is silently ignored.
        const generateKwargs: Record<string, any> = {};
        if (options?.hotwords) {
            generateKwargs.prompt = options.hotwords;
        }

        // 4. Run transcription — Float32Array input avoids the AudioContext path
        const result = await cachedPipeline.instance(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: options?.language,
            task: 'transcribe',
            return_timestamps: true,
            ...(Object.keys(generateKwargs).length > 0 ? { generate_kwargs: generateKwargs } : {})
        });

        const segments = result.chunks || [];
        const text: string = result.text;

        // 4. Format subtitles
        let srt = '';
        let vtt = '';

        if (options?.format === 'srt' || options?.format === 'vtt') {
            if (options.format === 'vtt') vtt += 'WEBVTT\n\n';

            segments.forEach((chunk: any, i: number) => {
                const start: number = chunk.timestamp[0];
                const end: number = chunk.timestamp[1] ?? start + 2;
                const chunkText: string = chunk.text.trim();

                if (options.format === 'srt') {
                    srt += `${i + 1}\n`;
                    srt += `${formatTimestamp(start, 'srt')} --> ${formatTimestamp(end, 'srt')}\n`;
                    srt += `${chunkText}\n\n`;
                } else {
                    vtt += `${formatTimestamp(start, 'vtt')} --> ${formatTimestamp(end, 'vtt')}\n`;
                    vtt += `${chunkText}\n\n`;
                }
            });
        }

        // 5. Save transcript to output file if requested
        let savedTo: string | undefined;
        if (options?.output) {
            const outContent =
                options.format === 'srt' ? srt
                : options.format === 'vtt' ? vtt
                : JSON.stringify({ text, segments: segments.map((c: any) => ({
                    start: c.timestamp[0],
                    end: c.timestamp[1] ?? c.timestamp[0] + 2,
                    text: c.text.trim()
                })) }, null, 2);

            await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
            await fs.writeFile(options.output, outContent, 'utf-8');
            savedTo = options.output;
        }

        return ok({
            text,
            segments: segments.map((c: any) => ({
                start: c.timestamp[0],
                end: c.timestamp[1] ?? c.timestamp[0] + 2,
                text: c.text.trim()
            })),
            ...(options?.format === 'srt' ? { srt } : {}),
            ...(options?.format === 'vtt' ? { vtt } : {}),
            ...(savedTo ? { savedTo } : {})
        }, warnings);

    } catch (e: any) {
        return err(ErrorCode.PROCESSING_FAILED, `transcribe failed: ${e.message}`);
    } finally {
        await cleanup();
    }
}
