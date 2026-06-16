#!/usr/bin/env node
// 產生器：讀取 data/*.csv → 產出 docs/events.json
// 用法：node tools/build.mjs
// 行事曆只顯示三大類：暑訓（含暑訓模考）、複習卷＋高名模考、重要日程（含停課與備註）。
// 每週固定課表（正課、測驗及輔導等）不上行事曆，改由網頁的「課表」視窗顯示（資料一樣來自 課表.csv）。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- CSV 解析（RFC4180，支援引號內逗號與換行） ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, ""); // 去 BOM
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const DATE_FIELDS = new Set(["date", "date_start", "date_end", "official_date"]);

function normalizeDate(value) {
  const m = String(value || "").trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return value;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function normalizeRowDates(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, DATE_FIELDS.has(key) ? normalizeDate(value) : value])
  );
}

const readData = (name) => parseCSV(readFileSync(join(ROOT, "data", name), "utf8")).map(normalizeRowDates);

// ---------- 讀取資料 ----------
const config = Object.fromEntries(readData("設定.csv").map((r) => [r.key, r.value]));
const timetable = readData("課表.csv");
const selfStudy = readData("暑訓進度.csv");
const specialDays = readData("特殊日.csv");
const reviewCatalog = readData("複習卷清單.csv");
const reviewSchedule = readData("複習卷進度.csv");
const importantDays = readData("重要日程.csv");
const mockExams = readData("高名模考.csv");

const START = config["課表生效日"];
const END = config["行事曆結束日"];
if (!START || !END) throw new Error("設定.csv 缺少 課表生效日 或 行事曆結束日");
const PUBLISH_THROUGH = config["公布截止日"] || END;
const EFFECTIVE_END = PUBLISH_THROUGH < END ? PUBLISH_THROUGH : END;
const PRINT_THROUGH = config["紙本公布截止日"] || PUBLISH_THROUGH;

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};
const weekdayOf = (iso) => WEEKDAYS[new Date(iso + "T00:00:00Z").getUTCDay()];

// 停課區間
const closures = specialDays.filter((r) => r.type === "停課");
const isClosed = (iso) => closures.some((c) => iso >= c.date_start && iso <= (c.date_end || c.date_start));

const events = [];

// ---------- 1. 複習卷進度 ----------
const catalogIndex = new Map(reviewCatalog.map((r) => [`${r.subject}|${Number(r.round_no)}`, r]));
const missingRounds = [];
for (const r of reviewSchedule) {
  const cat = catalogIndex.get(`${r.subject}|${Number(r.round_no)}`);
  if (!cat) { missingRounds.push(`${r.subject} 第${r.round_no}回`); continue; }
  const scope = cat.chapter_or_scope || cat.scope_detail || "";
  events.push({
    title: `${r.subject}複習卷 ${cat.round_label}`,
    start: `${r.date}T${r.start_time}`,
    end: `${r.date}T${r.end_time}`,
    type: "複習卷",
    subject: r.subject,
    detail: [cat.book_range && `冊別：${cat.book_range}`, scope && `範圍：${scope}`, cat.scope_detail && cat.scope_detail !== scope && `內容：${cat.scope_detail}`, r.notes && `備註：${r.notes}`].filter(Boolean).join("\n"),
  });
}
if (missingRounds.length) console.warn("⚠️ 複習卷進度有對不到清單的回次：", missingRounds.join("、"));

// 暑訓模考科目順序與範圍（一國二英三數四自五社）
const MOCK_SUBJECTS = [
  { subject: "國文", range: "B1~B2" },
  { subject: "英文", range: "B1~B2" },
  { subject: "數學", range: "B1~B2" },
  { subject: "自然", range: "B1~B3" },
  { subject: "社會", range: "B1~B2" },
];

// ---------- 2. 高名模考（全班，一～五晚上「測驗及輔導／輔測」時段） ----------
// 每回官方日期為週日，本班提前於該週一～五考完（一國二英三數四自五社），逐場日期在 data/高名模考.csv
for (const r of mockExams) {
  const wd = weekdayOf(r.date);
  const slot = timetable.find((t) => t.weekday === wd && (t.activity === "測驗及輔導" || t.activity === "輔測"));
  const startT = slot ? slot.start_time : "19:30";
  const endT = slot ? slot.end_time : "20:30";
  if (isClosed(r.date)) console.warn(`⚠️ 高名模考 ${r.date} ${r.subject}（${r.round_label}）落在停課日，請調整 高名模考.csv`);
  events.push({
    title: `${r.subject}高名模考 ${r.round_label}（${r.range}）`,
    start: `${r.date}T${startT}`,
    end: `${r.date}T${endT}`,
    type: "高名模考",
    subject: r.subject,
    detail: [
      `範圍：${r.range}`,
      r.paper_provider && `卷別：${r.paper_provider}`,
      r.official_date && `官方模考日 ${r.official_date}（${weekdayOf(r.official_date)}），本班提前於當週一～五晚上測驗及輔導時段考完`,
      r.notes && `備註：${r.notes}`,
      "（日期若調整，改 data/高名模考.csv 對應列）",
    ].filter(Boolean).join("\n"),
  });
}

// 模考那週（一～五）不排複習卷；週六照常（既有決策）。違反時提醒。
const mondayOf = (iso) => addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
const mockWeeks = new Set(mockExams.map((r) => mondayOf(r.date)));
for (const r of reviewSchedule) {
  const dow = new Date(r.date + "T00:00:00Z").getUTCDay();
  if (dow >= 1 && dow <= 5 && mockWeeks.has(mondayOf(r.date))) {
    console.warn(`⚠️ 複習卷 ${r.date} ${r.subject} 第${r.round_no}回 落在高名模考週（模考週一～五不考複習卷）`);
  }
}

// ---------- 3. 暑訓進度（全天標籤，不標時間；時間放詳情與課表視窗） ----------
for (const r of selfStudy) {
  if (isClosed(r.date)) continue;
  events.push({
    title: `${r.subject}暑訓 ${r.book_range}`,
    start: r.date,
    end: addDays(r.date, 1), // FullCalendar 全天事件 end 為「不含」
    allDay: true,
    type: "暑訓",
    subject: r.subject,
    detail: [`時間：${r.start_time}～${r.end_time}（僅參加暑訓的學生）`, `冊別：${r.book_range}`, r.notes && `備註：${r.notes}`].filter(Boolean).join("\n"),
  });
}

// ---------- 4. 暑訓模考週（僅暑訓學生，下午暑訓時段） ----------
const summerMockStart = config["暑訓模考週開始"];
if (summerMockStart) {
  const t1 = config["暑訓模考開始時間"] || "16:00";
  const t2 = config["暑訓模考結束時間"] || "17:30";
  MOCK_SUBJECTS.forEach((m, i) => {
    const d = addDays(summerMockStart, i);
    if (isClosed(d)) return;
    events.push({
      title: `${m.subject}暑訓模考（${m.range}）`,
      start: d,
      end: addDays(d, 1),
      allDay: true,
      type: "暑訓",
      subject: m.subject,
      detail: `時間：${t1}～${t2}（僅參加暑訓的學生）\n範圍：${m.range}\n（暑訓模考週日期若調整，改 設定.csv 的「暑訓模考週開始」）`,
    });
  });
}

// ---------- 5. 特殊日（停課、備註） ----------
for (const r of specialDays) {
  const end = r.date_end || r.date_start;
  events.push({
    title: r.title,
    start: r.date_start,
    end: addDays(end, 1),
    allDay: true,
    type: r.type === "停課" ? "停課" : "備註",
    subject: "",
    detail: r.notes || "",
  });
}

// ---------- 6. 重要日程（各校段考、學校模考、畢旅、特殊節日等） ----------
for (const r of importantDays) {
  if (!r.date_start || !r.title) continue;
  const end = r.date_end || r.date_start;
  events.push({
    title: r.title,
    start: r.date_start,
    end: addDays(end, 1),
    allDay: true,
    type: "重要日程",
    subject: "",
    detail: r.notes || "",
  });
}

events.sort((a, b) => (a.start < b.start ? -1 : 1));
const publishedEvents = events.filter((e) => String(e.start).slice(0, 10) <= EFFECTIVE_END);

// ---------- 課表視窗資料（每週固定課表＋暑訓時段說明） ----------
const summerDates = selfStudy.map((r) => r.date).sort();
const summer_info = selfStudy.length
  ? {
      start: summerDates[0],
      end: summerDates[summerDates.length - 1],
      time: `${selfStudy[0].start_time}～${selfStudy[0].end_time}`,
      mock_week_start: summerMockStart || "",
      mock_time: `${config["暑訓模考開始時間"] || "16:00"}～${config["暑訓模考結束時間"] || "17:30"}`,
    }
  : null;

const out = {
  site_title: config["網站標題"] || "班級行事曆",
  generated_at: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }),
  range: { start: START, end: EFFECTIVE_END },
  full_end: END,
  publish_through: PUBLISH_THROUGH,
  print_through: PRINT_THROUGH,
  timetable,
  summer_info,
  events: publishedEvents,
};
writeFileSync(join(ROOT, "docs", "events.json"), JSON.stringify(out, null, 1), "utf8");
console.log(`✅ 已產出 docs/events.json：已公布至 ${EFFECTIVE_END}（完整排程至 ${END}），公布 ${publishedEvents.length}/${events.length} 筆事件`);
