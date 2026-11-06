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


// ── The sheet as it REALLY is, which is what the first version of this test got wrong ──────────
//
// That version used a clean 5-column fixture and passed happily. The live Leads sheet has 36
// columns, three of them orphans (AH/AI/AJ) left reading "status", "notes", "visitorId" from an
// older layout, and they HOLD DATA. Appending topNeed as the 34th entry would have made
// ensureHeader_ rename AH from "status" to "topNeed" while AH still held "applied", so the new
// column would have read "applied" for every historical row.
//
// A fixture that does not look like production proves nothing. This one does.
{
  const LIVE_HEADER = [
    'timestamp','firstName','lastName','phoneNumber','email','businessName','businessLocation',
    'businessAge','photographyType','clientCount','currentWorkflow','needs','interestLevel',
    'message','pageUrl','sourceBucket','sourceDetail','firstTouchUtmSource','firstTouchUtmMedium',
    'firstTouchUtmCampaign','lastTouchSourceBucket','lastTouchSourceDetail','lastTouchUtmSource',
    'lastTouchUtmMedium','lastTouchUtmCampaign','lastTouchUtmContent','lastTouchUtmTerm',
    'referrer','landingPage','sessionId','status','notes','visitorId',
    'status','notes','visitorId',                   // AH, AI, AJ: the orphans, as they are today
  ];
  let written = null;
  const sheet = {
    getMaxColumns: () => LIVE_HEADER.length,
    insertColumnsAfter: () => {},
    getRange: (r, c, nr, nc) => ({
      getValues: () => [LIVE_HEADER.slice(c - 1, c - 1 + nc)],
      setValues: (v) => { written = v[0]; },
    }),
  };
  const api3 = new Function(src + 'return { ensureHeader_, HEADERS };')();
  api3.ensureHeader_(sheet);

  const colOf = (n) => api3.HEADERS.indexOf(n);
  const letter = (i) => { let s = '', x = i + 1; while (x) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); } return s; };

  const okPlacement =
    letter(colOf('status')) === 'AE' &&            // unchanged, nothing moved
    letter(colOf('visitorId')) === 'AG' &&
    letter(colOf('topNeed')) === 'AK' &&           // past the orphans, onto an empty column
    colOf('legacyStatus') === 33;
  console.log('placement: status=' + letter(colOf('status')) +
              ' visitorId=' + letter(colOf('visitorId')) +
              ' topNeed=' + letter(colOf('topNeed')), okPlacement ? 'OK' : 'FAIL');

  // The actual regression: AH must NOT become topNeed.
  const ah = written ? written[33] : null;
  const okAH = ah !== 'topNeed';
  console.log('AH after rewrite: "' + ah + '"', okAH ? 'OK (not topNeed)' : 'FAIL - would relabel real status data');

  // And a new row must leave the orphans blank rather than writing into them.
  const row = api3.HEADERS.map((h) => ({ email: 'a@b.c', topNeed: 'Gallery delivery', status: 'applied' })[h] || '');
  const okRow = row[33] === '' && row[34] === '' && row[35] === ''
             && row[36] === 'Gallery delivery' && row[30] === 'applied';
  console.log('new row: AH/AI/AJ blank, AK=topNeed, AE=status', okRow ? 'OK' : 'FAIL');

  // No duplicate keys, or HEADERS.map would write the same value into two columns.
  const dupes = api3.HEADERS.filter((h, i) => api3.HEADERS.indexOf(h) !== i);
  console.log('duplicate header keys:', dupes.length ? dupes : 'none', dupes.length ? 'FAIL' : 'OK');

  if (!(okPlacement && okAH && okRow && !dupes.length)) process.exit(1);
}

process.exit(okCounts && okDash && Object.keys(empty).length === 0 ? 0 : 1);
