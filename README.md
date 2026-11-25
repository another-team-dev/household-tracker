# Household Tracker (집기록)

Tracks household items that expire (food, medicine, cosmetics, household chemicals)
or need regular replacement (filters, batteries), with an in-app AI chat for adding
and editing items.

## Repository layout

| Folder | What it is |
|---|---|
| `apps-script/` | The original prototype, v1.3.3: a Google Apps Script web app (`Code.gs` server, `Index.html` client, data in Google Sheets). Imported unchanged as the baseline. |

## Status

The app is being moved off Google Apps Script:

1. Baseline import of the Apps Script prototype (done).
2. Front end as an installable PWA on GitHub Pages.
3. Supabase back end: accounts, database, AI calls in a server function, scheduled reminders.
4. Retire the Apps Script version.

## Secrets

No keys are stored in this repository. The prototype reads `GEMINI_API_KEY` and
`SPREADSHEET_ID` from Apps Script Script Properties; the new back end will read
its keys from server-side environment variables.
