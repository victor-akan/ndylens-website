const SPREADSHEET_ID = "1ixMN1-EKFFm-Fxk26PdSOUOcQl-PIFA7RIqBsHBngiQ";
const SHEET_NAME = "Leads";
const HEADERS = [
  "timestamp",
  "firstName",
  "lastName",
  "phoneNumber",
  "email",
  "businessName",
  "businessLocation",
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
  "referredByName",
  "referredBySlug",
];

function getTargetSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (SHEET_NAME) {
    const namedSheet = ss.getSheetByName(SHEET_NAME);
    if (namedSheet) {
      return namedSheet;
    }
    throw new Error('Sheet "' + SHEET_NAME + '" was not found.');
  }
  return ss.getSheets()[0];
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

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || "{}";
    const data = JSON.parse(raw);
    const sheet = getTargetSheet_();

    ensureHeader_(sheet);
    const row = HEADERS.map((header) => data[header] || "");
    if (!row[0]) {
      row[0] = new Date().toISOString();
    }
    sheet.appendRow(row);

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, message: "Row inserted" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, message: "Apps Script is live" })
  ).setMimeType(ContentService.MimeType.JSON);
}
