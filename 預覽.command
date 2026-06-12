#!/bin/bash
# Mac 用：雙擊即可啟動本機預覽，瀏覽器會自動跳出 QR code 給手機掃
cd "$(dirname "$0")"

echo "▶ 啟動本機預覽（發布前先看看；關閉這個視窗即停止）..."
( sleep 1; open "http://localhost:8765/qr" ) &
node tools/serve.mjs
read -p "按 Enter 關閉"
