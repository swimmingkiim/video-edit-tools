/**
 * Smoke test for the two MCP handleTool fixes:
 * 1. video_resize — was throwing "ops.generateTmpFilePath is not a function"
 * 2. video_pipeline — was throwing "steps is not iterable"
 *    Also tests 'operation' key normalization (Claude Desktop sends 'operation' not 'op')
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { handleTool } from '../src/mcp/tools.js';

const SAMPLE = path.join(process.cwd(), 'tests', 'fixtures', 'sample.mp4');

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

    // Bug 1: video_resize — generateTmpFilePath fix
    await test('video_resize (640x360 fill)', async () => {
        const res = await handleTool('video_resize', {
            input: SAMPLE,
            width: 640,
            height: 360,
            fit: 'fill'
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (!payload.data?.savedTo) throw new Error('No savedTo path returned');
        // Verify the file actually exists
        await fs.access(payload.data.savedTo);
        console.log(`(→ ${payload.data.savedTo})`);
        // Cleanup
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // Bug 2a: video_pipeline with 'op' key (original format)
    await test("video_pipeline steps with 'op' key", async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ op: 'resize', width: 320, height: 180, fit: 'fill' }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (!payload.data?.savedTo) throw new Error('No savedTo path returned');
        await fs.access(payload.data.savedTo);
        console.log(`(→ ${payload.data.savedTo})`);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // Bug 2b: video_pipeline with 'operation' key (Claude Desktop format)
    await test("video_pipeline steps with 'operation' key (Claude compat)", async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{ operation: 'resize', width: 320, height: 180, fit: 'fill' }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (!payload.data?.savedTo) throw new Error('No savedTo path returned');
        await fs.access(payload.data.savedTo);
        console.log(`(→ ${payload.data.savedTo})`);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // Bug 2c: video_pipeline with steps as JSON string (defensive parse)
    await test('video_pipeline steps as JSON string', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: JSON.stringify([{ op: 'resize', width: 320, height: 180, fit: 'fill' }])
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (!payload.data?.savedTo) throw new Error('No savedTo path returned');
        await fs.access(payload.data.savedTo);
        console.log(`(→ ${payload.data.savedTo})`);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    // Concat step in pipeline
    await test('video_pipeline with concat step', async () => {
        const res = await handleTool('video_pipeline', {
            input: SAMPLE,
            steps: [{
                op: 'concat',
                inputs: [SAMPLE]  // concat the same clip to itself
            }]
        });
        if (res.isError) throw new Error(res.content[0].text);
        const payload = JSON.parse(res.content[0].text);
        if (!payload.ok) throw new Error(payload.error);
        if (!payload.data?.savedTo) throw new Error('No savedTo path returned');
        await fs.access(payload.data.savedTo);
        console.log(`(→ ${payload.data.savedTo})`);
        await fs.unlink(payload.data.savedTo).catch(() => {});
    });

    console.log('\n');
}

run().catch(e => { console.error(e); process.exit(1); });
