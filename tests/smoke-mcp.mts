/**
 * Smoke test for MCP handleTool fixes:
 * 1. video_resize — was throwing "ops.generateTmpFilePath is not a function"
 * 2. video_pipeline — was throwing "steps is not iterable"
 *    Also tests 'operation' key normalization (Claude Desktop sends 'operation' not 'op')
 * 3. output parameter — all affected tools accept an optional output path
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { handleTool } from '../src/mcp/tools.js';

const SAMPLE = path.join(process.cwd(), 'tests', 'fixtures', 'sample.mp4');
const TMP = os.tmpdir();

async function test(label: string, fn: () => Promise<void>) {
    process.stdout.write(`  ${label} ... `);
    try {
        await fn();
        console.log('✅ PASS');
    } catch (e: any) {
        console.log(`❌ FAIL: ${e.message}`);
        process.exitCode = 1;
    }
}

async function run() {
    console.log('\n=== MCP handleTool smoke tests ===\n');

    // ── Bug 1: video_resize — generateTmpFilePath fix ──────────────────────────
    await test('video_resize (to temp)', async () => {
        const res = await handleTool('video_resize', { input: SAMPLE, width: 640, height: 360, fit: 'fill' });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (!payload.data?.savedTo) throw new Error('No savedTo path returned');
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // ── Bug 2: video_pipeline — steps extraction & op normalization ─────────────
    await test("video_pipeline steps with 'op' key", async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'resize', width: 320, height: 180, fit: 'fill' }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    await test("video_pipeline steps with 'operation' key (Claude compat)", async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ operation: 'resize', width: 320, height: 180, fit: 'fill' }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    await test('video_pipeline steps as JSON string', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: JSON.stringify([{ op: 'resize', width: 320, height: 180, fit: 'fill' }])
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    await test('video_pipeline with concat step', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'concat', inputs: [SAMPLE] }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        await fs.access(payload.data.savedTo);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // ── output parameter ────────────────────────────────────────────────────────
    const outFile = path.join(TMP, `smoke-resize-output-${Date.now()}.mp4`);
    await test('video_resize with output path (saves to specified file)', async () => {
        const res = await handleTool('video_resize', {
            input: SAMPLE, width: 320, height: 180, fit: 'fill',
            output: outFile
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (payload.data.savedTo !== outFile) throw new Error(`savedTo mismatch: ${payload.data.savedTo}`);
        await fs.access(outFile);   // file must exist at the specified path
        await fs.unlink(outFile).catch(() => {});
    });

    const pipelineOut = path.join(TMP, `smoke-pipeline-output-${Date.now()}.mp4`);
    await test('video_pipeline with output path', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'resize', width: 320, height: 180, fit: 'fill' }],
            output: pipelineOut
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (payload.data.savedTo !== pipelineOut) throw new Error(`savedTo mismatch: ${payload.data.savedTo}`);
        await fs.access(pipelineOut);
        await fs.unlink(pipelineOut).catch(() => {});
    });

    // Verify output creates parent directories if missing
    const nestedOut = path.join(TMP, `smoke-nested-${Date.now()}`, 'subdir', 'output.mp4');
    await test('video_trim with output in non-existent directory (auto-mkdir)', async () => {
        const res = await handleTool('video_trim', {
            input: SAMPLE, start: '0', end: '2',
            output: nestedOut
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (payload.data.savedTo !== nestedOut) throw new Error(`savedTo mismatch`);
        await fs.access(nestedOut);
        await fs.rm(path.dirname(path.dirname(nestedOut)), { recursive: true }).catch(() => {});
    });

    console.log('\n');
}

run().catch(e => { console.error(e); process.exit(1); });
