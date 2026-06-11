# 給 AI 的專案說明

開始工作前**先讀 `工作紀錄.md`**（專案狀態、決策、待辦都在那），完成重要修改後更新它的「待辦／修改紀錄」。

## 架構

`data/*.csv` →（`node tools/build.mjs`）→ `docs/events.json` → `docs/index.html`（FullCalendar）顯示。
託管：GitHub Pages（main 分支 `/docs`）。發布＝build + commit + push（或直接跑 `發布.command`）。
本機預覽：`node tools/serve.mjs` → http://localhost:8765/

## 慣例與地雷

- 科目名稱必須與 `data/複習卷清單.csv` 一致（公民要寫「公民與社會」）；日期 `YYYY-MM-DD`、時間 `HH:MM`
- `複習卷進度.csv` 只填日期/時段/科目/回次，範圍說明由 build 自動 join `複習卷清單.csv`
- 某時段排了複習卷時，build 會自動隱藏該時段通用的「測驗及輔導」
- 模考週由 `設定.csv`「模考週開始」產生（五天：國英數自社；自然範圍 B1~B3）
- **此 repo 是公開的**：不要放學生個資、成績、LINE 截圖；原始照片留在本機 `國三資料/整理前`
- 下午時段叫「暑訓」不是「自修」；改動後記得 `node tools/build.mjs` 重建再 commit
