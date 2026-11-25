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

## Live test, 25 Nov 2026

Run in the deployed web app under a separate test ID (`qa-claude`), in English, on a desktop browser.
The test ID uses up one of the 40 inventories (see A2) and still holds two test items.

| Check | Result |
|---|---|
| R3: save an item with "Usable after opening" = 90 and no opening date | **Confirmed.** Refused with "Enter an opening date to set a period after opening." The message appears below the Cancel button, at the very bottom of a long form. |
| R1a: add an item dated seven months ahead, then look at Home | **Confirmed.** Toast says "Item added", Home still says "0 items" and "Nothing to check right now". |
| R1b: tap the "due" card on Home, go back to Home, open List | **Confirmed.** List opens with the "Due soon" filter still on and says "0 items · No items yet", although one item exists. Tapping "All" shows it. |
| R2: reminder setting | **Confirmed.** One number field, "How many days ahead should we remind you?". |
| S2: add "Test tea" to the shopping list, tick it, un-tick it | **Confirmed.** The item created by the tick stays in the inventory with quantity 0 and shows under "Running low". |

### New findings

| # | Problem | Detail |
|---|---|---|
| L1 | The live assistant does not work in this deployment. | Profile shows "Gemini API key missing"; a typed message gets "The Gemini API key is missing. You can still try a demo or add an item manually." Only the scripted demo works. |
| L2 | A typed date can turn into a wrong year. | Typing `20270630` into the date field gives year `202706` (the year part accepts six digits), so the date is incomplete until corrected by hand. |
| L3 | The "purchased" control on a shopping entry is a clock icon with no label. | It is not obvious that tapping it marks the entry as bought. |
| L4 | The browser on this computer was already signed in to a shared demo ID (`report_demo_02`). | Anyone opening the link there lands in that inventory without being asked; IDs are remembered per browser with no sign-out prompt. |

Not re-tested live: A1–A4, I1–I7, S1, S3, N1–N3, O1–O3 (still based on reading the code).
