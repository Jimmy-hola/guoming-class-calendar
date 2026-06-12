@echo off
chcp 65001 >nul
rem Windows 用：雙擊即可啟動本機預覽，瀏覽器會自動跳出 QR code 給手機掃
cd /d "%~dp0"

echo ▶ 啟動本機預覽（發布前先看看；關閉這個視窗即停止）...
start /b cmd /c "timeout /t 1 >nul & start "" http://localhost:8765/qr"
node tools\serve.mjs
pause
