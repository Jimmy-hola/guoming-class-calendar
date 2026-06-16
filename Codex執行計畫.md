# Codex 執行計畫 — 國三行事曆改版（2026-06-16）

> 這份是交給 Codex 執行的規格。逐項做、做完依「驗收」檢查。
> 完成後務必跑 `node tools/build.mjs` 重建 `docs/events.json`，本機 `node tools/serve.mjs` 預覽確認，再由使用者發布。

## 共同規則（務必遵守）

- `data/*.csv` 一律 **UTF-8 含 BOM**；用程式重寫 CSV 後要確認 BOM 還在（開頭 `﻿`）。
- 改 `data/` 或 `tools/build.mjs` 後一定要 `node tools/build.mjs` 重新產生 `docs/events.json`。
- 顯示層科目歸併規則不變（理化/生物→自然色，歷地公→社會色，只影響顏色）；事件標題仍用細科名稱，**不要改 CSV 的科目名稱**。
- 此 repo 公開：不要放個資、成績。
- 正式版是 `docs/index.html`；`docs/prototype.html` 是設計沙盒。UI 類改動（任務 A、B、C、D 的網頁部分）**建議同步套到 prototype.html**，但以 index.html 為準。
- 完成後更新 `工作紀錄.md`（待辦／修改紀錄）與必要時 `CLAUDE.md`、`README.md`（設定欄位有新增）。

---

## 任務 A — 月曆點日期改「彈窗」顯示當天細項（取代底部展開）

**目標**：在月曆模式點某一天（或色條），改成跳出彈窗列出當天全部行程（含複習卷、暑訓），點其中一筆再開原本的詳情彈窗。不要再像現在塞在月曆最下方。

**現況**：`docs/index.html`
- `renderMonthDetail()`（約 line 1581）把當天行程渲染進月曆下方的 `#monthDayDetail`（約 line 1266）。
- `month-pick` 動作（約 line 2059）設定 `state.monthDetailDate` 與 `state.selectedDate` 後 `render()`。

**改動**：
1. 在 `#eventModal`（約 line 1307）附近新增一個日明細彈窗 `#dayModal`，結構比照現有 `.modal`：標題放長日期、一個關閉鈕、內容容器 `#dayModalList`。
2. 新增函式 `openDayModal(date)`：標題用 `formatLongDate(date)`；內容用 `eventsForDate(date, false)` 逐筆套 `compactEventTemplate`（每筆仍帶 `data-action="open-event"`）；無行程顯示 empty-state「這天沒有行程。」；最後 `openPanel("dayModal")` 並 `syncIcons()`。
3. 修改 `month-pick` 處理：仍設 `state.monthDetailDate = trigger.dataset.date` 並 `render()`（保留選取格的高亮藍框），但**改成呼叫 `openDayModal(trigger.dataset.date)`**，不再依賴底部展開。
4. 移除底部展開：把 `renderMonthDetail()` 改成只負責「不顯示」（或直接拿掉 `#monthDayDetail` 與其呼叫），避免重複顯示。保留月曆格 `selected` 高亮邏輯（約 line 1565）。
5. 點 `#dayModalList` 內某筆 → 既有全域 click handler 的 `open-event` 會開 `#eventModal`（會先 `closePanels` 關掉 dayModal，可接受）。

**驗收**：月曆點任一天或色條 → 彈窗列出當天完整行程；點一筆 → 開詳情彈窗；關閉後回到月曆，被點的日期仍有高亮；月曆下方不再有展開區塊。

---

## 任務 B — 新增「今天」按鈕（放日期列旁）

**目標**：日期列要有一顆明確標示「今天」的按鈕，點了回到今天。

**現況**：`docs/index.html` 日期列在 `.date-line`（line 1215–1223）。其中 `#weekdayPill`（line 1218）其實已綁 `jump-today`，但看起來像標籤、使用者不知道能點。`jump-today` 動作在 line 2074（切到列表、`selectedDate=defaultDate`、捲到 `todayPanel`）。

**改動**：
1. 在 `.day-nav`（line 1219）的 `‹ ›` 旁，新增一顆按鈕：`<button class="today-btn" type="button" data-action="jump-today">今天</button>`（放在 `.day-nav` 內或緊鄰）。
2. 加對應 CSS：小型 pill 樣式（沿用 `.weekday-pill` 或 `.chip` 風格），清楚可點。
3. `jump-today` 行為沿用現有（回今天、列表模式、捲到今日卡）。`#weekdayPill` 可保留可點，但主要入口改用這顆「今天」。

**驗收**：日期列旁出現「今天」按鈕；在任何日期/模式點它都會回到今天的列表並捲到今日卡。

---

## 任務 C — 合併「重要提醒／重要通知」為單一名稱

**目標**：兩者本來就是同一份資料（首頁是近 30 天前 5 筆預覽、通知面板是完整清單），統一名稱為「**重要通知**」，首頁保留近期預覽 +「查看全部」。

**現況**：`docs/index.html`
- 首頁區塊 `#recentPanel` aria-label「重要提醒」（line 1232）、標題「重要提醒」（line 1234）。
- 抽屜選單已叫「重要通知」（line 1278）；通知面板與 badge 不變。
- 注意：JS 物件 `TYPE_COLORS["重要提醒"]`（line 1339）與 `colorOf` 內引用（line 1816）是**顏色查表用的內部 key**，不要改動以免連動壞掉。

**改動**：只改使用者看得到的文字：
1. line 1232 aria-label `重要提醒` → `重要通知`。
2. line 1234 標題 `重要提醒` → `重要通知`。
3. 內部 `TYPE_COLORS` 的 key 與 `colorOf` 不動。

**驗收**：首頁那塊標題顯示「重要通知」（仍是近期預覽 +「查看全部」），抽屜也是「重要通知」，行為不變。

---

## 任務 D — 「公布截止日」鎖定機制 + 紙本只印近月

**目標**：網頁與紙本只公布到指定日期（先設 **2026-08-31**），之後的行程暫不發布（鎖定）。使用者想看更後面時，導覽會停在公布邊界並提示「暫定，老師確認後公布」。確認後改設定日期、重新 build＋發布即可釋出下一段。紙本（print.html）更近，只印到另一個更早的截止日。

> 採「build 階段就不輸出超過公布日的事件」的做法——因為 repo 公開、`events.json` 會進公開倉庫，真正的鎖定要從產生端就不放出未公布資料。

**改動 1：`data/設定.csv`** 新增兩列（含 BOM）：
```
公布截止日,2026-08-31,網頁與紙本只公布到此日；之後行程暫定先不發布，確認後改此日再重新發布
紙本公布截止日,2026-07-31,紙本(print.html)只印到此月；通常比網頁更近，留空則同公布截止日
```
（`紙本公布截止日` 的值請依當下月份調整，預設 2026-07-31 代表先印到 7 月底。）

**改動 2：`tools/build.mjs`**
- 在讀 `START`/`END` 後加：
  - `const PUBLISH_THROUGH = config["公布截止日"] || END;`
  - `const EFFECTIVE_END = PUBLISH_THROUGH < END ? PUBLISH_THROUGH : END;`
  - `const PRINT_THROUGH = config["紙本公布截止日"] || PUBLISH_THROUGH;`
- **既有的警告檢查（模考週、停課）維持跑在完整資料上**（它們在事件輸出前、用 reviewSchedule/mockExams，不受影響）。
- 在 `events.sort(...)`（line 207）之後、組 `out` 之前，過濾出已公布事件：
  - `const publishedEvents = events.filter((e) => String(e.start).slice(0, 10) <= EFFECTIVE_END);`
- `out` 改用 `publishedEvents`，並調整 range 與新增欄位：
  - `range: { start: START, end: EFFECTIVE_END }`
  - 新增 `full_end: END`、`publish_through: PUBLISH_THROUGH`、`print_through: PRINT_THROUGH`
- console.log 補上「已公布至 EFFECTIVE_END（完整排程至 END）」與公布筆數。

**改動 3：`docs/index.html`**（`range.end` 在 build 後已等於公布日，導覽自動止於此）
- `shiftSelectedDate` 邊界提示（line 2027）改成更白話：例如
  `showToast(`${formatMonthDay(state.data.range.end)} 之後為暫定進度，老師確認後公布`);`
- `drawerNote`（line 1394）措辭改為「已公布至 {range.end}，後續進度老師確認後更新。實際考程以本行事曆為準，停課日當天課程全部暫停。」
- 在首頁（`#recentPanel` 之後或頁尾）新增一行常駐提示，內容用 `data.range.end`：
  「🔒 本行事曆已公布至 8/31，後續進度暫定中，老師確認後更新。」（日期由 JS 帶入，不要寫死。）

**改動 4：`docs/print.html`**
- 取結束月份的那行（約 line 92）`const [ey, em] = data.range.end.split("-")...` 改為使用 `data.print_through || data.range.end`。
- （起始月份維持 `data.range.start`；若日後要更精準的「近一個月」再加 `print_from` 設定。）

**驗收**：
- build 後 `events.json` 的 `range.end` = 公布截止日，且沒有任何 `start` 晚於它的事件；另含 `full_end`、`publish_through`、`print_through`。
- 網頁列表/月曆都無法越過公布日；按到邊界跳「…之後為暫定進度…」；首頁顯示「已公布至 8/31」提示。
- 紙本只印到「紙本公布截止日」那個月。
- 把 `公布截止日` 改成更後面的日期再 build，後段行程就會出現（驗證可釋出機制）。

---

## 任務 E — 國定假日改「暫定」不預設停課

**目標**：呼應「國定假日 ≠ 停課」。不要把國定假日自動當成停課公布；改為「暫定，待確認」，確認後再由使用者改回停課或刪除。

**現況**：`data/特殊日.csv` 第 4–9 列把中秋(9/25)、教師節(9/28)、國慶(10/9–10/10)、光復補假(10/26)、行憲(12/25)、元旦(2027/1/1) 都寫成 `type=停課`。
（註：在「公布截止日=8/31」下這些日期都在閘門之後、暫時不會輸出；此修正是為了之後公布到 9 月以後時不誤標停課。）

**改動**：把這 6 列的 `type` 由 `停課` 改為 `備註`，`title` 後面加「（暫定·待確認是否停課）」，`notes` 改為「國定假日；確認停課請把 type 改回『停課』，照常上課請刪除此列」。保留 BOM。

**驗收**：build 後這些日子不再以紅色「停課」呈現、也不會關閉當天課程；以「備註（暫定·待確認）」顯示。維護指南需說明如何把某天確認為停課。

---

## 任務 F — 新增「維護指南.md」

**目標**：給非工程使用者一份「要改某項 → 改哪個檔、哪一欄、哪一列、改完怎麼重建發布」的速查。

**改動**：在 repo 根目錄新增 `維護指南.md`，至少涵蓋：
- 重建與發布步驟（`node tools/build.mjs` → 預覽 → 發布腳本）。
- 改高名模考日期/範圍 → `data/高名模考.csv` 對應列（哪些欄：date、range、official_date…）。
- 停課／國定假日：在 `data/特殊日.csv` 新增或修改；如何把「暫定」確認為「停課」（type 改 `停課`）、照常上課則刪該列。
- 改網頁公布範圍 → `data/設定.csv` 的「公布截止日」；改紙本 → 「紙本公布截止日」。
- 新增各校段考／畢旅／重要日程 → `data/重要日程.csv`（欄位 date_start,date_end,title,notes）。
- 改複習卷進度 → `data/複習卷進度.csv`（範圍由 `複習卷清單.csv` 自動帶）。
- 改每週課表 → `data/課表.csv`。
- BOM 與 CSV 編碼注意事項。

**驗收**：`維護指南.md` 存在、條列清楚、每項都指到正確檔案與欄位。

---

## 任務 G —（待使用者提供）匯入「過去的考程表」

**狀態：阻塞中**——目前 repo（含 `data/`、上層 `H:\班務`）找不到該檔。使用者需把考程表檔案（圖片/PDF/Excel/CSV）放進 repo（例如 `data/` 或新建 `來源資料/`）或提供路徑。
拿到後：解析成適當 CSV（學校段考類 → `data/重要日程.csv`；若是模考類 → `data/高名模考.csv`），再 build。先不要動。

---

## 完成後

- `node tools/build.mjs` 重建並確認無新的警告（既有模考週警告屬正常）。
- `node tools/serve.mjs` 本機預覽：列表、月曆彈窗、今天按鈕、公布邊界提示、紙本月份都正確。
- 更新 `工作紀錄.md`（修改紀錄＋待辦），`CLAUDE.md`／`README.md` 補上「公布截止日／紙本公布截止日」設定說明。
