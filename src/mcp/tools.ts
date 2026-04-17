import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as ops from '../index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateTmpFilePath } from '../utils/tmp.js';

const OUTPUT_PROP = {
    type: 'string',
    description: 'Optional path to save the output file. If omitted, saves to a temp file and returns the path in savedTo.'
} as const;

export const allTools: Tool[] = [
    {
        name: 'video_trim',
        description: 'Trims a video to a specific time range.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                start: { type: 'string', description: 'Start time in seconds or HH:MM:SS format' },
                end: { type: 'string', description: 'End time in seconds or HH:MM:SS format (optional)' },
                duration: { type: 'number', description: 'Duration to trim in seconds (optional)' },
                output: OUTPUT_PROP
            },
            required: ['input', 'start']
        }
    },
    {
        name: 'video_concat',
        description: 'Concatenates multiple videos together.',
        inputSchema: {
            type: 'object',
            properties: {
                inputs: { type: 'array', items: { type: 'string' }, description: 'Array of input video paths or URLs' },
                transition: { type: 'object', properties: { type: { type: 'string', enum: ['fade', 'none'] }, duration: { type: 'number' } }, description: 'Optional transition settings' },
                format: { type: 'string', enum: ['mp4', 'webm'], description: 'Output format' },
                output: OUTPUT_PROP
            },
            required: ['inputs']
        }
    },
    {
        name: 'video_resize',
        description: 'Resizes a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                width: { type: 'number' },
                height: { type: 'number' },
                fit: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'] },
                output: OUTPUT_PROP
            },
            required: ['input']
        }
    },
    {
        name: 'video_crop',
        description: 'Crops a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                aspectRatio: { type: 'string', description: 'e.g. "16:9"' },
                output: OUTPUT_PROP
            },
            required: ['input']
        }
    },
    {
        name: 'video_change_speed',
        description: 'Changes the playback speed of a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                speed: { type: 'number', description: 'Speed multiplier (e.g. 2.0 for 2x fast, 0.5 for half speed)' },
                output: OUTPUT_PROP
            },
            required: ['input', 'speed']
        }
    },
    {
        name: 'video_convert',
        description: 'Converts a video to a different format.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                format: { type: 'string', enum: ['mp4', 'webm', 'avi', 'mov', 'gif'] },
                quality: { type: 'number', description: '0-100 quality scale' },
                fps: { type: 'number' },
                width: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['input', 'format']
        }
    },
    {
        name: 'video_extract_frames',
        description: 'Extracts frames from a video as images.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                mode: { type: 'string', enum: ['fps', 'timestamps', 'count'] },
                fps: { type: 'number' },
                timestamps: { type: 'array', items: { type: 'number' } },
                count: { type: 'number' }
            },
            required: ['input', 'mode']
        }
    },
    {
        name: 'video_get_metadata',
        description: 'Gets metadata of a video (duration, fps, resolution, etc).',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' }
            },
            required: ['input']
        }
    },
    {
        name: 'video_add_text',
        description: 'Overlays text onto a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                layers: { type: 'array', items: { type: 'object' } },
                output: OUTPUT_PROP
            },
            required: ['input', 'layers']
        }
    },
    {
        name: 'video_add_subtitles',
        description: 'Embeds subtitles into a video as a soft (selectable) track or hard-burned into frames.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                subtitles: { type: 'string', description: 'Path to subtitle file (.srt, .vtt) or array of subtitle entry objects' },
                mode: {
                    type: 'string',
                    enum: ['soft', 'hard'],
                    description: 'soft (default): embed as a selectable subtitle stream, no re-encode. hard: burn subtitle text into video frames.'
                },
                style: {
                    type: 'object',
                    description: 'Styling for hard mode only (ignored in soft mode). Keys: fontSize, fontFamily, fontColor, outlineColor, outlineWidth, bold, italic, alignment (ASS: 2=bottom-center), marginV, backgroundOpacity (0-1).'
                },
                output: OUTPUT_PROP
            },
            required: ['input', 'subtitles']
        }
    },
    {
        name: 'video_composite',
        description: 'Composites images or logos onto a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                layers: { type: 'array', items: { type: 'object' } },
                output: OUTPUT_PROP
            },
            required: ['input', 'layers']
        }
    },
    {
        name: 'video_gradient_overlay',
        description: 'Overlays a gradient onto a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                direction: { type: 'string', enum: ['bottom', 'top', 'left', 'right'] },
                color: { type: 'string' },
                opacity: { type: 'number' },
                coverage: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['input', 'direction']
        }
    },
    {
        name: 'video_blur_region',
        description: 'Blurs specific regions of a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                regions: { type: 'array', items: { type: 'object' } },
                blur: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['input', 'regions']
        }
    },
    {
        name: 'video_add_transition',
        description: 'Adds a transition effect between two videos.',
        inputSchema: {
            type: 'object',
            properties: {
                inputs: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
                type: { type: 'string', enum: ['fade', 'slide-left', 'slide-right', 'wipe', 'dissolve'] },
                duration: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['inputs', 'type']
        }
    },
    {
        name: 'video_extract_audio',
        description: 'Extracts audio from a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                format: { type: 'string', enum: ['mp3', 'aac', 'wav', 'flac'] },
                quality: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['input']
        }
    },
    {
        name: 'video_replace_audio',
        description: 'Replaces the audio track of a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                audio: { type: 'string', description: 'Path or URL to new audio' },
                fadeIn: { type: 'number' },
                fadeOut: { type: 'number' },
                loop: { type: 'boolean' },
                output: OUTPUT_PROP
            },
            required: ['input', 'audio']
        }
    },
    {
        name: 'video_adjust_volume',
        description: 'Adjusts the volume of a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                volume: { type: 'number' },
                fadeIn: { type: 'number' },
                fadeOut: { type: 'number' },
                normalize: { type: 'boolean' },
                output: OUTPUT_PROP
            },
            required: ['input']
        }
    },
    {
        name: 'video_mute_section',
        description: 'Mutes specific sections of a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                sections: { type: 'array', items: { type: 'object' } },
                output: OUTPUT_PROP
            },
            required: ['input', 'sections']
        }
    },
    {
        name: 'video_transcribe',
        description: 'Transcribes audio to text (Whisper AI).',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                model: {
                    type: 'string',
                    enum: ['tiny', 'base', 'small', 'medium', 'large-v3'],
                    description: 'Whisper model size. large-v3 gives the best accuracy for technical/domain content (~3 GB RAM). Defaults to base.'
                },
                language: { type: 'string' },
                format: { type: 'string', enum: ['json', 'srt', 'vtt'] },
                hotwords: {
                    type: 'string',
                    description: 'Optional comma-separated proper nouns or domain terms to bias transcription toward (e.g. "MegaMem, GraphRAG, Obsidian, Casey Bjørn"). Improves accuracy for branded/technical vocabulary without fine-tuning.'
                },
                output: { type: 'string', description: 'Optional path to save the transcript file (.srt, .vtt, or .json). If omitted the transcript is returned inline only.' }
            },
            required: ['input']
        }
    },
    {
        name: 'video_adjust',
        description: 'Adjusts brightness, contrast, saturation, hue, gamma.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                brightness: { type: 'number' },
                contrast: { type: 'number' },
                saturation: { type: 'number' },
                hue: { type: 'number' },
                gamma: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['input']
        }
    },
    {
        name: 'video_apply_filter',
        description: 'Applies predefined filters (grayscale, sepia, vintage, etc).',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                filter: { type: 'string', enum: ['grayscale', 'sepia', 'vintage', 'blur', 'sharpen', 'vignette'] },
                intensity: { type: 'number' },
                output: OUTPUT_PROP
            },
            required: ['input', 'filter']
        }
    },
    {
        name: 'video_detect_scenes',
        description: 'Detects scenes and cuts in a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                threshold: { type: 'number' },
                minSceneDuration: { type: 'number' }
            },
            required: ['input']
        }
    },
    {
        name: 'video_generate_thumbnail',
        description: 'Generates one or more thumbnails from a video.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                time: { type: 'number', description: 'Time in seconds' },
                width: { type: 'number' },
                height: { type: 'number' },
                count: { type: 'number' },
                format: { type: 'string', enum: ['jpeg', 'png', 'webp'] }
            },
            required: ['input']
        }
    },
    {
        name: 'video_pipeline',
        description: 'Runs multiple operations sequentially.',
        inputSchema: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Path or URL to input video' },
                steps: { type: 'array', items: { type: 'object' } },
                output: OUTPUT_PROP
            },
            required: ['input', 'steps']
        }
    },
    {
        name: 'video_batch',
        description: 'Processes multiple videos through the same pipeline sequentially or in parallel.',
        inputSchema: {
            type: 'object',
            properties: {
                inputs: { type: 'array', items: { type: 'string' } },
                steps: { type: 'array', items: { type: 'object' } },
                options: { type: 'object' },
                output: { type: 'string', description: 'Optional directory path to save output files. Files are named output_0.mp4, output_1.mp4, etc. If omitted, saves to temp files.' }
            },
            required: ['inputs', 'steps']
        }
    }
];

export async function handleTool(name: string, args: any): Promise<any> {
    const fnName = name.replace('video_', '').replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    
    if (!(fnName in ops)) {
        throw new Error(`Tool not found: ${name}`);
    }

    // Validate inputs locally based on schema required properties
    const toolDef = allTools.find(t => t.name === name);
    if (!toolDef || !toolDef.inputSchema) {
         return {
             content: [{
                 type: 'text',
                 text: JSON.stringify({ ok: false, code: 'INVALID_INPUT', error: `Tool unknown or missing schema: ${name}` })
             }],
             isError: true
         };
    }

    const mArgs = { ...args };
    const required = (toolDef.inputSchema as any).required || [];
    for (const req of required) {
        if (!(req in mArgs) || mArgs[req] === undefined) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ ok: false, code: 'INVALID_INPUT', error: `Missing required parameter: ${req}` })
                }],
                isError: true
            };
        }
    }

    try {
        let inputArg = mArgs.input;
        let secondArg: any = { ...mArgs };
        delete secondArg.input;
        // Remove output from secondArg — it's handled here, not passed to ops functions
        delete secondArg.output;
        if (Object.keys(secondArg).length === 0) secondArg = undefined;

        if (name === 'video_concat') {
             inputArg = mArgs.inputs;
             delete secondArg.inputs;
             if (Object.keys(secondArg).length === 0) secondArg = undefined;
        } else if (name === 'video_add_transition') {
             inputArg = mArgs.inputs;
             delete secondArg.inputs;
        } else if (name === 'video_pipeline') {
             // pipeline(input, steps[]) — secondArg must be the steps array directly,
             // not the whole options object { steps: [...] }.
             // Also normalise 'operation' -> 'op' since Claude often emits 'operation'.
             let rawSteps = mArgs.steps;
             if (typeof rawSteps === 'string') {
                 try { rawSteps = JSON.parse(rawSteps); } catch { /* leave as-is */ }
             }
             secondArg = Array.isArray(rawSteps)
                 ? rawSteps.map((s: any) => (s.operation && !s.op ? { ...s, op: s.operation } : s))
                 : rawSteps;
        } else if (name === 'video_batch') {
             // batch(inputs[], steps[], options?) — same extraction logic as pipeline
             inputArg = mArgs.inputs;
             let rawSteps = mArgs.steps;
             if (typeof rawSteps === 'string') {
                 try { rawSteps = JSON.parse(rawSteps); } catch { /* leave as-is */ }
             }
             secondArg = Array.isArray(rawSteps)
                 ? rawSteps.map((s: any) => (s.operation && !s.op ? { ...s, op: s.operation } : s))
                 : rawSteps;
        }

        const fn = (ops as any)[fnName];
        const res = await (secondArg ? fn(inputArg, secondArg) : fn(inputArg));

        if (!res.ok) {
            return {
                content: [{ type: 'text', text: JSON.stringify(res) }],
                isError: true
            };
        }

        // Resolve output path — use caller-provided path or generate a temp file.
        // For Buffer[] results (video_batch) the output param is treated as a directory.
        const requestedOutput = mArgs.output as string | undefined;

        let resultPayload: any = { ...res };
        if (Buffer.isBuffer(res.data)) {
            let finalPath: string;
            if (requestedOutput) {
                // Create parent directories if needed
                await fs.mkdir(path.dirname(path.resolve(requestedOutput)), { recursive: true });
                finalPath = requestedOutput;
            } else {
                // Derive a sensible extension from the tool name
                const ext = name === 'video_extract_audio'
                    ? (mArgs.format || 'mp3')
                    : 'mp4';
                finalPath = generateTmpFilePath(ext);
            }
            await fs.writeFile(finalPath, res.data);
            resultPayload.data = {
                 message: 'Processing succeeded.',
                 savedTo: finalPath
            };
        } else if (Array.isArray(res.data) && res.data.length > 0 && Buffer.isBuffer(res.data[0])) {
            const outPaths: string[] = [];
            if (requestedOutput) {
                // Treat requestedOutput as a directory for multi-file results
                await fs.mkdir(requestedOutput, { recursive: true });
                for (let i = 0; i < res.data.length; i++) {
                    const outPath = path.join(requestedOutput, `output_${i}.mp4`);
                    await fs.writeFile(outPath, res.data[i]);
                    outPaths.push(outPath);
                }
            } else {
                for (let i = 0; i < res.data.length; i++) {
                    const outPath = generateTmpFilePath('jpg');
                    await fs.writeFile(outPath, res.data[i]);
                    outPaths.push(outPath);
                }
            }
            resultPayload.data = {
                 message: 'Processing succeeded.',
                 savedTo: outPaths
            };
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(resultPayload)
            }]
        };

    } catch (e: any) {
        return {
             content: [{
                 type: 'text',
                 text: JSON.stringify({ ok: false, code: 'PROCESSING_FAILED', error: e.message })
             }],
             isError: true
        };
    }
}
