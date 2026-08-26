# Early-access tracking

The site is static (GitHub Pages), so there is no server and no database.
The Google Apps Script Web App in `google-apps-script.gs` is both, writing to
one Google Sheet.

## One-time setup

1. Open the Sheet → **Extensions → Apps Script**.
2. Replace the script contents with `google-apps-script.gs`.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the `/exec` URL into `SHEETS_WEB_APP_URL` at the top of `script.js`.
5. Run `testSpots()` once from the editor to approve the permissions prompt.

**Re-deploy after every edit to the script** (Deploy → Manage deployments →
edit → New version). Saving alone does not update the live URL.

## What gets recorded

Three tabs, created automatically:

| Tab | Contents |
| --- | --- |
| `Leads` | One row per application. Unchanged from before, plus `sessionId`, `status`, `notes` appended at the end. |
| `Events` | One row per funnel event. |
| `Dashboard` | Funnel summary. Run `rebuildDashboard()` to refresh. |

Events captured:

| Event | Fires when |
| --- | --- |
| `page_view` | any page loads |
| `scroll_depth` | 25 / 50 / 75 / 100% of the landing page |
| `cta_click` | any "Get early access" button — the `detail` column says which one |
| `form_view` | the application page loads |
| `form_start` | first keystroke in any field |
| `form_step` | furthest section reached (1–3) |
| `form_validation_fail` | submit blocked — `detail` names the offending field |
| `form_abandon` | left without submitting — `detail` lists the still-empty required fields |
| `form_submit_ok` / `form_submit_error` | outcome of the submission |

Every event carries the traffic source, device, viewport, and a random
session id, so the funnel can be split by where people came from.

## The early-access spots

`TOTAL_SPOTS` (currently 450) is set in **two** places and they must agree:
`google-apps-script.gs` (authoritative) and `script.js` (fallback text only).

The count is `Leads` rows with a unique email, excluding any row whose
`status` is `rejected`, `withdrawn`, `declined`, `duplicate`, or `test`.
So to free a spot back up, type one of those into the `status` column.

The number is read by the page at load and rendered into any element with a
`data-spots` attribute. It is cached server-side for 60 seconds. If the fetch
fails the hard-coded fallback text stays on screen, so a broken endpoint never
shows a blank or a zero.

## Pipeline

The `status` column starts at `applied`. Overwrite it as people move along —
e.g. `contacted`, `paid`, `onboarded`. Only the five statuses listed above
release a spot; everything else still counts as taken.

## Notes

- Events are queued in the browser and flushed in batches (every 4s, and on
  page exit via `sendBeacon`) to stay well inside Apps Script quotas.
- No cookies and no third-party analytics. Identifiers are random values in
  the visitor's own `localStorage` / `sessionStorage`. `privacy.html` describes
  this in section 2.
- Tracking is wrapped so that it can never throw or block a form submission.
