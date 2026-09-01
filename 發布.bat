@echo off
chcp 65001 >nul
rem Windows 用：雙擊即可「建置 + 發布」行事曆
cd /d "%~dp0"

echo ▶ 重新產生行事曆資料...
node tools\build.mjs
if errorlevel 1 (
  echo ❌ 建置失敗，請檢查 data\ 內的 CSV 格式
  pause
  exit /b 1
)

echo ▶ 上傳到 GitHub...
git add -A
git commit -m "更新行事曆 %date% %time%" >nul 2>&1
git pull --rebase origin main
git push origin main
if errorlevel 1 (
  echo ❌ 上傳失敗，請檢查網路或 GitHub 登入狀態
) else (
  echo.
  echo ✅ 發布成功！約 1 分鐘後網站就會更新。
)
pause
