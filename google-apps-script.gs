/* ===================================================================
   NDYLens — Apps Script backend
   -------------------------------------------------------------------
   The site is a static build on GitHub Pages, so there is no server
   and no database. This Web App is both. It handles three jobs:

     1. LEADS   — early-access form submissions  -> "Leads" sheet + email
     2. EVENTS  — funnel tracking (views, clicks, drop-off) -> "Events"
     3. SPOTS   — a public read of how many of the places are gone

   DEPLOY: Deploy > New deployment > Web app
           Execute as:  Me
           Who has access:  Anyone
           Then paste the /exec URL into script.js (SHEETS_WEB_APP_URL).
   Re-deploy after every edit or the live site keeps the old version.
   =================================================================== */

/* PASTE YOUR SHEET ID HERE. It is the long string in the sheet's URL:
   docs.google.com/spreadsheets/d/<THIS_BIT>/edit
   Leave it as "" if this script is bound to the sheet (Extensions >
   Apps Script from inside the sheet) — it will find the sheet itself. */
const SPREADSHEET_ID = "1iw-9opuQ1NpW7T5o1-6sruuGHKzxPrMsaut6YUqLQR0";
const SHEET_NAME = "Leads";
const EVENTS_SHEET_NAME = "Events";
const DASHBOARD_SHEET_NAME = "Dashboard";

/* Total early-access places. This is the single source of truth — the
   emails and the website counter both read from it. */
const TOTAL_SPOTS = 450;

/* Statuses that free a spot back up. Anything else counts as taken. */
const NON_COUNTING_STATUSES = ["rejected", "withdrawn", "declined", "duplicate", "test"];

// ── Lead email notification ──────────────────────────────────────────────
// Every new lead emails NOTIFY_TO, copying NOTIFY_CC. Comma-separated, no spaces issues.
const NOTIFY_TO = "connect@ndylens.com";
const NOTIFY_CC = "victorakan70@gmail.com,obidinmadumebi@gmail.com";

/* NOTE: "status" and "notes" are appended at the END on purpose.
   Inserting them mid-list would shift every existing row's data. */
const HEADERS = [
  "timestamp",
  "firstName",
  "lastName",
  "phoneNumber",
  "email",
  "businessName",
  "businessLocation",
  "businessAge",
  "photographyType",
  "clientCount",
  "currentWorkflow",
  "needs",
  "interestLevel",
  "message",
  "pageUrl",
  "sourceBucket",
  "sourceDetail",
  "firstTouchUtmSource",
  "firstTouchUtmMedium",
  "firstTouchUtmCampaign",
  "lastTouchSourceBucket",
  "lastTouchSourceDetail",
  "lastTouchUtmSource",
  "lastTouchUtmMedium",
  "lastTouchUtmCampaign",
  "lastTouchUtmContent",
  "lastTouchUtmTerm",
  "referrer",
  "landingPage",
  "sessionId",
  "status",
  "notes",
];

const EVENT_HEADERS = [
  "timestamp",
  "event",
  "sessionId",
  "visitorId",
  "isNewVisitor",
  "page",
  "sourceBucket",
  "sourceDetail",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "referrer",
  "device",
  "viewport",
  "detail",
];

/* ===================================================================
   SHEET HELPERS
   =================================================================== */

function getSpreadsheet_() {
  // Try the explicit id first, then fall back to the sheet this script is
  // bound to. A stale id was throwing "You do not have permission to access
  // the requested document", which reads like an auth problem but is really
  // just an id pointing at a different sheet.
  if (SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      // fall through to the bound sheet
    }
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error(
    "Cannot open the spreadsheet. Either set SPREADSHEET_ID to the id in your " +
    "sheet's URL, or create this script from inside the sheet via " +
    "Extensions > Apps Script so it is bound to it."
  );
}

function getTargetSheet_() {
  const ss = getSpreadsheet_();
  if (SHEET_NAME) {
    const namedSheet = ss.getSheetByName(SHEET_NAME);
    if (namedSheet) {
      return namedSheet;
    }
  }
  return ss.getSheets()[0];
}

function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function ensureHeader_(sheet) {
  const firstRowRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const firstRow = firstRowRange.getValues()[0];
  const hasAnyHeaderValue = firstRow.some((cell) => String(cell || "").trim());

  if (!hasAnyHeaderValue) {
    firstRowRange.setValues([HEADERS]);
    return;
  }

  // Keep row 1 aligned to the expected schema when columns were added later.
  const headerMismatch = HEADERS.some(
    (header, index) => String(firstRow[index] || "").trim() !== header
  );
  if (headerMismatch) {
    firstRowRange.setValues([HEADERS]);
  }
}

/* ===================================================================
   SPOTS — how many of the places are gone
   Cached for 60s so a burst of traffic doesn't re-read the sheet on
   every single page load.
   =================================================================== */

function countTakenSpots_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("spots_taken");
  if (cached !== null) return Number(cached);

  const sheet = getTargetSheet_();
  const lastRow = sheet.getLastRow();
  let taken = 0;

  if (lastRow > 1) {
    const statusCol = HEADERS.indexOf("status") + 1;
    const emailCol = HEADERS.indexOf("email") + 1;
    const width = Math.max(statusCol, emailCol);
    const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const seen = {};

    values.forEach(function (row) {
      const email = String(row[emailCol - 1] || "").trim().toLowerCase();
      const status = String(row[statusCol - 1] || "").trim().toLowerCase();
      if (NON_COUNTING_STATUSES.indexOf(status) !== -1) return;
      // An empty row is not an application.
      if (!email) return;
      // Someone applying twice does not use up two spots.
      if (seen[email]) return;
      seen[email] = true;
      taken++;
    });
  }

  cache.put("spots_taken", String(taken), 60);
  return taken;
}

function spotsPayload_() {
  const taken = countTakenSpots_();
  const remaining = Math.max(0, TOTAL_SPOTS - taken);
  return {
    ok: true,
    total: TOTAL_SPOTS,
    taken: Math.min(taken, TOTAL_SPOTS),
    remaining: remaining,
    soldOut: remaining <= 0,
  };
}

/* ===================================================================
   EVENTS — funnel tracking
   The client batches events, so one request usually carries several.
   =================================================================== */

function appendEvents_(events) {
  if (!events || !events.length) return 0;

  const sheet = getOrCreateSheet_(EVENTS_SHEET_NAME, EVENT_HEADERS);
  const rows = events.map(function (e) {
    return EVENT_HEADERS.map(function (h) {
      const v = e[h];
      if (v === undefined || v === null) return "";
      // "detail" can be an object — flatten it so the cell stays readable.
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    });
  });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length)
      .setValues(rows);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
  return rows.length;
}

/* ===================================================================
   LEAD EMAIL
   =================================================================== */

function notifyLead_(data) {
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || "New lead";
  const biz = data.businessName ? " — " + data.businessName : "";

  let spotLine = "";
  try {
    const s = spotsPayload_();
    spotLine = s.taken + " of " + s.total + " spots taken";
  } catch (e) {}

  const subject = "🎯 New NDYLens lead: " + name + biz;

  const source =
    (data.sourceBucket || "") +
    (data.sourceDetail ? " (" + data.sourceDetail + ")" : "");

  const rows = [
    ["Name", name],
    ["Phone (WhatsApp)", data.phoneNumber],
    ["Email", data.email],
    ["Studio", data.businessName],
    ["Location", data.businessLocation],
    ["Business age", data.businessAge],
    ["Photography type", data.photographyType],
    ["Approx. clients", data.clientCount],
    ["Current workflow", data.currentWorkflow],
    ["What they want help with", data.needs || data.message],
    ["Interest level", data.interestLevel],
    ["Source", source],
    ["Page", data.pageUrl],
    ["Referrer", data.referrer],
    ["Spots", spotLine],
    ["Submitted", data.timestamp || new Date().toISOString()],
  ];

  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const cells = rows
    .map(function (r) {
      const val = r[1] ? esc(r[1]).replace(/\n/g, "<br>") : "&mdash;";
      return (
        '<tr>' +
        '<td style="padding:6px 14px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap"><b>' +
        r[0] +
        "</b></td>" +
        '<td style="padding:6px 0;color:#111827">' +
        val +
        "</td></tr>"
      );
    })
    .join("");

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827">' +
    '<h2 style="margin:0 0 4px;font-size:18px">New lead from ndylens.com</h2>' +
    '<p style="margin:0 0 16px;color:#6b7280">A photographer just requested to get started.</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
    cells +
    "</table>" +
    (data.phoneNumber
      ? '<p style="margin:18px 0 0"><a href="https://wa.me/' +
        String(data.phoneNumber).replace(/[^0-9]/g, "") +
        '" style="background:#2ABFAA;color:#04211d;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;display:inline-block">Message on WhatsApp</a></p>'
      : "") +
    "</div>";

  const plain = rows.map((r) => r[0] + ": " + (r[1] || "-")).join("\n");

  MailApp.sendEmail({
    to: NOTIFY_TO,
    cc: NOTIFY_CC,
    subject: subject,
    htmlBody: html,
    body: plain,
    name: "NDYLens Leads",
    replyTo: data.email || NOTIFY_TO,
  });
}

/* ===================================================================
   APPLICANT CONFIRMATION
   Sent to the address on the form, so they know it arrived and know
   what happens next. Separate from the team notification: different
   audience, different tone, and a failure in one must not block the
   other or the sheet write.
   =================================================================== */

const BRAND_TEAL = "#2ABFAA";
const SIG_BG = "#2B3541";        // the dark card in the app's signature
const SIG_PANEL = "#2ABFAA";
const REPLY_TO = "connect@ndylens.com";
const SITE_URL = "https://www.ndylens.com";

/* NOTE: the CRM's signature uses a different number from the one in the
   website footer (+234 701 462 4100). This is the support line shown in the
   app, kept separate so changing one does not silently change the other. */
const SUPPORT_PHONE = "+234 803 069 9700";
const SUPPORT_PHONE_TEL = "+2348030699700";
const WHATSAPP_NUMBER = "+234 701 462 4100";
const WHATSAPP_LINK = "https://wa.me/2347014624100";

function brandSignature_() {
  // Matches the signature card used in the NDYLens CRM: dark slate panel,
  // teal wordmark accent, support line and address.
  //
  // Built from nested tables with inline styles and bgcolor rather than a
  // single image. An image would match the app pixel-for-pixel, but most
  // clients block remote images by default, and a signature that renders as
  // a grey box is worse than one that is merely close. Everything here shows
  // even with images off.
  return (
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
      'style="border-collapse:collapse;margin-top:30px;max-width:520px">' +
      '<tr><td bgcolor="' + SIG_BG + '" style="background:' + SIG_BG + ';' +
        'border-radius:10px;padding:22px 24px">' +

        '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">' +

          // wordmark
          '<tr><td style="padding-bottom:4px">' +
            '<span style="font-family:Arial,Helvetica,sans-serif;font-size:21px;' +
              'font-weight:bold;color:#ffffff;letter-spacing:-.01em">NDYLens</span>' +
            '<span style="font-family:Arial,Helvetica,sans-serif;font-size:21px;' +
              'font-weight:bold;color:' + SIG_PANEL + ';letter-spacing:-.01em"> Team</span>' +
          '</td></tr>' +

          '<tr><td style="padding-bottom:16px">' +
            '<span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;' +
              'letter-spacing:.14em;color:#93A3AF">CUSTOMER SUPPORT</span>' +
          '</td></tr>' +

          // rule
          '<tr><td style="padding-bottom:14px">' +
            '<table cellpadding="0" cellspacing="0" border="0" width="46"><tr>' +
            '<td bgcolor="' + SIG_PANEL + '" height="2" style="line-height:2px;font-size:0">&nbsp;</td>' +
            '</tr></table>' +
          '</td></tr>' +

          // contact
          '<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;' +
            'line-height:1.9;color:#C9D4DC">' +
            '<a href="tel:' + SUPPORT_PHONE_TEL + '" style="color:#C9D4DC;text-decoration:none">' +
              SUPPORT_PHONE + '</a><br>' +
            '<a href="mailto:' + REPLY_TO + '" style="color:' + SIG_PANEL + ';text-decoration:none">' +
              REPLY_TO + '</a>' +
          '</td></tr>' +

        '</table>' +
      '</td></tr>' +

      // footer line under the card
      '<tr><td align="center" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;' +
        'font-size:11.5px;color:#93A3AF">' +
        '&copy; NDYLens &nbsp;&middot;&nbsp; ' +
        '<a href="mailto:' + REPLY_TO + '" style="color:#93A3AF;text-decoration:underline">' +
          REPLY_TO + '</a>' +
      '</td></tr>' +
    '</table>'
  );
}

function spotsSentence_() {
  // Written once and reused by both email bodies. Reads the live count rather
  // than repeating a hardcoded number, so it stays true when TOTAL_SPOTS
  // changes and reflects the spot this applicant has just taken — doPost
  // clears the cache before the emails go out.
  try {
    const s = spotsPayload_();
    if (s.soldOut) {
      return "All " + s.total + " early-access spots have now been taken.";
    }
    return s.remaining + " of " + s.total + " early-access spots are left.";
  } catch (e) {
    return "";   // never let a counting problem block the email
  }
}

function notifyApplicant_(data) {
  const to = String(data.email || "").trim();
  if (!to || to.indexOf("@") === -1) return;   // nothing to send to

  const first = String(data.firstName || "").trim() || "there";
  const studio = String(data.businessName || "").trim();
  const spotsLine = spotsSentence_();

  const esc = function (v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#16241f;max-width:560px">' +
      '<p style="margin:0 0 16px">Hi ' + esc(first) + ',</p>' +
      '<p style="margin:0 0 16px">Thanks for applying for NDYLens early access' +
        (studio ? ' for <b>' + esc(studio) + '</b>' : '') + '. We have your application.</p>' +

      '<div style="background:#f2f8f6;border-left:3px solid ' + BRAND_TEAL + ';padding:16px 20px;margin:0 0 20px">' +
        '<div style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#5b6b66">Your place</div>' +
        '<div style="font-size:19px;font-weight:bold;margin-top:4px;color:#0f1f1b">&#8358;15,600 for 6 months</div>' +
        '<div style="font-size:13px;color:#5b6b66;margin-top:2px">60% off our &#8358;39,000 quarterly price</div>' +
      '</div>' +

      '<p style="margin:0 0 10px"><b>What happens next</b></p>' +
      '<p style="margin:0 0 16px">Someone from our team will reach out on WhatsApp or by email with the ' +
      'payment step and to get your account set up. We work through applications in the order ' +
      'they arrive.' + (spotsLine ? ' ' + spotsLine : '') + '</p>' +

      '<p style="margin:0 0 16px">If anything changes, or you have a question in the meantime, just ' +
      'reply to this email or message us on ' +
      '<a href="' + WHATSAPP_LINK + '" style="color:' + BRAND_TEAL + ';text-decoration:none">WhatsApp</a>.</p>' +

      '<p style="margin:0">Glad to have you early.</p>' +
      brandSignature_() +
    '</div>';

  const plain =
    "Hi " + first + ",\n\n" +
    "Thanks for applying for NDYLens early access" + (studio ? " for " + studio : "") +
    ". We have your application.\n\n" +
    "YOUR PLACE\n" +
    "NGN 15,600 for 6 months - 60% off our NGN 39,000 quarterly price\n\n" +
    "WHAT HAPPENS NEXT\n" +
    "Someone from our team will reach out on WhatsApp or by email with the payment step " +
    "and to get your account set up. We work through applications in the order they arrive." +
    (spotsLine ? " " + spotsLine : "") + "\n\n" +
    "If anything changes, or you have a question in the meantime, just reply to this email " +
    "or message us on WhatsApp: " + WHATSAPP_NUMBER + "\n\n" +
    "Glad to have you early.\n\n" +
    "--\nNDYLens Team | Customer Support\n" +
    SUPPORT_PHONE + "\n" + REPLY_TO + "\n" + SITE_URL + "\n";

  MailApp.sendEmail({
    to: to,
    subject: "We've got your NDYLens early-access application",
    htmlBody: html,
    body: plain,
    name: "NDYLens",
    replyTo: REPLY_TO,
  });
}

/* ===================================================================
   ROUTING
   =================================================================== */

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function jsonpOut_(callback, obj) {
  // Only allow a plain JS identifier as the callback name.
  const safe = String(callback || "").replace(/[^A-Za-z0-9_$.]/g, "");
  if (!safe) return jsonOut_(obj);
  return ContentService.createTextOutput(
    safe + "(" + JSON.stringify(obj) + ");"
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || "{}";
    const data = JSON.parse(raw);

    // ── Event batch ────────────────────────────────────────────────
    if (data.type === "events" || data.type === "event") {
      const batch = data.batch && data.batch.length ? data.batch : [data];
      const written = appendEvents_(batch);
      return jsonOut_({ ok: true, written: written });
    }

    // ── Lead (default — keeps the original contract) ───────────────
    const sheet = getTargetSheet_();
    ensureHeader_(sheet);

    if (!data.status) data.status = "applied";
    const row = HEADERS.map((header) => data[header] || "");
    if (!row[0]) {
      row[0] = new Date().toISOString();
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      sheet.appendRow(row);
    } finally {
      try { lock.releaseLock(); } catch (err) {}
    }

    // A new lead changes the spot count, so drop the cached value.
    try { CacheService.getScriptCache().remove("spots_taken"); } catch (err) {}

    // Both emails are best-effort and independently guarded: the row is
    // already saved, and one failing must not stop the other.
    try {
      notifyLead_(data);
    } catch (mailErr) {
      console.error("Team notification failed: " + mailErr);
    }
    try {
      notifyApplicant_(data);
    } catch (mailErr) {
      console.error("Applicant confirmation failed: " + mailErr);
    }

    return jsonOut_({ ok: true, message: "Row inserted", spots: spotsPayload_() });
  } catch (error) {
    return jsonOut_({ ok: false, error: String(error) });
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || "";
  const callback = params.callback || "";

  try {
    if (action === "spots") {
      return jsonpOut_(callback, spotsPayload_());
    }
    if (action === "funnel") {
      return jsonpOut_(callback, funnelSummary_());
    }
    return jsonpOut_(callback, { ok: true, message: "Apps Script is live" });
  } catch (error) {
    return jsonpOut_(callback, { ok: false, error: String(error) });
  }
}

/* ===================================================================
   FUNNEL SUMMARY + DASHBOARD
   Run rebuildDashboard() manually, or attach it to a daily trigger:
   Triggers > Add trigger > rebuildDashboard > Time-driven > Day timer
   =================================================================== */

function funnelSummary_() {
  const ss = getSpreadsheet_();
  const ev = ss.getSheetByName(EVENTS_SHEET_NAME);
  const summary = {
    ok: true,
    sessions: 0,
    landingViews: 0,
    ctaClicks: 0,
    formViews: 0,
    formStarts: 0,
    submissions: 0,
    bySource: {},
  };
  if (!ev || ev.getLastRow() < 2) return summary;

  const rows = ev
    .getRange(2, 1, ev.getLastRow() - 1, EVENT_HEADERS.length)
    .getValues();
  const iEvent = EVENT_HEADERS.indexOf("event");
  const iSession = EVENT_HEADERS.indexOf("sessionId");
  const iSource = EVENT_HEADERS.indexOf("sourceBucket");

  const sessions = {};
  const uniq = { page_view: {}, cta_click: {}, form_view: {}, form_start: {}, form_submit_ok: {} };

  rows.forEach(function (r) {
    const name = String(r[iEvent] || "");
    const sid = String(r[iSession] || "");
    const src = String(r[iSource] || "direct") || "direct";
    if (sid) sessions[sid] = true;

    if (uniq[name] && sid && !uniq[name][sid]) {
      uniq[name][sid] = true;
      if (!summary.bySource[src]) {
        summary.bySource[src] = { views: 0, ctaClicks: 0, formViews: 0, formStarts: 0, submissions: 0 };
      }
      if (name === "page_view") summary.bySource[src].views++;
      if (name === "cta_click") summary.bySource[src].ctaClicks++;
      if (name === "form_view") summary.bySource[src].formViews++;
      if (name === "form_start") summary.bySource[src].formStarts++;
      if (name === "form_submit_ok") summary.bySource[src].submissions++;
    }
  });

  summary.sessions = Object.keys(sessions).length;
  summary.landingViews = Object.keys(uniq.page_view).length;
  summary.ctaClicks = Object.keys(uniq.cta_click).length;
  summary.formViews = Object.keys(uniq.form_view).length;
  summary.formStarts = Object.keys(uniq.form_start).length;
  summary.submissions = Object.keys(uniq.form_submit_ok).length;
  return summary;
}

function rebuildDashboard() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(DASHBOARD_SHEET_NAME);
  sh.clear();

  const f = funnelSummary_();
  const s = spotsPayload_();

  const pct = function (n, d) {
    return d ? Math.round((n / d) * 1000) / 10 + "%" : "—";
  };

  const out = [
    ["NDYLens — early access", ""],
    ["Last rebuilt", new Date()],
    ["", ""],
    ["SPOTS", ""],
    ["Taken", s.taken],
    ["Remaining", s.remaining],
    ["Total", s.total],
    ["", ""],
    ["FUNNEL (unique sessions)", ""],
    ["1. Viewed the site", f.landingViews],
    ["2. Clicked a CTA", f.ctaClicks + "  (" + pct(f.ctaClicks, f.landingViews) + " of viewers)"],
    ["3. Reached the form", f.formViews + "  (" + pct(f.formViews, f.ctaClicks) + " of clickers)"],
    ["4. Started filling it", f.formStarts + "  (" + pct(f.formStarts, f.formViews) + " of form views)"],
    ["5. Submitted", f.submissions + "  (" + pct(f.submissions, f.formStarts) + " of starters)"],
    ["", ""],
    ["End-to-end conversion", pct(f.submissions, f.landingViews)],
    ["Biggest drop-off", biggestDrop_(f)],
    ["", ""],
    ["BY TRAFFIC SOURCE", ""],
    ["Source", "Views", "CTA clicks", "Form views", "Form starts", "Submitted", "View→Submit"],
  ];

  Object.keys(f.bySource)
    .sort(function (a, b) { return f.bySource[b].views - f.bySource[a].views; })
    .forEach(function (k) {
      const r = f.bySource[k];
      out.push([k, r.views, r.ctaClicks, r.formViews, r.formStarts, r.submissions, pct(r.submissions, r.views)]);
    });

  const width = 7;
  const padded = out.map(function (r) {
    const copy = r.slice();
    while (copy.length < width) copy.push("");
    return copy;
  });

  sh.getRange(1, 1, padded.length, width).setValues(padded);
  sh.getRange(1, 1, 1, width).setFontSize(14).setFontWeight("bold");
  [4, 9, 20].forEach(function (row) {
    sh.getRange(row, 1, 1, width).setFontWeight("bold");
  });
  sh.getRange(21, 1, 1, width).setFontWeight("bold");
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 120);
  return "Dashboard rebuilt";
}

function biggestDrop_(f) {
  const steps = [
    ["site → CTA click", f.landingViews, f.ctaClicks],
    ["CTA click → form", f.ctaClicks, f.formViews],
    ["form view → start", f.formViews, f.formStarts],
    ["start → submit", f.formStarts, f.submissions],
  ];
  let worst = "—";
  let worstLoss = -1;
  steps.forEach(function (s) {
    if (!s[1]) return;
    const loss = (s[1] - s[2]) / s[1];
    if (loss > worstLoss) {
      worstLoss = loss;
      worst = s[0] + " (lost " + Math.round(loss * 100) + "%)";
    }
  });
  return worst;
}

/* ===================================================================
   MANUAL HELPERS — run these once from the editor
   =================================================================== */

// Grants the Gmail permission and confirms the notification looks right.
function testLeadEmail() {
  notifyLead_({
    firstName: "Test",
    lastName: "Lead",
    phoneNumber: "+2348012345678",
    email: "test@example.com",
    businessName: "Test Studio",
    businessLocation: "Lagos",
    message: "This is a test of the lead notification email.",
    sourceBucket: "instagram",
    sourceDetail: "instagram.com",
    pageUrl: "https://www.ndylens.com/",
    referrer: "https://instagram.com/",
    timestamp: new Date().toISOString(),
  });
}

// Sends the applicant confirmation to you, so you can check how it looks.
// Change the email below to your own address before running.
function testApplicantEmail() {
  notifyApplicant_({
    firstName: "Ada",
    businessName: "Ada Lens Studio",
    email: "victorakan70@gmail.com",
  });
}

// Confirms the spots endpoint reads the sheet correctly.
function testSpots() {
  Logger.log(JSON.stringify(spotsPayload_()));
}

// Confirms the funnel maths against whatever is in Events so far.
function testFunnel() {
  Logger.log(JSON.stringify(funnelSummary_(), null, 2));
}
