#!/usr/bin/env node
// 本機預覽伺服器：node tools/serve.mjs [port]，預覽 docs/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const PORT = Number(process.argv[2]) || 8765;
const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = normalize(join(DOCS, p));
    if (!file.startsWith(DOCS)) throw new Error("forbidden");
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}).listen(PORT, () => console.log(`預覽：http://localhost:${PORT}/`));
