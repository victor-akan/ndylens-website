// Exercise the Apps Script additions outside Google by stubbing SpreadsheetApp.
// Worth doing because this file is deployed by hand-pasting, so a mistake here is
// found by a real applicant rather than by a build.
import fs from "fs";
const src = fs.readFileSync("google-apps-script.gs", "utf8");

const calls = { bold: [], setValues: null, cleared: false };
function makeSheet(header, rows) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => header.length,
    getMaxColumns: () => header.length,
    clear: () => { calls.cleared = true; },
    insertColumnsAfter: () => {},
    setColumnWidth: () => {},
    getRange: (r, c, nr, nc) => ({
      getValues: () => {
        if (r === 1) return [header.slice(c - 1, c - 1 + nc)];
        return rows.slice(r - 2, r - 2 + nr).map(row => row.slice(c - 1, c - 1 + nc));
      },
      setValues: (v) => { if (v.length > 5) calls.setValues = v; },
      setFontWeight: function () { if (nr === 1) calls.bold.push(r); return this; },
      setFontSize: function () { return this; },
    }),
  };
}

const HEADER = ["timestamp", "email", "needs", "visitorId", "topNeed"];
const ROWS = [
  ["t", "a@x.com", "A, B, C", "v1", "Gallery delivery"],
  ["t", "b@x.com", "A, B", "v2", "Gallery delivery"],
  ["t", "c@x.com", "A", "v3", "Managing bookings"],
  ["t", "d@x.com", "A, B", "v4", ""],            // applied before the question existed
];
const leads = makeSheet(HEADER, ROWS);
const dash = makeSheet(["x"], []);

globalThis.SpreadsheetApp = { openById: () => ({ getSheetByName: (n) => (n === "Leads" ? leads : dash), insertSheet: () => dash }) };

const shim = `
  function getSpreadsheet_() { return SpreadsheetApp.openById("x"); }
  function funnelSummary_() { return { landingViews: 10, ctaClicks: 5, formViews: 4, formStarts: 3, submissions: 2, bySource: { google: { views: 10, ctaClicks: 5, formViews: 4, formStarts: 3, submissions: 2 } } }; }
  function spotsPayload_() { return { taken: 2, remaining: 48, total: 50 }; }
  function biggestDrop_() { return "step 2"; }
  return { countTopNeeds_, rebuildDashboard };
`;
const api = new Function(src.replace(/^/, "") + shim)();

// 1. The tally
const counts = api.countTopNeeds_();
const okCounts = counts["Gallery delivery"] === 2 && counts["Managing bookings"] === 1
  && !("" in counts) && Object.keys(counts).length === 2;
console.log("tally:", JSON.stringify(counts), okCounts ? "OK" : "FAIL");

// 2. The dashboard block
api.rebuildDashboard();
const grid = calls.setValues;
const head = grid.findIndex(r => String(r[0]).startsWith("MOST URGENT NEED"));
const rank = grid.slice(head + 2, head + 4).map(r => [r[0], r[1], r[2]]);
const answered = grid.find(r => r[0] === "Answered");
const okDash = head > 0
  && rank[0][0] === "Gallery delivery" && rank[0][1] === 2 && rank[0][2] === "66.7%"
  && rank[1][0] === "Managing bookings" && rank[1][1] === 1
  && answered[1] === 3                                  // the blank row is excluded
  && calls.bold.includes(head + 1)                      // heading bolded at its real row
  && grid.every(r => r.length === 7);                   // every row padded to the sheet width
console.log("dashboard rows:", JSON.stringify(rank), "answered:", answered[1]);
console.log("bold rows:", JSON.stringify(calls.bold), "heading at", head + 1);
console.log("dashboard:", okDash ? "OK" : "FAIL");

// 3. Before anyone has answered, and before the column exists at all
globalThis.SpreadsheetApp = { openById: () => ({ getSheetByName: () => makeSheet(["timestamp", "email"], [["t", "a@x.com"]]), insertSheet: () => dash }) };
const api2 = new Function(src + shim)();
const empty = api2.countTopNeeds_();
console.log("no topNeed column:", JSON.stringify(empty), Object.keys(empty).length === 0 ? "OK" : "FAIL");

process.exit(okCounts && okDash && Object.keys(empty).length === 0 ? 0 : 1);
