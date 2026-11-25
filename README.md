# Household Tracker (집기록)

Tracks household items that expire (food, medicine, cosmetics, household chemicals)
or need regular replacement (filters, batteries), with an in-app AI chat for adding
and editing items.

## Repository layout

| Folder | What it is |
|---|---|
| `app/` | The new app: an installable web app (PWA). Plain HTML, CSS and JavaScript modules, no build step. `js/app.js` holds the screens and actions, `js/api.js` the data access (Supabase, or an in-memory stand-in when the address ends in `?mock`), `js/i18n.js` all English and Korean text. |
| `supabase/migrations/` | The database: tables and the access rules that keep each household's data private. |
| `docs/` | Audit of the prototype's bugs. |
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

## Running the app locally

```
cd app
python3 -m http.server 8000
```

Then open `http://localhost:8000/?mock` to try it with throw-away data that lives only in the page,
or `http://localhost:8000/` to use the real database.
