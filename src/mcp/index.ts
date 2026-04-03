#!/usr/bin/env node

// Suppress GLib/GTK warnings from native addons (e.g. canvas on Windows).
// Claude Desktop marks the MCP server as failed if it sees any stderr during
// startup, so we swallow these harmless messages before anything else loads.
const _rawStderrWrite = process.stderr.write.bind(process.stderr);
(process.stderr as any).write = (
  chunk: any,
  encoding?: BufferEncoding | ((err?: Error | null) => void),
  callback?: (err?: Error | null) => void
): boolean => {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  if (/GLib-|GObject-|GTK-/.test(str)) {
    if (typeof encoding === 'function') encoding();
    else if (typeof callback === 'function') callback();
    return true;
  }
  return _rawStderrWrite(chunk, encoding as BufferEncoding, callback);
};

import { runServer } from './server.js';

runServer().catch((error) => {
    console.error("Fatal error running MCP server:", error);
    process.exit(1);
});
