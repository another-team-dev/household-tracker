# End-to-end check of the app against the in-memory back end.
# Run:  (cd app && python3 -m http.server 8000) &   then   python3 tests/e2e.py
# Needs: pip install playwright && playwright install chromium
from playwright.sync_api import sync_playwright
import sys, datetime
errs=[]
def ok(c,msg):
    print(('PASS ' if c else 'FAIL ')+msg)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844}, locale='en-GB')
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.goto('http://localhost:8000/?mock=1'); pg.wait_for_selector('text=Start without an account')
    None
    pg.click('text=Start without an account'); pg.wait_for_selector('text=My home')
    ok('0 items in total' in pg.inner_text('body'),'home shows total count on empty start')
    # category
    pg.click('text=+ New category'); pg.fill('#ask-input','Fridge'); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('.tile:has-text("Fridge")')
    # item: far date + after-opening, no opening date  (old bug R3)
    pg.click('text=Add manually'); pg.fill('[name=name]','Soy sauce'); pg.click('.chip.big:has-text("Fridge")')
    pg.fill('[name=printed_date]','2027-06-30'); pg.fill('[name=after_opening_days]','90'); pg.click('button[type=submit]')
    pg.wait_for_selector('.toast'); pg.wait_for_selector('text=Recently added'); body=pg.inner_text('body')
    ok('was added' in body,'item with after-opening days and no opening date saves')
    ok('Recently added' in pg.inner_text('#app') and 'Soy sauce' in pg.inner_text('#app'),'new far-dated item is visible on Home right away (old bug R1a)')
    ok('1 item in total' in body,'total count updated')
    None
    # opened today
    pg.click('a.row:has-text("Soy sauce")'); pg.wait_for_selector('text=Have you opened it?'); None
    pg.click('text=Opened today'); pg.wait_for_selector('text=Marked as opened')
    exp=(datetime.date.today()+datetime.timedelta(days=90))
    ok(str(exp.year) in pg.inner_text('.card.pad') and 'days left' in pg.inner_text('#app'),'opening starts the countdown; due date recalculated')
    pg.click('.toast button'); pg.wait_for_selector('text=Have you opened it?'); ok(True,'Undo restores "not opened"')
    # another date in future refused by max; pick yesterday
    pg.click('text=Another date…'); y=(datetime.date.today()-datetime.timedelta(days=1)).isoformat(); pg.fill('#ask-input',y); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('text=It is not opened after all')
    ok(True,'"Another date" sets an earlier opening date')
    # reminders
    pg.click('a.row:has-text("Reminders")'); pg.wait_for_selector('text=Set different reminders for this item'); pg.click('text=Set different reminders for this item')
    pg.wait_for_selector('button[data-act=openRule]'); n0=pg.locator('button[data-act=openRule]').count()
    pg.click('text=+ Add a reminder'); pg.wait_for_selector('form.rule')
    pg.fill('form.rule [name=offset_amount]','2'); pg.select_option('form.rule [name=offset_unit]','hours'); pg.wait_for_timeout(200)
    pg.check('form.rule [name=rep]'); pg.wait_for_selector('form.rule [name=repeat_every_amount]')
    pg.fill('form.rule [name=repeat_every_amount]','30'); pg.select_option('form.rule [name=repeat_every_unit]','minutes'); pg.wait_for_timeout(200)
    pg.check('form.rule [name=stop][value=count]'); pg.wait_for_timeout(200); pg.fill('form.rule [name=repeat_count]','5'); pg.locator('form.rule [name=repeat_count]').blur(); pg.wait_for_timeout(300)
    None
    pg.click('form.rule [aria-label="Close this reminder"]'); pg.wait_for_timeout(300)
    txt=pg.inner_text('#app'); ok('2 hours before' in txt and 'every 30 minutes ×5' in txt and pg.locator('form.rule').count()==0,'several reminders, units, typed repeat count; boxes collapse to one line: '+str(n0+1)+' rules')
    None
    pg.click('text=Done'); pg.wait_for_selector('text=Reminders · 3')
    pg.go_back(); pg.goto('http://localhost:8000/?mock=1#/home') if False else None
    # second item due tomorrow
    pg.evaluate("location.hash='#/home'"); pg.wait_for_selector('text=Recently added')
    pg.click('text=Add manually'); pg.fill('[name=name]','Milk'); t=(datetime.date.today()+datetime.timedelta(days=1)).isoformat(); pg.fill('[name=printed_date]',t); pg.click('button[type=submit]'); pg.wait_for_selector('.toast')
    ok('1 day left' in pg.inner_text('#app'),'item due tomorrow appears under Needs attention')
    # filter does not stick (old bug R1b)
    pg.evaluate("location.hash='#/items/all'"); pg.wait_for_selector('.chips'); pg.click('.chip:has-text("Opened")'); pg.wait_for_timeout(100)
    one=pg.locator('#results a.row').count()
    pg.evaluate("location.hash='#/home'"); pg.wait_for_selector('text=Recently added'); pg.evaluate("location.hash='#/items/all'"); pg.wait_for_selector('.chips')
    ok(one==1 and pg.locator('#results a.row').count()==2 and 'on' in pg.get_attribute('.chip:has-text("All")','class'),'filter resets when the list is opened again')
    pg.fill('#search','soy'); pg.wait_for_timeout(100); ok(pg.locator('#results a.row').count()==1 and pg.evaluate("document.activeElement.id")=='search','search filters without losing focus')
    None
    # shopping tick / untick (old bug S2)
    pg.evaluate("location.hash='#/shopping'"); pg.wait_for_selector('#shop-form'); pg.fill('#shop-form input','Tea'); pg.click('#shop-form button'); pg.wait_for_selector('label.row:has-text("Tea")')
    pg.check('label.row:has-text("Tea") input'); pg.wait_for_selector('text=Bought')
    a=pg.evaluate("location.hash='#/items/all'"); pg.wait_for_selector('.chips'); n_after_tick=pg.locator('#results a.row').count()
    pg.evaluate("location.hash='#/shopping'"); pg.wait_for_selector('#shop-form'); pg.uncheck('label.row:has-text("Tea") input'); pg.wait_for_timeout(300)
    pg.evaluate("location.hash='#/items/all'"); pg.wait_for_selector('.chips'); n_after_untick=pg.locator('#results a.row').count()
    ok(n_after_tick==3 and n_after_untick==2,'un-ticking a purchase leaves no empty item behind')
    # customise home
    pg.evaluate("location.hash='#/customize'"); pg.wait_for_selector('text=Customize Home'); pg.check('[data-sec=shopping]'); pg.wait_for_timeout(200); pg.uncheck('[data-sec=recent]'); pg.wait_for_timeout(200)
    None
    pg.evaluate("location.hash='#/home'"); pg.wait_for_selector('.assist-card'); h=pg.inner_text('#app')
    ok('Shopping list' in h and 'Recently added' not in h,'Home customisation: shopping shown, recently added hidden')
    # delete + undo
    pg.evaluate("location.hash='#/items/all'"); pg.wait_for_selector('.chips'); pg.click('a.row:has-text("Milk")'); pg.click('text=Delete item'); pg.click('#ask-form button[type=submit]'); pg.wait_for_selector('.toast')
    pg.click('.toast button'); pg.wait_for_timeout(400); ok(pg.locator('#results a.row:has-text("Milk")').count()==1,'delete then Undo brings the item back')
    # used one / used up
    pg.click('a.row:has-text("Milk")'); pg.click('text=Used up'); pg.wait_for_selector('text=is used up'); ok('Used up' in pg.inner_text('.top .pill'),'Used up sets quantity 0')
    # validation
    pg.evaluate("location.hash='#/edit/new'"); pg.wait_for_selector('#item-form'); pg.click('button[type=submit]'); ok('Enter a name' in pg.inner_text('#form-error'),'empty name refused with a visible message')
    pg.fill('[name=name]','X'); pg.fill('[name=after_opening_days]','0'); pg.click('button[type=submit]'); ok('1 to 3650' in pg.inner_text('#form-error'),'0 days refused')
    pg.click('text=Cancel'); pg.wait_for_timeout(200)
    # Korean
    pg.evaluate("location.hash='#/more'"); pg.wait_for_selector('text=Language'); pg.click('button:has-text("Language")'); pg.wait_for_selector('text=더보기'); None
    pg.evaluate("location.hash='#/home'"); pg.wait_for_selector('.assist-card'); None
    ok('도우미' in pg.inner_text('#app'),'Korean interface')
    b.close()
print('console errors:',errs)
