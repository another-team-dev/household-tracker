# Audit of the Apps Script prototype v1.3.3

Code review of `apps-script/Code.gs` and `apps-script/Index.html`, 25 Nov 2026.
Found by reading the code path of each use case; not yet reproduced in the running app.
"Fix" says where the rewrite deals with it.

## Reported by Antonina

| # | Problem | Cause in the code | Fix |
|---|---|---|---|
| R1 | A new item does not appear on Home and shows up in some places but not others. | Home lists only items whose due date is inside the reminder window (`daysLeft <= reminderDays`), top 5; an item with a later date or no date never appears there. The List tab also keeps the last filter and category: after tapping the "due" card the filter stays on "Due soon", so opening List later hides everything else. | New Home shows the whole inventory grouped by place; filters reset when the tab is opened and the active filter is always visible. |
| R2 | One "days ahead" number is the only reminder setting. | `reminderDays` is a single integer per item. The same number also decides the "soon" colour, so reminder 0 makes an item due tomorrow look fine. | `reminder_rules` table: several rules per item, offsets in minutes/hours/days/weeks, repeats. Status colour no longer depends on reminder settings. |
| R3 | "Usable after opening" cannot be saved without an opening date. | `normalizeItem_` rejects `afterOpeningDays` when `openedOn` is empty. | The two fields are independent; an "Opened today" action starts the countdown. |
| R4 | Interface is crowded and takes too many taps. | Item form shows 15 fields at once; Home has 9 navigation rows; categories are a second list behind a toggle. | Redesign (mock-ups reviewed before any code). |

## Found in the audit

### Data and access

| # | Problem | Cause |
|---|---|---|
| A1 | Anyone who types or guesses an ID sees and can delete that inventory. | No password; ID is 4–32 characters; the web app is open to anonymous users. |
| A2 | Only 40 inventories can ever exist. | `WORKSPACE_COUNT >= 40` in `initializeWorkspace_`. A mistyped ID uses one up for good. |
| A3 | Every save rewrites the whole inventory under one global lock, shared by all users. | `save_` clears and rewrites the sheet; `locked_` uses the script-wide lock, so users block each other ("Another request is being saved"). |
| A4 | Scheduled reminders and e-mails only work for the owner's original inventory. | `reminderTick_` runs with an empty workspace, so inventories opened by ID are never checked. Their reminders appear only when someone opens the app. |

### Items

| # | Problem | Cause |
|---|---|---|
| I1 | "Replaced" erases the after-opening period. | `quickAction_` sets `afterOpeningDays = 0`. |
| I2 | The "Date added" field cannot be cleared; it silently comes back. | `acquiredOn: data.acquiredOn || old.acquiredOn || today`. |
| I3 | Dates are not checked against each other. | Opening date in the future, expiry before manufacture date, and so on are accepted. |
| I4 | Duplicate warning ignores dates. | Same name + category always counts as a duplicate, even for a new package with a different date. |
| I5 | Deleting a category can delete its items. | "cascade" mode in `performDelete_`. |
| I6 | Typing in search is interrupted once a minute. | The 60-second refresh re-renders the whole page, including the search field and scroll position. |
| I7 | Search silently ignores the open category. | `filteredItems` drops the category condition when there is a query. |

### Shopping list

| # | Problem | Cause |
|---|---|---|
| S1 | Un-ticking a purchase subtracts the quantity again, even if the item was used in between. | `shoppingToggle_` subtracts `entry.quantity` from whatever the stock is now. |
| S2 | Un-ticking a purchase that created a new item leaves an empty "used up" item behind. | The created item is not removed. |
| S3 | Shopping changes cannot be undone, although they change stock. | `shoppingAdd_/Toggle_/Delete_` do not record undo information. |

### Reminders

| # | Problem | Cause |
|---|---|---|
| N1 | A dismissed reminder comes back the next day. | Reminder ID contains today's date; a new one is created daily. |
| N2 | Phone notifications only appear while the app is open. | Uses the page's `Notification` API; there is no push. |
| N3 | All dates assume Korea time. | `Asia/Seoul` is hard-coded on the server and in the client. |

### Other

| # | Problem | Cause |
|---|---|---|
| O1 | Only one step of undo. | A new action replaces the previous undo record. |
| O2 | Saving settings in English stores "My home" as a custom name. | `settings_` drops the `defaultName` flag. |
| O3 | AI-created items fail when the model sends `null` for the reminder. | `number_(null)` is rejected in `normalizeItem_`. |
