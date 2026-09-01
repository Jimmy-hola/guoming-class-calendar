#!/usr/bin/env node
// 本機預覽伺服器：node tools/serve.mjs [port]，預覽 docs/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const PORT = Number(process.argv[2]) || 8765;
const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

function lanURL() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) return `http://${a.address}:${PORT}/`;
    }
  }
  return null;
}

function qrPage() {
  const url = lanURL();
  if (!url) return `<!DOCTYPE html><meta charset="utf-8"><p>找不到區域網路 IP，請確認電腦已連上 Wi-Fi 或熱點。</p>`;
  return `<!DOCTYPE html>
<html lang="zh-Hant-TW"><head><meta charset="utf-8"><title>手機預覽 QR code</title></head>
<body style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;text-align:center;padding:36px 16px;background:#f5f6f8">
<h2 style="color:#1a5276">📱 手機掃描預覽</h2>
<p style="color:#555">手機需與這台電腦連同一個 Wi-Fi／熱點（開熱點的那支手機也可以直接掃）</p>
<div id="qr" style="display:inline-block;padding:18px;background:#fff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,.12)"></div>
<p style="font-size:1.05rem">或手動輸入：<a href="${url}">${url}</a></p>
<p style="color:#999;font-size:.85rem">若 Safari 顯示「僅限 HTTPS」錯誤，請完整輸入含 http:// 與埠號的網址</p>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"><\/script>
<script>new QRCode(document.getElementById("qr"), { text: "${url}", width: 280, height: 280 });<\/script>
</body></html>`;
}

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/qr") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(qrPage());
    }
    if (p === "/") p = "/index.html";
    const file = normalize(join(DOCS, p));
    if (!file.startsWith(DOCS)) throw new Error("forbidden");
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️ 埠號 ${PORT} 已有預覽在跑，直接用原本的視窗即可（或先關掉它再重開）。`);
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, () => {
  console.log(`預覽（這台電腦）：http://localhost:${PORT}/`);
  const lan = lanURL();
  if (lan) console.log(`手機（同一個 Wi-Fi／熱點）：${lan}`);
  console.log(`手機掃 QR code：開 http://localhost:${PORT}/qr`);
});
