#!/usr/bin/env node
// 產生器：讀取 data/*.csv → 產出 docs/events.json
// 用法：node tools/build.mjs
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

const readData = (name) => parseCSV(readFileSync(join(ROOT, "data", name), "utf8"));

// ---------- 讀取資料 ----------
const config = Object.fromEntries(readData("設定.csv").map((r) => [r.key, r.value]));
const timetable = readData("課表.csv");
const selfStudy = readData("自修進度.csv");
const specialDays = readData("特殊日.csv");
const reviewCatalog = readData("複習卷清單.csv");
const reviewSchedule = readData("複習卷進度.csv");

const START = config["課表生效日"];
const END = config["行事曆結束日"];
if (!START || !END) throw new Error("設定.csv 缺少 課表生效日 或 行事曆結束日");

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

// ---------- 1. 複習卷進度（先建立，供課表去重） ----------
const catalogIndex = new Map(reviewCatalog.map((r) => [`${r.subject}|${Number(r.round_no)}`, r]));
const reviewSlots = new Set(); // "date|start_time" → 該時段已有複習卷，抑制課表的通用「測驗及輔導」
const missingRounds = [];
for (const r of reviewSchedule) {
  const cat = catalogIndex.get(`${r.subject}|${Number(r.round_no)}`);
  if (!cat) { missingRounds.push(`${r.subject} 第${r.round_no}回`); continue; }
  reviewSlots.add(`${r.date}|${r.start_time}`);
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

// ---------- 2. 每週固定課表（生效日起展開，跳過停課） ----------
for (let d = START; d <= END; d = addDays(d, 1)) {
  if (isClosed(d)) continue;
  const wd = weekdayOf(d);
  for (const row of timetable) {
    if (row.weekday !== wd) continue;
    if (row.activity === "休息") continue;
    // 該時段已排複習卷 → 不重複顯示通用的「測驗及輔導／輔測」
    if (!row.subject && reviewSlots.has(`${d}|${row.start_time}`)) continue;
    if (row.activity === "輔測" && reviewSlots.has(`${d}|${row.start_time}`)) continue;
    if (row.activity === "國社輔測" && reviewSlots.has(`${d}|${row.start_time}`)) continue;
    const title = row.subject ? `${row.subject} ${row.activity}` : row.activity;
    events.push({
      title,
      start: `${d}T${row.start_time}`,
      end: `${d}T${row.end_time}`,
      type: row.activity === "正課" ? "正課" : "測驗",
      subject: row.subject || "",
      detail: "",
    });
  }
}

// ---------- 3. 暑期自修進度 ----------
for (const r of selfStudy) {
  if (isClosed(r.date)) continue;
  events.push({
    title: `${r.subject}自修 ${r.book_range}`,
    start: `${r.date}T${r.start_time}`,
    end: `${r.date}T${r.end_time}`,
    type: "自修",
    subject: r.subject,
    detail: [`冊別：${r.book_range}`, r.notes && `備註：${r.notes}`].filter(Boolean).join("\n"),
  });
}

// ---------- 4. 模考週（由設定產生，定案改設定.csv 即可） ----------
const mockStart = config["模考週開始"];
if (mockStart) {
  const mockSubjects = [
    { subject: "國文", range: "B1~B2" },
    { subject: "英文", range: "B1~B2" },
    { subject: "數學", range: "B1~B2" },
    { subject: "自然", range: "B1~B3" },
    { subject: "社會", range: "B1~B2" },
  ];
  mockSubjects.forEach((m, i) => {
    const d = addDays(mockStart, i);
    events.push({
      title: `${m.subject}模考（${m.range}）`,
      start: `${d}T${config["模考開始時間"] || "16:00"}`,
      end: `${d}T${config["模考結束時間"] || "17:30"}`,
      type: "模考",
      subject: m.subject,
      detail: `範圍：${m.range}\n（模考週日期若調整，改 設定.csv 的「模考週開始」）`,
    });
  });
}

// ---------- 5. 特殊日（停課、備註） ----------
for (const r of specialDays) {
  const end = r.date_end || r.date_start;
  events.push({
    title: r.title,
    start: r.date_start,
    end: addDays(end, 1), // FullCalendar 全天事件 end 為「不含」
    allDay: true,
    type: r.type === "停課" ? "停課" : "備註",
    subject: "",
    detail: r.notes || "",
  });
}

events.sort((a, b) => (a.start < b.start ? -1 : 1));

const out = {
  site_title: config["網站標題"] || "班級行事曆",
  generated_at: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }),
  range: { start: START, end: END },
  events,
};
writeFileSync(join(ROOT, "docs", "events.json"), JSON.stringify(out, null, 1), "utf8");
console.log(`✅ 已產出 docs/events.json：共 ${events.length} 筆事件（${START} ~ ${END}）`);
