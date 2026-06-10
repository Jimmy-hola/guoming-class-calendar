#!/bin/bash
# Mac 用：雙擊即可「建置 + 發布」行事曆
cd "$(dirname "$0")"

echo "▶ 重新產生行事曆資料..."
if ! node tools/build.mjs; then
  echo "❌ 建置失敗，請檢查 data/ 內的 CSV 格式"
  read -p "按 Enter 關閉"
  exit 1
fi

echo "▶ 上傳到 GitHub..."
git add -A
git commit -m "更新行事曆 $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1 || echo "（資料沒有變更，仍嘗試同步）"
git pull --rebase origin main
if git push origin main; then
  echo ""
  echo "✅ 發布成功！約 1 分鐘後網站就會更新。"
else
  echo "❌ 上傳失敗，請檢查網路或 GitHub 登入狀態"
fi
read -p "按 Enter 關閉"
