#!/bin/bash
# Mac 用：雙擊即可啟動本機預覽，瀏覽器會自動跳出 QR code 給手機掃
cd "$(dirname "$0")"

echo "▶ 重新產生行事曆資料..."
if ! node tools/build.mjs; then
  echo "❌ 建置失敗，請檢查 data/ 內的 CSV 格式"
  read -p "按 Enter 關閉"
  exit 1
fi

echo "▶ 啟動本機預覽（發布前先看看；關閉這個視窗即停止）..."
( sleep 1; open "http://localhost:8765/qr" ) &
node tools/serve.mjs
read -p "按 Enter 關閉"
