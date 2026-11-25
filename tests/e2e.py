# End-to-end check of the app against the in-memory back end.
# Run:  (cd app && python3 -m http.server 8000) &   then   python3 tests/e2e.py
# Needs: pip install playwright && playwright install chromium
from playwright.sync_api import sync_playwright
import datetime, sys
URL = 'http://localhost:8000/?mock=1'
errs, fails = [], []
def ok(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
def d(days=0, fmt='%d/%m/%Y'): return (datetime.date.today() + datetime.timedelta(days=days)).strftime(fmt)
def go(pg, h, wait): pg.evaluate(f"location.hash='{h}'"); pg.wait_for_selector(wait)
def add(pg, name, date=None, pao=None):
    go(pg, '#/edit/new', '#item-form'); pg.fill('[name=name]', name)
    if date: pg.fill('[name=printed_date]', date)
    if pao: pg.click('[data-act=toggleMore]'); pg.fill('[name=after_opening_days]', pao)
    pg.click('button[type=submit]'); pg.wait_for_selector(f'.toast:has-text("{name}")')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}, locale='en-GB')
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(URL); pg.wait_for_selector('text=Start without an account')
    # family code: checked while typing, wrong text stays and turns red
    pg.fill('[name=code]', 'hello!'); ok(pg.get_attribute('[name=code]', 'aria-invalid') == 'true' and '18 characters' in pg.inner_text('#join-form .msg') and pg.input_value('[name=code]') == 'hello!', 'family code: wrong characters are flagged while typing and not erased')
    pg.fill('[name=code]', 'abc123'); ok(pg.get_attribute('[name=code]', 'aria-invalid') == 'false', 'family code: valid characters so far are not flagged')
    pg.click('#join-form button.btn'); ok('18 characters' in pg.inner_text('#join-form .msg'), 'family code: too short is refused on submit')
    pg.fill('[name=code]', '')
    pg.click('text=Start without an account'); pg.wait_for_selector('text=My home')
    ok('0 items in total' in pg.inner_text('body'), 'home shows total count on empty start')
    ok(pg.locator('a.btn:has-text("Add an item by hand")').count() == 1, 'Home has a visible "add by hand" button')
    pg.click('text=+ New category'); pg.fill('#ask-input', 'Fridge'); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('.tile:has-text("Fridge")')
    # form: required mark, hints, live checks
    go(pg, '#/edit/new', '#item-form')
    ok(pg.locator('label[for=f-name] .req').count() == 1, 'name is marked as required')
    pg.click('.field:has(#f-printed_date) .info'); ok(pg.locator('.field:has(#f-printed_date) .tip').is_visible(), '(i) button shows what a field is for')
    pg.click('button[type=submit]'); ok('Enter a name' in pg.inner_text('.field:has(#f-name) .msg'), 'empty name refused, message next to the field')
    pg.fill('[name=name]', 'Soy sauce'); pg.click('.chip.big:has-text("Fridge")')
    pg.type('[name=printed_date]', '3113'); ok(pg.get_attribute('[name=printed_date]', 'aria-invalid') == 'true' and pg.input_value('[name=printed_date]') == '31/13', 'date: month 13 flagged while typing, text kept')
    pg.fill('[name=printed_date]', '31/04/2027'); ok('not a real date' in pg.inner_text('.field:has(#f-printed_date) .msg'), 'date: 31 April refused')
    pg.fill('[name=printed_date]', ''); pg.type('[name=printed_date]', '30062027'); ok(pg.input_value('[name=printed_date]') == '30/06/2027' and pg.get_attribute('[name=printed_date]', 'aria-invalid') == 'false', 'date: separators appear while typing digits')
    ok(pg.locator('[name=after_opening_days]').count() == 0, '"after opening" is under More details')
    pg.click('[data-act=toggleMore]'); pg.fill('[name=after_opening_days]', '9x'); ok(pg.get_attribute('[name=after_opening_days]', 'aria-invalid') == 'true', 'days: letters flagged while typing')
    pg.fill('[name=after_opening_days]', '90'); pg.click('button[type=submit]'); pg.wait_for_selector('.toast'); pg.wait_for_selector('text=Recently added')
    ok('Soy sauce' in pg.inner_text('#app') and '1 item in total' in pg.inner_text('body'), 'item with after-opening days and no opening date saves and shows on Home at once')
    # opening
    pg.click('a.row:has-text("Soy sauce")'); pg.wait_for_selector('text=Have you opened it?')
    pg.click('text=Opened today'); pg.wait_for_selector('text=Marked as opened'); ok(d(90) in pg.inner_text('.card.pad'), 'opening starts the countdown')
    pg.click('text=Remove the opening date'); pg.wait_for_selector('text=Have you opened it?'); ok(True, '"Remove the opening date" puts it back to not opened')
    pg.click('text=Another date…'); pg.fill('#ask-input', d(5)); pg.click('#ask-form button[type=submit]'); ok('future' in pg.inner_text('#ask-form .msg'), 'opening date in the future is refused, dialog stays')
    pg.fill('#ask-input', d(-1)); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('text=Remove the opening date'); ok(d(-1) in pg.inner_text('.card.pad'), '"Another date" sets an earlier opening date')
    # reminders straight from the item
    pg.click('text=Change reminders'); pg.wait_for_selector('button[data-act=openRule]')
    pg.click('button[data-act=openRule] >> nth=0'); pg.wait_for_selector('form.rule'); ok(True, 'a default reminder opens for editing directly on the item')
    pg.fill('form.rule [name=offset_amount]', '3'); pg.locator('form.rule [name=offset_amount]').blur(); pg.wait_for_timeout(300)
    pg.click('text=+ Add a reminder'); pg.wait_for_selector('form.rule')
    pg.fill('form.rule [name=offset_amount]', '2'); pg.select_option('form.rule [name=offset_unit]', 'hours'); pg.wait_for_timeout(200)
    pg.check('form.rule [name=rep]'); pg.wait_for_selector('form.rule [name=repeat_every_amount]')
    pg.fill('form.rule [name=repeat_every_amount]', '30'); pg.select_option('form.rule [name=repeat_every_unit]', 'minutes'); pg.wait_for_timeout(200)
    pg.check('form.rule [name=stop][value=count]'); pg.wait_for_timeout(200); pg.fill('form.rule [name=repeat_count]', '5'); pg.locator('form.rule [name=repeat_count]').blur(); pg.wait_for_timeout(300)
    pg.click('form.rule [aria-label="Close this reminder"]'); pg.wait_for_timeout(300); txt = pg.inner_text('#app')
    ok('3 days before' in txt and '2 hours before' in txt and 'every 30 minutes ×5' in txt and pg.locator('form.rule').count() == 0, 'item gets its own reminders: edited default + new one, boxes collapse')
    go(pg, '#/reminders/default', 'button[data-act=openRule]'); ok('7 days before' in pg.inner_text('#app'), 'home defaults are untouched by the item change')
    # one reminder becomes a default: the app asks who gets it
    add(pg, 'Rice')
    go(pg, '#/items/all', '.chips'); pg.click('a.row:has-text("Soy sauce")'); pg.click('text=Change reminders'); pg.wait_for_selector('button[data-act=openRule]')
    pg.click('button[data-act=openRule]:has-text("2 hours before")'); pg.wait_for_selector('form.rule'); pg.click('text=Use this reminder for all items by default'); pg.wait_for_selector('text=Use this reminder as a default for')
    ok(pg.locator('#choose-remember').count() == 1 and pg.locator('.sheet button.btn').count() == 4, 'making a default asks: three scopes, a "remember my choice" box')
    pg.click('button:has-text("Only items added from now on")'); pg.wait_for_selector('text=Now a default for items added from now on')
    go(pg, '#/reminders/default', 'button[data-act=openRule]'); ok('Only for items added since' in pg.inner_text('#app'), 'default limited to new items is marked as such')
    go(pg, '#/items/all', '.chips'); pg.click('a.row:has-text("Rice")'); pg.wait_for_selector('text=Change reminders'); ok('Reminders · 2' in pg.inner_text('#app'), 'an older item does not get a "new items only" default')
    # editing a reminder that is a default: asked once whether the default changes too
    go(pg, '#/items/all', '.chips'); pg.click('a.row:has-text("Soy sauce")'); pg.click('text=Change reminders'); pg.wait_for_selector('button[data-act=openRule]')
    pg.click('button[data-act=openRule]:has-text("2 hours before")'); pg.wait_for_selector('form.rule'); pg.fill('form.rule [name=offset_amount]', '4'); pg.locator('form.rule [name=offset_amount]').blur(); pg.wait_for_timeout(300)
    pg.click('form.rule [aria-label="Close this reminder"]'); pg.wait_for_selector('text=Change the default too?'); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('text=The default was changed too')
    go(pg, '#/reminders/default', 'button[data-act=openRule]'); ok('4 hours before' in pg.inner_text('#app'), 'after "Change the default too" the default follows the edit')
    go(pg, '#/more', 'text=When a reminder is made a default'); pg.click('button:has-text("When a reminder is made a default")'); pg.click('.sheet button:has-text("All items")'); pg.wait_for_timeout(200); ok('All items' in pg.inner_text('button:has-text("When a reminder is made a default")'), 'the scope choice can be changed in settings')
    # attention, snooze
    add(pg, 'Milk', d(1)); go(pg, '#/home', '.assist-card'); ok('1 day left' in pg.inner_text('#app'), 'item due tomorrow appears under Needs attention')
    pg.click('a.row:has-text("Milk")'); pg.wait_for_selector('text=Change reminders'); ok('Reminders · 3' in pg.inner_text('#app'), 'a new item gets the new default')
    go(pg, '#/alerts', 'text=Remind me later'); pg.click('text=Remind me later'); pg.click('text=Tomorrow at 09:00'); pg.wait_for_selector('text=COMING BACK LATER')
    ok(pg.locator('.dot').count() == 0 and 'All clear' in pg.inner_text('#app'), '"Remind me later" takes it off the list until then')
    pg.click('text=Show it now'); pg.wait_for_selector('text=Remind me later'); ok(pg.locator('.dot').count() == 1, '"Show it now" brings it back')
    # filter does not stick, search keeps focus
    go(pg, '#/items/all', '.chips'); pg.click('.chip:has-text("Opened")'); pg.wait_for_timeout(100); one = pg.locator('#results a.row').count()
    go(pg, '#/home', '.assist-card'); go(pg, '#/items/all', '.chips')
    ok(one == 1 and pg.locator('#results a.row').count() == 3 and 'on' in pg.get_attribute('.chip:has-text("All")', 'class'), 'filter resets when the list is opened again')
    pg.fill('#search', 'soy'); pg.wait_for_timeout(100); ok(pg.locator('#results a.row').count() == 1 and pg.evaluate("document.activeElement.id") == 'search', 'search filters without losing focus')
    # shopping
    go(pg, '#/shopping', '#shop-form'); pg.fill('#shop-form input', 'Tea'); pg.click('#shop-form button'); pg.wait_for_selector('label.row:has-text("Tea")')
    pg.check('label.row:has-text("Tea") input'); pg.wait_for_selector('text=Bought'); go(pg, '#/items/all', '.chips'); n1 = pg.locator('#results a.row').count()
    go(pg, '#/shopping', '#shop-form'); pg.uncheck('label.row:has-text("Tea") input'); pg.wait_for_timeout(300); go(pg, '#/items/all', '.chips')
    ok(n1 == 4 and pg.locator('#results a.row').count() == 3, 'un-ticking a purchase leaves no empty item behind')
    # used up goes to the archive; restore; delete forever needs a confirmation
    pg.click('a.row:has-text("Milk")'); pg.click('text=Used up'); pg.wait_for_selector('text=moved to the archive'); pg.wait_for_selector('.chips')
    ok(pg.locator('#results a.row:has-text("Milk")').count() == 0, 'used-up item leaves the list')
    go(pg, '#/home', '.assist-card'); ok('2 items in total' in pg.inner_text('#app'), 'total count does not include archived items')
    go(pg, '#/archive', 'text=Put back'); ok('Milk' in pg.inner_text('#app') and 'used up' in pg.inner_text('#app'), 'the archive lists it with the reason')
    pg.click('text=Put back'); pg.wait_for_selector('text=is back in your list'); go(pg, '#/home', '.assist-card'); ok('3 items in total' in pg.inner_text('#app'), '"Put back" restores it')
    go(pg, '#/items/all', '.chips'); pg.click('a.row:has-text("Rice")'); pg.click('text=Move to archive'); pg.wait_for_selector('text=moved to the archive')
    go(pg, '#/archive', 'text=Put back'); pg.click('button:has-text("Delete forever")'); pg.wait_for_selector('text=cannot be undone'); pg.click('[data-ask]'); ok('Rice' in pg.inner_text('#app'), 'delete forever asks first; Cancel keeps the item')
    pg.click('button:has-text("Delete forever")'); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('text=The archive is empty'); ok(True, 'confirmed "Delete forever" removes it')
    # assistant demo
    go(pg, '#/assistant', 'text=Play the photo example'); pg.click('text=Play the photo example'); pg.wait_for_selector('text=When did you open it?'); pg.click('text=I opened it two days ago'); pg.wait_for_selector('text=View Seoul Milk')
    go(pg, '#/items/all', '.chips'); ok(pg.locator('#results a.row:has-text("Seoul Milk")').count() == 1, 'photo demo adds a real item after the follow-up question')
    go(pg, '#/assistant', 'text=View Seoul Milk'); pg.click('.bub-acts button:has-text("Undo")'); pg.wait_for_selector('text=Add them back'); ok('#/assistant' in pg.url and pg.locator('text=View Seoul Milk').count() == 0, 'Undo stays in the chat and the assistant says what it undid')
    pg.click('.composer [data-act=demoVoice]'); pg.wait_for_selector('text=View Eye drops'); go(pg, '#/items/all', '.chips'); ok(pg.locator('#results a.row:has-text("Eye drops")').count() == 1 and pg.locator('#results a.row:has-text("Milk")').count() == 2, 'voice demo adds milk and eye drops')
    # customise home
    go(pg, '#/customize', 'text=Customize Home'); pg.check('[data-sec=shopping]'); pg.wait_for_timeout(200); pg.uncheck('[data-sec=recent]'); pg.wait_for_timeout(200)
    go(pg, '#/home', '.assist-card'); h = pg.inner_text('#app'); ok('Shopping list' in h and 'Recently added' not in h, 'Home customisation')
    # date format and language
    go(pg, '#/more', 'text=Date format'); pg.click('button:has-text("Date format")'); pg.click(f'button:has-text("YYYY.MM.DD")'); pg.wait_for_timeout(200)
    go(pg, '#/items/all', '.chips'); pg.click('a.row:has-text("Soy sauce")'); pg.wait_for_selector('text=Use by'); ok('2027.06.30' in pg.inner_text('#app'), 'date format can be changed (YYYY.MM.DD)')
    go(pg, '#/more', 'text=Language'); pg.click('button:has-text("Language")'); pg.wait_for_selector('text=더보기'); go(pg, '#/home', '.assist-card'); ok('도우미' in pg.inner_text('#app'), 'Korean interface')
    b.close()
print('console errors:', errs)
sys.exit(1 if fails or errs else 0)
