import { t, setLang, getLang, fmtDate, fmtDateTime } from './i18n.js';
import { createApi } from './api.js';

const SOON_DAYS = 7; // "needs attention" window; deliberately independent of reminder settings
const SECTIONS = ['attention', 'categories', 'recent', 'shopping', 'low'];
const DEFAULT_LAYOUT = { order: SECTIONS, hidden: ['shopping', 'low'] };
const UNITS = ['minutes', 'hours', 'days', 'weeks'];

const S = { user: null, hh: null, items: [], cats: [], rules: [], shop: [], layout: DEFAULT_LAYOUT, q: '', filter: 'all', openRule: null, draft: null, more: false, ready: false };
let api;

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => iso(new Date());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const num = (v) => Number(v);
const qty = (i) => (i.unit ? `${num(i.quantity)} ${i.unit}` : `×${num(i.quantity)}`);
const cat = (id) => S.cats.find((c) => c.id === id);
const catName = (id) => cat(id)?.name ?? t('uncategorized');
const item = (id) => S.items.find((i) => i.id === id);

function info(i) {
  const left = i.due_date ? diff(i.due_date, today()) : null;
  const status = num(i.quantity) === 0 ? 'empty' : left === null ? 'nodate' : left < 0 ? 'expired' : left <= SOON_DAYS ? 'soon' : 'ok';
  return { left, status };
}
const needsAttention = (i) => ['expired', 'soon'].includes(info(i).status);
function pill(i) {
  const { left, status } = info(i);
  if (status === 'nodate') return `<span class="muted small">${t('noDate')}</span>`;
  const label = status === 'empty' ? t('usedUpLabel') : left < 0 ? t('daysPast', { n: -left }) : left === 0 ? t('today') : t('daysLeft', { n: left });
  return `<span class="pill ${status}">${esc(label)}</span>`;
}
const urgency = (a, b) => {
  const k = (i) => { const { left, status } = info(i); return status === 'empty' ? 1e6 : left === null ? 1e5 : left; };
  return k(a) - k(b) || a.name.localeCompare(b.name);
};
function meta(i, withCat = true) {
  const parts = [];
  if (withCat) parts.push(catName(i.category_id));
  parts.push(qty(i));
  if (i.opened_on) parts.push(t('openedAgo', { n: diff(today(), i.opened_on) }));
  else if (i.after_opening_days) parts.push(t('notOpened'));
  if (i.running_out) parts.push(t('runningLow'));
  return parts.map(esc).join(' · ');
}

// ---------- routing ----------
function route() {
  const [path, query] = location.hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', id: parts[1], q: new URLSearchParams(query || '') };
}
const go = (hash) => { location.hash = hash; };
const back = () => { if (history.length > 1) history.back(); else go('#/home'); };

// ---------- feedback ----------
let toastTimer;
function toast(message, undo) {
  clearTimeout(toastTimer);
  S.undo = undo || null;
  $('#toast').innerHTML = `<div class="toast" role="status"><span>${esc(message)}</span>${undo ? `<button data-act="undo">${t('undo')}</button>` : ''}</div>`;
  toastTimer = setTimeout(() => { $('#toast').innerHTML = ''; S.undo = null; }, undo ? 9000 : 4000);
}
function busy(on) { $('#busy').hidden = !on; }
async function run(fn) {
  busy(true);
  try { await fn(); } catch (e) { console.error(e); toast(friendly(e)); } finally { busy(false); }
}
const fail = (m) => { throw Object.assign(new Error(m), { user: true }); };
function friendly(e) {
  const m = String(e?.message || e);
  if (e?.user) return m;
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('errOffline');
  if (/No household has this code/i.test(m)) return t('errCode');
  if (/Anonymous sign-ins are disabled/i.test(m)) return t('errGuestOff');
  if (/categories_name_idx|duplicate key/i.test(m)) return t('errDuplicateCategory');
  return t('errGeneric') + ' (' + m.slice(0, 120) + ')';
}
// Small in-page dialog: resolves to true / the typed text, or null when cancelled.
function ask({ title, body = '', input = null, ok = t('ok'), danger = false, type = 'text' }) {
  return new Promise((resolve) => {
    const field = input === null ? '' : `<input id="ask-input" type="${type}" value="${esc(input)}" ${type === 'date' ? `max="${today()}" min="2000-01-01"` : 'maxlength="60"'} aria-label="${esc(title)}">`;
    $('#modal').innerHTML = `<div class="backdrop"><form class="sheet" id="ask-form"><h2>${esc(title)}</h2>${body ? `<p class="muted">${esc(body)}</p>` : ''}${field}<div class="row-btns"><button type="button" class="btn soft" data-ask="cancel">${t('cancel')}</button><button type="submit" class="btn ${danger ? 'danger' : 'pri'}">${esc(ok)}</button></div></form></div>`;
    const done = (v) => { $('#modal').innerHTML = ''; resolve(v); };
    $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); const v = input === null ? true : $('#ask-input').value.trim(); done(input !== null && !v ? null : v); });
    $('#modal').querySelector('[data-ask]').addEventListener('click', () => done(null));
    (input === null ? $('#ask-form button[type=submit]') : $('#ask-input')).focus();
  });
}

// ---------- data ----------
async function load(...tables) {
  const map = { items: 'items', cats: 'categories', rules: 'reminder_rules', shop: 'shopping_entries' };
  const keys = tables.length ? tables : Object.keys(map);
  const rows = await Promise.all(keys.map((k) => api.select(map[k], S.hh.id)));
  keys.forEach((k, n) => { S[k] = rows[n]; });
  S.cats.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}
async function enter() {
  const list = await api.households();
  if (!list.length) { await api.rpc('create_household', { household_name: t('myHome') }); return enter(); }
  S.hh = list[0];
  const st = await api.settings(S.user.id);
  if (st?.home_layout?.order) S.layout = { order: [...st.home_layout.order.filter((x) => SECTIONS.includes(x)), ...SECTIONS.filter((x) => !st.home_layout.order.includes(x))], hidden: st.home_layout.hidden || [] };
  await load();
}
const log = (i, kind, quantity) => api.insert('activity_log', { household_id: S.hh.id, item_id: i.id, item_name: i.name, kind, quantity, unit: i.unit || '' }).catch(() => {});

// Change an item and offer Undo that restores the exact previous values.
async function patchItem(i, patch, message, kind, amount) {
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, i[k]]));
  await api.update('items', i.id, patch);
  if (kind) log(i, kind, amount);
  await load('items');
  render();
  toast(message, async () => { await api.update('items', i.id, before); await load('items'); render(); toast(t('undone')); });
}

// ---------- views ----------
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
const ICONS = {
  back: 'm14 5-7 7 7 7', plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M6 18 18 6', search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4', spark: 'm12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z', down: 'm6 9 6 6 6-6', up: 'm6 15 6-6 6 6',
};
const top = (label, right = '') => `<div class="top"><button class="link backlink" data-act="back">${icon('back')}${esc(label)}</button>${right}</div>`;
const h1 = (title, sub = '') => `<div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>`;
const rowLink = (href, title, sub, end = '') => `<a class="row" href="${href}"><span class="grow"><span class="row-t">${esc(title)}</span>${sub ? `<span class="row-m">${sub}</span>` : ''}</span>${end}</a>`;
const itemRow = (i, withCat = true) => rowLink(`#/item/${i.id}`, i.name, meta(i, withCat), pill(i));
const card = (inner) => `<div class="card">${inner}</div>`;
const empty = (text) => `<p class="empty">${esc(text)}</p>`;

function nav(active) {
  const n = S.items.filter(needsAttention).length;
  const tab = (name, href, ic, label, dot = '') => `<a class="tab ${active === name ? 'on' : ''}" href="${href}" ${active === name ? 'aria-current="page"' : ''}>${icon(ic)}${esc(label)}${dot}</a>`;
  return `<nav class="nav" aria-label="${t('mainNav')}">${tab('home', '#/home', 'home', t('home'))}<a class="assist" href="#/assistant">${icon('spark')}${t('assistant')}</a>${tab('alerts', '#/alerts', 'bell', t('reminders'), n ? `<span class="dot">${n}</span>` : '')}</nav>`;
}

function vWelcome() {
  return `<main class="page welcome"><h1 class="brand">${t('appName')}</h1><p class="sub center">${t('tagline')}</p>
    <button class="btn pri big" data-act="guest">${t('startGuest')}</button>
    <p class="small muted center">${t('guestNote')}</p>
    <form id="join-form" class="join"><label for="code">${t('haveCode')}</label><div class="inline"><input id="code" name="code" autocomplete="off" placeholder="${t('codePlaceholder')}" maxlength="40" required><button class="btn line">${t('join')}</button></div></form>
    <button class="link center" data-act="lang">${getLang() === 'en' ? '한국어' : 'English'}</button></main>`;
}

const SECTION_VIEW = {
  attention() {
    const list = S.items.filter(needsAttention).sort(urgency);
    return `<section><div class="h2"><h2>${t('needsAttention')}</h2>${list.length > 3 ? `<a class="link" href="#/alerts">${t('seeAll', { n: list.length })}</a>` : ''}</div>${list.length ? card(list.slice(0, 3).map((i) => itemRow(i)).join('')) : empty(t('nothingDue'))}</section>`;
  },
  categories() {
    const tile = (href, name, list, dark = '') => {
      const due = list.filter(needsAttention).length;
      return `<a class="tile ${dark}" href="${href}"><span class="tile-n">${esc(name)}</span><span class="tile-m">${t('nItems', { n: list.length })}${due ? `<br><b class="warn">${t('nDue', { n: due })}</b>` : ''}</span></a>`;
    };
    const uncategorized = S.items.filter((i) => !i.category_id);
    return `<section><div class="h2"><h2>${t('categories')}</h2><a class="link" href="#/categories">${t('edit')}</a></div><div class="tiles">${tile('#/items/all', t('allItems'), S.items, 'dark')}${S.cats.map((c) => tile(`#/items/${c.id}`, c.name, S.items.filter((i) => i.category_id === c.id))).join('')}${uncategorized.length ? tile('#/items/none', t('uncategorized'), uncategorized) : ''}<button class="tile add" data-act="newCat">${t('newCategory')}</button></div></section>`;
  },
  recent() {
    const list = [...S.items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
    return `<section><div class="h2"><h2>${t('recentlyAdded')}</h2><a class="link" href="#/edit/new">${t('addManually')}</a></div>${list.length ? card(list.map((i) => itemRow(i)).join('')) : empty(t('noItemsYet'))}</section>`;
  },
  shopping() {
    const list = S.shop.filter((x) => !x.checked);
    return `<section><div class="h2"><h2>${t('shoppingList')}</h2><a class="link" href="#/shopping">${t('open')}</a></div>${list.length ? card(list.slice(0, 3).map((x) => `<div class="row"><span class="row-t">${esc(x.name)}</span><span class="muted small">${num(x.quantity)} ${esc(x.unit)}</span></div>`).join('')) : empty(t('nothingToBuy'))}</section>`;
  },
  low() {
    const list = S.items.filter((i) => i.running_out || num(i.quantity) === 0);
    return `<section><div class="h2"><h2>${t('runningLow')}</h2></div>${list.length ? card(list.slice(0, 3).map((i) => itemRow(i)).join('')) : empty(t('nothingLow'))}</section>`;
  },
};

function vHome() {
  const date = new Date().toLocaleDateString(getLang() === 'ko' ? 'ko-KR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const sections = S.layout.order.filter((x) => !S.layout.hidden.includes(x)).map((x) => SECTION_VIEW[x]()).join('');
  return `<main class="page with-nav"><div class="top"><div><p class="sub">${esc(date)}</p><h1>${esc(S.hh.name)}</h1><p class="sub">${t('totalItems', { n: S.items.length, c: S.cats.length })}</p></div><div class="inline"><a class="round" href="#/items/all?focus=1" aria-label="${t('search')}">${icon('search')}</a><a class="round" href="#/more" aria-label="${t('more')}">${icon('more', 'bold')}</a></div></div>
    <a class="assist-card" href="#/assistant"><span class="assist-h">${icon('spark')}${t('assistCard')}</span><span class="assist-in">${t('assistExample')}</span></a>
    ${sections}<a class="link center" href="#/customize">${t('customizeHome')}</a></main>${nav('home')}`;
}

function listFor(id) {
  const q = S.q.trim().toLowerCase();
  let list = S.items;
  // A search always covers every category, and the screen says so.
  if (q) list = list.filter((i) => [i.name, catName(i.category_id), i.location, i.notes].join(' ').toLowerCase().includes(q));
  else if (id === 'none') list = list.filter((i) => !i.category_id);
  else if (id !== 'all') list = list.filter((i) => i.category_id === id);
  const f = { all: () => true, soon: needsAttention, opened: (i) => !!i.opened_on, low: (i) => i.running_out || num(i.quantity) === 0, nodate: (i) => !i.due_date }[S.filter];
  return { base: list, shown: list.filter(f).sort(urgency) };
}
function resultsHtml(id) {
  const { shown } = listFor(id);
  if (!shown.length) return empty(S.q ? t('noMatch', { q: S.q }) : S.filter !== 'all' ? t('noneInFilter') : t('noItemsHere'));
  return card(shown.map((i) => (S.filter === 'soon' ? expandedRow(i) : itemRow(i, id === 'all' || !!S.q))).join(''));
}
function expandedRow(i) {
  return `<div class="row col"><a class="row bare" href="#/item/${i.id}"><span class="grow"><span class="row-t">${esc(i.name)}</span><span class="row-m">${meta(i)}</span></span>${pill(i)}</a>${quickBtns(i)}</div>`;
}
const quickBtns = (i) => `<div class="row-btns"><button class="btn line" data-act="usedOne" data-id="${i.id}" ${num(i.quantity) ? '' : 'disabled'}>${t('usedOne')}</button><button class="btn line" data-act="usedUp" data-id="${i.id}" ${num(i.quantity) ? '' : 'disabled'}>${t('usedUp')}</button><button class="btn line" data-act="threw" data-id="${i.id}" ${num(i.quantity) ? '' : 'disabled'}>${t('threwAway')}</button></div>`;

function vItems(r) {
  const id = r.id || 'all';
  const { base } = listFor(id);
  const count = (key, fn) => base.filter(fn).length;
  const chips = [['all', t('fAll'), base.length], ['soon', t('fSoon'), count('soon', needsAttention)], ['opened', t('fOpened'), count('o', (i) => !!i.opened_on)], ['low', t('fLow'), count('l', (i) => i.running_out || num(i.quantity) === 0)], ['nodate', t('fNoDate'), count('n', (i) => !i.due_date)]];
  const title = S.q ? t('searchResults') : id === 'all' ? t('allItems') : id === 'none' ? t('uncategorized') : catName(id);
  return `<main class="page with-nav with-fab">${top(t('home'))}${h1(title, S.q ? t('searchingAll') : t('sortedByDue', { n: base.length }))}
    <label class="search">${icon('search')}<input id="search" type="search" value="${esc(S.q)}" placeholder="${t('searchPlaceholder')}" aria-label="${t('search')}"></label>
    <div class="chips" role="group" aria-label="${t('filter')}">${chips.map(([k, label, n]) => `<button class="chip ${S.filter === k ? 'on' : ''}" aria-pressed="${S.filter === k}" data-act="filter" data-f="${k}">${esc(label)} ${n}</button>`).join('')}</div>
    <div id="results">${resultsHtml(id)}</div></main>
    <a class="fab" href="#/edit/new${cat(id) ? `?cat=${id}` : ''}">${icon('plus')}${cat(id) ? t('addTo', { c: catName(id) }) : t('addItem')}</a>${nav('')}`;
}

function vItem(r) {
  const i = item(r.id);
  if (!i) return `<main class="page">${top(t('back'))}${empty(t('itemGone'))}</main>`;
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  const openBlock = i.after_opening_days
    ? (i.opened_on
      ? `${kv(t('opened'), fmtDate(i.opened_on))}<p class="small muted">${t('useBy', { d: fmtDate(addDays(i.opened_on, i.after_opening_days)) })}</p><button class="link" data-act="unopen" data-id="${i.id}">${t('notOpenedYet')}</button>`
      : `${kv(t('opened'), t('notYet'))}<p class="q">${t('haveYouOpened')}</p><div class="row-btns"><button class="btn pri" data-act="openToday" data-id="${i.id}">${t('openedToday')}</button><button class="btn line" data-act="openOther" data-id="${i.id}">${t('anotherDate')}</button></div><p class="small muted">${t('ifOpenedToday', { d: fmtDate(addDays(today(), i.after_opening_days)) })}</p>`)
    : `<button class="link" data-act="setPao" data-id="${i.id}">${t('addAfterOpening')}</button>`;
  const own = S.rules.filter((x) => x.item_id === i.id);
  return `<main class="page">${top(catName(i.category_id), `<a class="link" href="#/edit/${i.id}">${t('edit')}</a>`)}
    <div class="top">${h1(i.name, `${catName(i.category_id)} · ${qty(i)}${i.location ? ' · ' + i.location : ''}`)}${pill(i)}</div>
    <div class="card pad">${i.date_type !== 'none' ? kv(t('dt_' + i.date_type), i.printed_date ? fmtDate(i.printed_date) + (i.estimated ? ` (${t('estimated')})` : '') : t('notSet')) : kv(t('date'), t('noDate'))}${i.after_opening_days ? kv(t('afterOpening'), t('withinDays', { n: i.after_opening_days })) : ''}${openBlock}</div>
    ${quickBtns(i)}
    ${i.interval_days ? `<button class="btn line" data-act="replaced" data-id="${i.id}">${t('replacedToday', { n: i.interval_days })}</button>` : ''}
    ${card(rowLink(`#/reminders/${i.id}`, t('remindersN', { n: own.length || S.rules.filter((x) => !x.item_id).length }), esc(own.length ? own.map(ruleSummary).join(' · ') : t('usingDefaults')), `<span class="link">${t('change')}</span>`)
      + `<button class="row" data-act="toShop" data-id="${i.id}"><span class="row-t">${t('addToShopping')}</span><span class="link">${t('add')}</span></button>`)}
    ${i.notes ? `<p class="notes">${esc(i.notes)}</p>` : ''}
    <button class="link danger center" data-act="delItem" data-id="${i.id}">${t('deleteItem')}</button></main>`;
}

function blankDraft(r) {
  return { id: null, name: S.q || '', category_id: cat(r.q.get('cat')) ? r.q.get('cat') : '', quantity: 1, unit: '', printed_date: '', after_opening_days: '', date_type: 'expiration', estimated: false, location: '', notes: '', manufactured_on: '', interval_days: '', opened_on: '', running_out: false };
}
function vEdit(r) {
  if (!S.draft || S.draft._for !== r.id) {
    const src = r.id === 'new' ? blankDraft(r) : item(r.id);
    if (!src) return `<main class="page">${top(t('back'))}${empty(t('itemGone'))}</main>`;
    S.draft = { ...src, _for: r.id };
    S.more = false;
  }
  const d = S.draft, v = (k) => esc(d[k] ?? '');
  const dateAttrs = 'min="2000-01-01" max="2099-12-31"';
  return `<main class="page with-save"><div class="top"><button class="link" data-act="back">${t('cancel')}</button><h1 class="h-small">${r.id === 'new' ? t('newItem') : t('editItem')}</h1><span class="spacer"></span></div>
    <form id="item-form" novalidate>
    <label class="field"><span>${t('name')}</span><input name="name" value="${v('name')}" maxlength="120" required autocomplete="off"></label>
    <div class="field"><span>${t('category')}</span><div class="chips wrap">${S.cats.map((c) => `<button type="button" class="chip big ${d.category_id === c.id ? 'on' : ''}" aria-pressed="${d.category_id === c.id}" data-act="pickCat" data-id="${c.id}">${esc(c.name)}</button>`).join('')}<button type="button" class="chip big dashed" data-act="newCatInForm">${t('newCategory')}</button></div></div>
    <div class="grid2"><div class="field"><span>${t('howMany')}</span><div class="stepper"><button type="button" data-act="step" data-d="-1" aria-label="${t('fewer')}">−</button><input name="quantity" type="number" inputmode="decimal" min="0" max="99999" step="any" value="${v('quantity')}" aria-label="${t('howMany')}"><button type="button" data-act="step" data-d="1" aria-label="${t('moreQty')}">+</button></div></div>
    <label class="field"><span>${t('unit')}</span><input name="unit" value="${v('unit')}" maxlength="20" placeholder="${t('unitPlaceholder')}"></label></div>
    <label class="field"><span>${t('dateOnPackage')}</span><input name="printed_date" type="date" ${dateAttrs} value="${v('printed_date')}"></label>
    <div class="card pad"><label class="inline between" for="pao"><span class="row-t">${t('afterOpeningUse')}</span><span class="inline"><input id="pao" name="after_opening_days" type="number" inputmode="numeric" min="1" max="3650" step="1" class="tiny" value="${v('after_opening_days')}"><span>${t('days')}</span></span></label><p class="small muted">${t('afterOpeningHint')}</p></div>
    <button type="button" class="row cardlike" data-act="toggleMore" aria-expanded="${S.more}"><span class="row-t">${t('moreDetails')}</span>${icon(S.more ? 'up' : 'down')}</button>
    ${S.more ? `<label class="field"><span>${t('dateType')}</span><select name="date_type">${['expiration', 'bestBefore', 'sellBy', 'replaceBy', 'none'].map((k) => `<option value="${k}" ${d.date_type === k ? 'selected' : ''}>${t('dt_' + k)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="estimated" ${d.estimated ? 'checked' : ''}>${t('dateEstimated')}</label>
      <div class="grid2"><label class="field"><span>${t('openedOn')}</span><input name="opened_on" type="date" min="2000-01-01" max="${today()}" value="${v('opened_on')}"></label><label class="field"><span>${t('madeOn')}</span><input name="manufactured_on" type="date" min="1990-01-01" max="${today()}" value="${v('manufactured_on')}"></label></div>
      <label class="field"><span>${t('replaceEvery')}</span><input name="interval_days" type="number" inputmode="numeric" min="1" max="3650" step="1" value="${v('interval_days')}"></label>
      <label class="field"><span>${t('location')}</span><input name="location" value="${v('location')}" maxlength="80"></label>
      <label class="check"><input type="checkbox" name="running_out" ${d.running_out ? 'checked' : ''}>${t('markLow')}</label>
      <label class="field"><span>${t('notes')}</span><textarea name="notes" maxlength="1000" rows="3">${v('notes')}</textarea></label>` : ''}
    <p class="small muted">${r.id === 'new' ? t('remindersDefaultNote') : ''}</p>
    <p id="form-error" class="error" role="alert"></p>
    <div class="savebar"><button class="btn pri big" type="submit">${t('save')}</button></div></form></main>`;
}
function readForm() {
  const f = $('#item-form');
  if (!f || !S.draft) return;
  for (const el of f.elements) {
    if (!el.name) continue;
    S.draft[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
}

function ruleSummary(r) {
  const when = r.anchor === 'fixed' ? fmtDateTime(r.fixed_at)
    : r.anchor === 'opened' ? (r.offset_amount ? t('nAfterOpening', { n: r.offset_amount, u: t('u_' + r.offset_unit, { n: r.offset_amount }) }) : t('onOpeningDay'))
      : (r.offset_amount ? t('nBefore', { n: r.offset_amount, u: t('u_' + r.offset_unit, { n: r.offset_amount }) }) : t('onTheDay'));
  const at = r.anchor === 'fixed' ? '' : ', ' + r.at_time.slice(0, 5);
  const rep = r.repeat_every_amount ? ' · ' + t('everyN', { n: r.repeat_every_amount, u: t('u_' + r.repeat_every_unit, { n: r.repeat_every_amount }) }) + (r.repeat_count ? ' ×' + r.repeat_count : ' ' + t('untilDone')) : '';
  return when + at + rep;
}
function firstFire(r, i) {
  if (r.anchor === 'fixed') return r.fixed_at ? new Date(r.fixed_at) : null;
  const base = r.anchor === 'opened' ? i?.opened_on : i?.due_date;
  if (!base) return null;
  const [hh, mm] = r.at_time.split(':').map(Number);
  const d = parse(base); d.setHours(hh, mm, 0, 0);
  const ms = { minutes: 6e4, hours: 36e5, days: 864e5, weeks: 6048e5 }[r.offset_unit] * r.offset_amount;
  return new Date(d.getTime() + (r.anchor === 'opened' ? ms : -ms));
}
function vReminders(r) {
  const isDefault = r.id === 'default';
  const i = isDefault ? null : item(r.id);
  if (!isDefault && !i) return `<main class="page">${top(t('back'))}${empty(t('itemGone'))}</main>`;
  const own = S.rules.filter((x) => (isDefault ? !x.item_id : x.item_id === r.id));
  const defaults = S.rules.filter((x) => !x.item_id);
  const unitSel = (name, cur) => `<select name="${name}" aria-label="${t('unit')}">${UNITS.map((u) => `<option value="${u}" ${cur === u ? 'selected' : ''}>${t('u_' + u, { n: 2 })}</option>`).join('')}</select>`;
  const box = (x, n) => {
    if (S.openRule !== x.id) return `<div class="card"><button class="row" data-act="openRule" data-id="${x.id}" aria-expanded="false"><span class="grow"><span class="row-t">${esc(ruleSummary(x))}</span><span class="row-m">${esc(fireText(x, i))}</span></span>${icon('down')}</button></div>`;
    return `<form class="card pad rule" data-rule="${x.id}"><div class="inline between"><b>${t('reminderN', { n })}</b><span class="inline"><button type="button" class="round flat" data-act="delRule" data-id="${x.id}" aria-label="${t('deleteReminder')}">${icon('close')}</button><button type="button" class="round flat" data-act="openRule" data-id="" aria-label="${t('closeReminder')}" aria-expanded="true">${icon('up')}</button></span></div>
      <div class="field"><span>${t('when')}</span><div class="inline"><input name="offset_amount" type="number" inputmode="numeric" min="0" max="10000" class="tiny" value="${x.offset_amount}" aria-label="${t('amount')}" ${x.anchor === 'fixed' ? 'disabled' : ''}>${unitSel('offset_unit', x.offset_unit)}<select name="anchor" aria-label="${t('relativeTo')}">${['due', 'opened', 'fixed'].map((a) => `<option value="${a}" ${x.anchor === a ? 'selected' : ''}>${t('a_' + a)}</option>`).join('')}</select></div></div>
      ${x.anchor === 'fixed' ? `<label class="field"><span>${t('exactMoment')}</span><input name="fixed_at" type="datetime-local" value="${x.fixed_at ? localInput(x.fixed_at) : ''}"></label>` : `<label class="inline between"><span class="lab">${t('atTime')}</span><input name="at_time" type="time" value="${x.at_time.slice(0, 5)}"></label>`}
      <label class="inline between"><span class="lab">${t('repeat')}</span><input type="checkbox" name="rep" class="sw" ${x.repeat_every_amount ? 'checked' : ''}></label>
      ${x.repeat_every_amount ? `<div class="inline"><span>${t('every')}</span><input name="repeat_every_amount" type="number" inputmode="numeric" min="1" max="10000" class="tiny" value="${x.repeat_every_amount}" aria-label="${t('amount')}">${unitSel('repeat_every_unit', x.repeat_every_unit)}</div>
        <label class="inline"><input type="radio" name="stop" value="count" ${x.repeat_count ? 'checked' : ''}>${t('stopAfter')}<input name="repeat_count" type="number" inputmode="numeric" min="1" max="100" class="tiny" value="${x.repeat_count || 3}" aria-label="${t('times')}">${t('moreTimes')}</label>
        <label class="inline"><input type="radio" name="stop" value="done" ${x.repeat_count ? '' : 'checked'}>${t('keepUntilDone')}</label>` : ''}
      <p class="hint">${esc(fireText(x, i))}</p><p class="error" role="alert"></p></form>`;
  };
  const body = !isDefault && !own.length
    ? `<p class="hint">${t('usingDefaultsLong')}</p>${card(defaults.map((x) => `<div class="row"><span class="row-t">${esc(ruleSummary(x))}</span></div>`).join('') || empty(t('noReminders')))}<button class="btn line" data-act="copyDefaults" data-id="${r.id}">${t('customizeForItem')}</button>`
    : `${own.map((x, n) => box(x, n + 1)).join('') || empty(t('noReminders'))}<button class="btn dashed" data-act="addRule" data-id="${r.id}">${t('addReminder')}</button>${!isDefault ? `<button class="link center" data-act="useDefaults" data-id="${r.id}">${t('backToDefaults')}</button>` : ''}`;
  return `<main class="page">${top(t('back'), `<button class="link" data-act="back">${t('done')}</button>`)}${h1(isDefault ? t('defaultReminders') : t('reminders'), isDefault ? t('defaultRemindersSub') : `${i.name}${i.due_date ? ' · ' + t('dueOn', { d: fmtDate(i.due_date) }) : ''}`)}
    <p class="notice">${t('pushLater')}</p>${body}</main>`;
}
const localInput = (isoStr) => { const d = new Date(isoStr); return `${iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function fireText(x, i) {
  const f = firstFire(x, i);
  if (!f) return x.anchor === 'opened' ? t('firesAfterOpen') : i ? t('firesNeedsDate') : t('firesPerItem');
  return t('firesAt', { d: fmtDateTime(f) }) + (x.repeat_every_amount ? ', ' + t('thenEvery', { n: x.repeat_every_amount, u: t('u_' + x.repeat_every_unit, { n: x.repeat_every_amount }) }) + (x.repeat_count ? ', ' + t('nMoreTimes', { n: x.repeat_count }) : ', ' + t('untilDone')) : '') + '.';
}

function vAlerts() {
  const list = S.items.filter(needsAttention).sort(urgency);
  return `<main class="page with-nav">${h1(t('reminders'), list.length ? t('toDealWith', { n: list.length }) : t('allClear'))}<p class="notice">${t('pushLater')}</p>
    ${list.map((i) => `<div class="card pad"><a class="row bare" href="#/item/${i.id}"><span class="grow"><span class="row-t">${esc(i.name)}</span><span class="row-m">${meta(i)}</span></span>${pill(i)}</a>${quickBtns(i)}</div>`).join('') || empty(t('nothingDue'))}</main>${nav('alerts')}`;
}

function vAssistant() {
  return `<main class="page">${top(t('home'))}${h1(t('assistant'), t('assistantSub'))}<div class="card pad"><p>${t('assistantSoon')}</p><a class="btn pri" href="#/edit/new">${t('addManually')}</a></div></main>`;
}

function vMore() {
  const guest = S.user?.is_anonymous;
  return `<main class="page">${top(t('home'))}${h1(t('more'), `${S.hh.name} · ${guest ? t('guestMode') : t('signedIn')}`)}
    ${card(rowLink('#/shopping', t('shoppingList'), '', `<span class="muted small">${t('nToBuy', { n: S.shop.filter((x) => !x.checked).length })}</span>`))}
    ${card(rowLink('#/reminders/default', t('defaultReminders'), esc(S.rules.filter((x) => !x.item_id).map(ruleSummary).join(' · ') || t('noReminders'))) + rowLink('#/categories', t('categories'), '', `<span class="muted small">${S.cats.length}</span>`) + rowLink('#/customize', t('homeScreen'), ''))}
    ${card(`<button class="row" data-act="rename"><span class="row-t">${t('homeName')}</span><span class="muted small">${esc(S.hh.name)}</span></button><button class="row" data-act="copyCode"><span class="grow"><span class="row-t">${t('familyCode')}</span><span class="row-m">${t('familyCodeSub')}</span></span><span class="link">${t('copy')}</span></button><button class="row" data-act="lang"><span class="row-t">${t('language')}</span><span class="muted small">${getLang() === 'en' ? 'English' : '한국어'}</span></button><button class="row" data-act="signOut"><span class="row-t danger">${t('signOut')}</span></button>`)}
    <p class="small muted center">${t('version')}</p></main>`;
}

function vShopping() {
  const row = (x) => `<label class="row"><input type="checkbox" class="sw" data-shop="${x.id}" ${x.checked ? 'checked' : ''}><span class="grow ${x.checked ? 'done' : ''}"><span class="row-t">${esc(x.name)}</span><span class="row-m">${num(x.quantity)} ${esc(x.unit)}</span></span><button type="button" class="round flat" data-act="delShop" data-id="${x.id}" aria-label="${t('delete')}">${icon('close')}</button></label>`;
  const open = S.shop.filter((x) => !x.checked), done = S.shop.filter((x) => x.checked);
  return `<main class="page">${top(t('back'))}${h1(t('shoppingList'), t('shoppingSub'))}
    <form id="shop-form" class="inline"><input name="name" maxlength="120" required placeholder="${t('addToBuy')}" aria-label="${t('addToBuy')}"><button class="btn pri">${t('add')}</button></form>
    ${open.length ? card(open.map(row).join('')) : empty(t('nothingToBuy'))}${done.length ? `<div class="h2"><h2>${t('bought')}</h2></div>${card(done.map(row).join(''))}` : ''}</main>`;
}

function vCustomize() {
  const shown = S.layout.order.filter((x) => !S.layout.hidden.includes(x)), hidden = S.layout.order.filter((x) => S.layout.hidden.includes(x));
  const row = (x, n, list) => `<div class="row"><span class="grow"><span class="row-t">${t('sec_' + x)}</span><span class="row-m">${t('secd_' + x)}</span></span><button class="round flat" data-act="move" data-id="${x}" data-d="-1" aria-label="${t('moveUp')}" ${n === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="round flat" data-act="move" data-id="${x}" data-d="1" aria-label="${t('moveDown')}" ${n === list.length - 1 ? 'disabled' : ''}>${icon('down')}</button><input type="checkbox" class="sw" data-sec="${x}" ${S.layout.hidden.includes(x) ? '' : 'checked'} aria-label="${t('show')} ${t('sec_' + x)}"></div>`;
  return `<main class="page">${top(t('back'), `<button class="link" data-act="back">${t('done')}</button>`)}${h1(t('customizeTitle'), t('customizeSub'))}
    <p class="sec">${t('shown')}</p>${card(`<div class="row"><span class="grow"><span class="row-t">${t('assistant')}</span><span class="row-m">${t('secd_assistant')}</span></span><span class="muted small">${t('alwaysShown')}</span></div>` + shown.map(row).join(''))}
    ${hidden.length ? `<p class="sec">${t('hidden')}</p>${card(hidden.map(row).join(''))}` : ''}
    <button class="link center" data-act="resetLayout">${t('resetDefault')}</button></main>`;
}

function vCategories() {
  return `<main class="page">${top(t('back'))}${h1(t('categories'), t('categoriesSub'))}
    ${S.cats.length ? card(S.cats.map((c) => `<div class="row"><span class="grow"><span class="row-t">${esc(c.name)}</span><span class="row-m">${t('nItems', { n: S.items.filter((i) => i.category_id === c.id).length })}</span></span><button class="link" data-act="renameCat" data-id="${c.id}">${t('rename')}</button><button class="round flat" data-act="delCat" data-id="${c.id}" aria-label="${t('delete')} ${esc(c.name)}">${icon('close')}</button></div>`).join('')) : empty(t('noCategories'))}
    <button class="btn dashed" data-act="newCat">${t('newCategory')}</button></main>`;
}

const VIEWS = { home: vHome, items: vItems, item: vItem, edit: vEdit, reminders: vReminders, alerts: vAlerts, assistant: vAssistant, more: vMore, shopping: vShopping, customize: vCustomize, categories: vCategories };
let lastRoute = '';
function render() {
  const r = route();
  document.documentElement.lang = getLang();
  if (!S.user) { $('#app').innerHTML = vWelcome(); return; }
  if (!S.ready) { $('#app').innerHTML = `<main class="page"><p class="empty">${t('loading')}</p></main>`; return; }
  const key = location.hash;
  if (key !== lastRoute) {
    // Leaving a list always clears its filter and search, so nothing stays hidden by a forgotten filter.
    const prev = lastRoute.slice(1).split('?')[0].split('/').filter(Boolean);
    const samePlace = prev[0] === 'items' && r.name === 'items' && (prev[1] || 'all') === (r.id || 'all');
    const returning = r.name === 'items' && ['item', 'edit'].includes(prev[0]);
    if (!samePlace && !returning && !['item', 'edit'].includes(r.name)) { S.filter = 'all'; S.q = ''; }
    if (r.name !== 'edit') S.draft = null;
    if (r.name !== 'reminders') S.openRule = null;
    lastRoute = key;
    window.scrollTo(0, 0);
  }
  $('#app').innerHTML = (VIEWS[r.name] || vHome)(r);
  if (r.name === 'items' && r.q.get('focus') && !S.q) $('#search')?.focus();
}

// ---------- actions ----------
const A = {
  back,
  undo: () => { const u = S.undo; $('#toast').innerHTML = ''; S.undo = null; if (u) run(u); },
  lang: () => run(async () => { setLang(getLang() === 'en' ? 'ko' : 'en'); if (S.user) await api.saveSettings(S.user.id, { language: getLang() }).catch(() => {}); render(); }),
  guest: () => run(async () => { S.user = await api.signInGuest(); await start(); }),
  signOut: () => run(async () => {
    const guest = S.user?.is_anonymous;
    if (!(await ask({ title: t('signOutQ'), body: guest ? t('signOutGuestWarn') : '', ok: t('signOut'), danger: guest }))) return;
    await api.signOut(); Object.assign(S, { user: null, hh: null, ready: false, items: [], cats: [], rules: [], shop: [], layout: DEFAULT_LAYOUT }); go('#/home'); render();
  }),
  filter: (d) => { S.filter = d.f; render(); },
  usedOne: (d) => run(async () => { const i = item(d.id); const q = Math.max(0, num(i.quantity) - 1); await patchItem(i, { quantity: q, running_out: q === 0 ? true : i.running_out }, t('usedOneDone', { name: i.name }), 'consumed', Math.min(1, num(i.quantity))); }),
  usedUp: (d) => run(async () => { const i = item(d.id); await patchItem(i, { quantity: 0, running_out: true }, t('usedUpDone', { name: i.name }), 'consumed', num(i.quantity)); }),
  threw: (d) => run(async () => { const i = item(d.id); await patchItem(i, { quantity: 0 }, t('threwDone', { name: i.name }), 'wasted', num(i.quantity)); }),
  openToday: (d) => run(async () => { const i = item(d.id); await patchItem(i, { opened_on: today() }, t('openedDone', { d: fmtDate(addDays(today(), i.after_opening_days)) }), 'opened', 0); }),
  openOther: (d) => run(async () => { const i = item(d.id); const v = await ask({ title: t('whenOpened'), input: today(), type: 'date', ok: t('save') }); if (!v) return; if (v > today()) return toast(t('errFutureOpen')); await patchItem(i, { opened_on: v }, t('openedDone', { d: fmtDate(addDays(v, i.after_opening_days)) }), 'opened', 0); }),
  unopen: (d) => run(async () => { await patchItem(item(d.id), { opened_on: null }, t('markedUnopened')); }),
  setPao: (d) => run(async () => { const v = await ask({ title: t('afterOpeningUse'), body: t('afterOpeningHint'), input: '', type: 'number', ok: t('save') }); const n = Math.floor(Number(v)); if (!v) return; if (!(n >= 1 && n <= 3650)) return toast(t('errDays')); await patchItem(item(d.id), { after_opening_days: n }, t('saved')); }),
  replaced: (d) => run(async () => { const i = item(d.id); await patchItem(i, { date_type: 'replaceBy', printed_date: addDays(today(), i.interval_days), acquired_on: today(), opened_on: null, quantity: Math.max(1, num(i.quantity)), running_out: false, estimated: false }, t('replacedDone', { d: fmtDate(addDays(today(), i.interval_days)) })); }),
  toShop: (d) => run(async () => {
    const i = item(d.id);
    if (S.shop.some((x) => x.item_id === i.id && !x.checked)) return toast(t('alreadyOnList'));
    const row = await api.insert('shopping_entries', { household_id: S.hh.id, item_id: i.id, name: i.name, quantity: 1, unit: i.unit || '' });
    await load('shop'); render();
    toast(t('addedToShopping', { name: i.name }), async () => { await api.remove('shopping_entries', row.id); await load('shop'); render(); toast(t('undone')); });
  }),
  delItem: (d) => run(async () => {
    const i = item(d.id);
    if (!(await ask({ title: t('deleteQ', { name: i.name }), ok: t('delete'), danger: true }))) return;
    const rules = S.rules.filter((x) => x.item_id === i.id);
    await api.remove('items', i.id); await load('items', 'rules');
    back();
    const { due_date, created_at, updated_at, ...row } = i;
    toast(t('deletedDone', { name: i.name }), async () => { await api.insert('items', row); for (const { created_at: c, updated_at: u, ...x } of rules) await api.insert('reminder_rules', x); await load('items', 'rules'); render(); toast(t('undone')); });
  }),
  pickCat: (d) => { readForm(); S.draft.category_id = S.draft.category_id === d.id ? '' : d.id; render(); },
  toggleMore: () => { readForm(); S.more = !S.more; render(); },
  step: (d) => { readForm(); S.draft.quantity = Math.max(0, (Number(S.draft.quantity) || 0) + Number(d.d)); render(); },
  newCat: () => run(async () => { const c = await createCategory(); if (c) { await load('cats'); render(); } }),
  newCatInForm: () => run(async () => { readForm(); const c = await createCategory(); if (c) { await load('cats'); S.draft.category_id = c.id; render(); } }),
  renameCat: (d) => run(async () => { const c = cat(d.id); const v = await ask({ title: t('renameCategory'), input: c.name, ok: t('save') }); if (!v || v === c.name) return; await api.update('categories', c.id, { name: v }); await load('cats'); render(); }),
  delCat: (d) => run(async () => {
    const c = cat(d.id), n = S.items.filter((i) => i.category_id === c.id).length;
    if (!(await ask({ title: t('deleteQ', { name: c.name }), body: n ? t('deleteCatKeeps', { n }) : '', ok: t('delete'), danger: true }))) return;
    await api.remove('categories', c.id); await load('cats', 'items'); render(); toast(t('deletedDone', { name: c.name }));
  }),
  rename: () => run(async () => { const v = await ask({ title: t('homeName'), input: S.hh.name, ok: t('save') }); if (!v) return; await api.update('households', S.hh.id, { name: v.slice(0, 40) }); S.hh.name = v.slice(0, 40); render(); }),
  copyCode: () => run(async () => { try { await navigator.clipboard.writeText(S.hh.join_code); toast(t('codeCopied')); } catch { await ask({ title: t('familyCode'), body: S.hh.join_code, ok: t('ok') }); } }),
  openRule: (d) => run(async () => { await saveOpenRule(); S.openRule = d.id || null; render(); }),
  addRule: (d) => run(async () => { await saveOpenRule(); const row = await api.insert('reminder_rules', { household_id: S.hh.id, item_id: d.id === 'default' ? null : d.id, anchor: 'due', offset_amount: 1, offset_unit: 'days', at_time: '09:00' }); await load('rules'); S.openRule = row.id; render(); }),
  delRule: (d) => run(async () => { const { created_at, updated_at, ...row } = S.rules.find((x) => x.id === d.id); await api.remove('reminder_rules', d.id); S.openRule = null; await load('rules'); render(); toast(t('reminderDeleted'), async () => { await api.insert('reminder_rules', row); await load('rules'); render(); toast(t('undone')); }); }),
  copyDefaults: (d) => run(async () => { for (const { id, created_at, updated_at, ...x } of S.rules.filter((r) => !r.item_id)) await api.insert('reminder_rules', { ...x, item_id: d.id }); await load('rules'); render(); }),
  useDefaults: (d) => run(async () => { if (!(await ask({ title: t('backToDefaultsQ'), ok: t('ok') }))) return; for (const x of S.rules.filter((r) => r.item_id === d.id)) await api.remove('reminder_rules', x.id); S.openRule = null; await load('rules'); render(); }),
  delShop: (d) => run(async () => { await api.remove('shopping_entries', d.id); await load('shop'); render(); }),
  move: (d) => run(async () => { const o = [...S.layout.order], group = o.filter((x) => S.layout.hidden.includes(x) === S.layout.hidden.includes(d.id)), n = group.indexOf(d.id), other = group[n + Number(d.d)]; if (!other) return; const a = o.indexOf(d.id), b = o.indexOf(other); [o[a], o[b]] = [o[b], o[a]]; await saveLayout({ ...S.layout, order: o }); }),
  resetLayout: () => run(() => saveLayout(DEFAULT_LAYOUT)),
};
async function saveLayout(layout) { S.layout = layout; render(); await api.saveSettings(S.user.id, { home_layout: layout }); }
async function createCategory() {
  const v = await ask({ title: t('newCategoryTitle'), input: '', ok: t('create') });
  if (!v) return null;
  if (S.cats.some((c) => c.name.toLowerCase() === v.toLowerCase())) { toast(t('errDuplicateCategory')); return null; }
  return api.insert('categories', { household_id: S.hh.id, name: v, sort_order: S.cats.length });
}
// Read the open reminder box and save it. Throws a readable message when the values are not valid.
async function saveOpenRule() {
  const f = $('form.rule');
  if (!f) return;
  const g = (n) => f.elements[n], x = S.rules.find((r) => r.id === f.dataset.rule);
  if (!x) return;
  const patch = { anchor: g('anchor').value, offset_unit: g('offset_unit').value };
  patch.offset_amount = patch.anchor === 'fixed' ? 0 : Math.floor(Number(g('offset_amount').value));
  if (!(patch.offset_amount >= 0 && patch.offset_amount <= 10000)) fail(t('errAmount'));
  if (patch.anchor === 'fixed') { const v = g('fixed_at')?.value; patch.fixed_at = v ? new Date(v).toISOString() : new Date(Date.now() + 864e5).toISOString(); } else { patch.fixed_at = null; if (g('at_time')?.value) patch.at_time = g('at_time').value; }
  if (g('rep').checked) {
    patch.repeat_every_amount = Math.floor(Number(g('repeat_every_amount')?.value || 1));
    patch.repeat_every_unit = g('repeat_every_unit')?.value || 'days';
    if (!(patch.repeat_every_amount >= 1) || (patch.repeat_every_unit === 'minutes' && patch.repeat_every_amount < 5)) fail(t('errRepeat'));
    const byCount = g('stop') ? g('stop').value === 'count' : false;
    patch.repeat_count = byCount ? Math.floor(Number(g('repeat_count').value)) : null;
    if (byCount && !(patch.repeat_count >= 1 && patch.repeat_count <= 100)) fail(t('errCount'));
  } else Object.assign(patch, { repeat_every_amount: null, repeat_every_unit: null, repeat_count: null });
  if (Object.keys(patch).every((k) => String(patch[k] ?? '') === String(k === 'at_time' ? x[k]?.slice(0, 5) : x[k] ?? ''))) return;
  await api.update('reminder_rules', x.id, patch);
  await load('rules');
}

async function saveItem() {
  readForm();
  const d = S.draft, err = (m) => { $('#form-error').textContent = m; $('#form-error').scrollIntoView({ block: 'center' }); };
  const name = String(d.name).trim(), n = Number(d.quantity);
  if (!name) return err(t('errName'));
  if (d.quantity === '' || !Number.isFinite(n) || n < 0 || n > 99999) return err(t('errQuantity'));
  const days = (v, label) => { if (v === '' || v === null || v === undefined) return null; const k = Math.floor(Number(v)); if (!(k >= 1 && k <= 3650)) throw new Error(label); return k; };
  let pao, interval;
  try { pao = days(d.after_opening_days, t('errDays')); interval = days(d.interval_days, t('errDays')); } catch (e) { return err(e.message); }
  const bad = (v) => v && !/^(19|20)\d\d-\d\d-\d\d$/.test(v);
  if (bad(d.printed_date) || bad(d.opened_on) || bad(d.manufactured_on)) return err(t('errDate'));
  if (d.opened_on && d.opened_on > today()) return err(t('errFutureOpen'));
  if (d.manufactured_on && d.printed_date && d.printed_date < d.manufactured_on) return err(t('errDateOrder'));
  const row = { name, category_id: d.category_id || null, quantity: n, unit: String(d.unit || '').trim(), printed_date: d.printed_date || null, after_opening_days: pao, date_type: d.date_type || 'expiration', estimated: !!d.estimated, location: String(d.location || '').trim(), notes: String(d.notes || '').trim(), manufactured_on: d.manufactured_on || null, interval_days: interval, opened_on: d.opened_on || null, running_out: !!d.running_out };
  if (row.date_type === 'replaceBy' && !row.printed_date && interval) row.printed_date = addDays(today(), interval);
  await run(async () => {
    if (d.id) { await api.update('items', d.id, row); await load('items'); S.draft = null; back(); toast(t('saved')); return; }
    // Same name, category AND date is the same batch: offer to add to it. A different date is a separate entry.
    const twin = S.items.find((i) => i.name.toLowerCase() === name.toLowerCase() && (i.category_id || null) === row.category_id && (i.printed_date || null) === row.printed_date);
    if (twin && (await ask({ title: t('duplicateQ', { name }), body: t('duplicateBody', { q: qty(twin) }), ok: t('addToExisting') }))) {
      await api.update('items', twin.id, { quantity: num(twin.quantity) + n }); await load('items'); S.draft = null; back(); toast(t('saved')); return;
    }
    const made = await api.insert('items', { household_id: S.hh.id, ...row });
    await load('items'); S.draft = null; S.q = ''; back();
    toast(t('addedDone', { name }), async () => { await api.remove('items', made.id); await load('items'); render(); toast(t('undone')); });
  });
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  e.preventDefault();
  A[el.dataset.act]?.(el.dataset, el);
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'item-form') saveItem();
  if (f.id === 'join-form') run(async () => { S.user = (await api.user()) || (await api.signInGuest()); await api.rpc('join_household', { code: f.elements.code.value }); await start(); });
  if (f.id === 'shop-form') run(async () => { const name = f.elements.name.value.trim(); if (!name) return; const linked = S.items.find((i) => i.name.toLowerCase() === name.toLowerCase()); await api.insert('shopping_entries', { household_id: S.hh.id, name, quantity: 1, unit: linked?.unit || '', item_id: linked?.id || null }); await load('shop'); render(); $('#shop-form input')?.focus(); });
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'search') return;
  S.q = e.target.value;
  const r = route();
  $('#results').innerHTML = resultsHtml(r.id || 'all'); // only the list is redrawn, so typing is never interrupted
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.sec) run(() => saveLayout({ ...S.layout, hidden: el.checked ? S.layout.hidden.filter((x) => x !== el.dataset.sec) : [...S.layout.hidden, el.dataset.sec] }));
  if (el.dataset.shop) run(() => toggleShop(el.dataset.shop, el.checked));
  if (el.closest('form.rule')) run(async () => { try { await saveOpenRule(); render(); } catch (err) { el.closest('form.rule').querySelector('.error').textContent = err.message; } });
});
// Ticking adds exactly the bought quantity to stock; un-ticking takes exactly that back and never leaves an empty item behind.
async function toggleShop(id, checked) {
  const x = S.shop.find((s) => s.id === id), i = x.item_id && item(x.item_id), n = num(x.quantity);
  if (checked) {
    if (i) { await api.update('items', i.id, { quantity: num(i.quantity) + n, running_out: false }); await api.update('shopping_entries', id, { checked: true }); }
    else { const made = await api.insert('items', { household_id: S.hh.id, name: x.name, quantity: n, unit: x.unit || '', date_type: 'none' }); await api.update('shopping_entries', id, { checked: true, item_id: made.id }); }
  } else {
    // An item that only exists because of this tick (made after the entry, nothing else filled in) is removed again.
    const bornHere = i && i.created_at > x.created_at && !i.due_date && !i.category_id && !i.notes && num(i.quantity) <= n;
    if (bornHere) { await api.update('shopping_entries', id, { checked: false, item_id: null }); await api.remove('items', i.id); }
    else { if (i) await api.update('items', i.id, { quantity: Math.max(0, num(i.quantity) - n) }); await api.update('shopping_entries', id, { checked: false }); }
  }
  await load('items', 'shop'); render();
}
window.addEventListener('hashchange', render);
window.addEventListener('online', () => { $('#offline').hidden = true; });
window.addEventListener('offline', () => { $('#offline').hidden = false; });

async function start() {
  S.ready = false; render();
  await enter();
  const st = await api.settings(S.user.id).catch(() => null);
  if (st?.language && st.language !== getLang()) setLang(st.language);
  S.ready = true; render();
}
(async () => {
  $('#offline').hidden = navigator.onLine;
  try {
    api = await createApi();
    S.user = await api.user();
    if (S.user) await start(); else render();
  } catch (e) { console.error(e); $('#app').innerHTML = `<main class="page"><p class="empty">${esc(friendly(e))}</p><button class="btn pri" onclick="location.reload()">${t('retry')}</button></main>`; }
  if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('mock')) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
