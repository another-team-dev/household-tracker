import { t, setLang, getLang, fmtDate, fmtDateTime, dateState, maskDate, datePlaceholder, getDateFormat, setDateFormat, DATE_FORMATS } from './i18n.js';
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
const snoozed = (i) => !!i.snoozed_until && new Date(i.snoozed_until) > new Date();
const dueSoon = (i) => ['expired', 'soon'].includes(info(i).status);
const needsAttention = (i) => dueSoon(i) && !snoozed(i);
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
function ask({ title, body = '', input = null, ok = t('ok'), danger = false, v = '', max = '', placeholder = '' }) {
  return new Promise((resolve) => {
    const field = input === null ? '' : `<div class="field"><input id="ask-input" value="${esc(input)}" ${v ? `data-v="${v}"` : ''} ${max ? `data-max="${max}"` : ''} ${v === 'date' || v === 'days' ? 'inputmode="numeric"' : ''} placeholder="${esc(placeholder)}" maxlength="60" autocomplete="off" aria-label="${esc(title)}"><p class="msg" role="alert"></p></div>`;
    $('#modal').innerHTML = `<div class="backdrop"><form class="sheet" id="ask-form" novalidate><h2>${esc(title)}</h2>${body ? `<p class="muted">${esc(body)}</p>` : ''}${field}<div class="row-btns"><button type="button" class="btn soft" data-ask="cancel">${t('cancel')}</button><button type="submit" class="btn ${danger ? 'danger' : 'pri'}">${esc(ok)}</button></div></form></div>`;
    const done = (val) => { $('#modal').innerHTML = ''; resolve(val); };
    $('#ask-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (input === null) return done(true);
      const el = $('#ask-input'), val = el.value.trim();
      if (!val) { mark(el, t('errEmpty')); return el.focus(); }
      if (v && check(el, true)) return el.focus(); // stays open, the wrong value stays visible and red
      done(val);
    });
    $('#modal').querySelector('[data-ask]').addEventListener('click', () => done(null));
    (input === null ? $('#ask-form button[type=submit]') : $('#ask-input')).focus();
  });
}
// A short list of choices; resolves to the chosen value or null.
function choose({ title, body = '', options }) {
  return new Promise((resolve) => {
    $('#modal').innerHTML = `<div class="backdrop"><div class="sheet" role="dialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${body ? `<p class="muted">${esc(body)}</p>` : ''}${options.map((o, n) => `<button class="btn ${o.on ? 'pri' : 'line'}" data-choice="${n}">${esc(o.label)}</button>`).join('')}<button class="btn soft" data-choice="-1">${t('cancel')}</button></div></div>`;
    $('#modal').querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => { $('#modal').innerHTML = ''; resolve(options[b.dataset.choice]?.value ?? null); }));
    $('#modal').querySelector('[data-choice]').focus();
  });
}

// ---------- checking what is typed ----------
// Runs while typing (final = false: only what is already certainly wrong) and when leaving the field or saving (final = true).
// A wrong value is never cleared: the field turns red and says what is expected.
function check(el, final = false) {
  const val = el.value.trim(), kind = el.dataset.v;
  let m = '';
  if (kind === 'name') { if (final && !val) m = t('errName'); }
  else if (kind === 'qty') {
    const n = Number(val.replace(',', '.'));
    if (/[^\d.,]/.test(val)) m = t('errQuantity');
    else if (final && (val === '' || !Number.isFinite(n) || n <= 0 || n > 99999)) m = t('errQuantity');
  } else if (kind === 'days') {
    if (/\D/.test(val) || Number(val) > 3650) m = t('errDays');
    else if (final && val !== '' && Number(val) < 1) m = t('errDays');
  } else if (kind === 'code') {
    if (/[^0-9a-f]/i.test(val) || val.length > 18) m = t('errCodeFormat');
    else if (final && val.length !== 18) m = t('errCodeFormat');
  } else if (kind === 'date' && val) {
    const st = dateState(val);
    if (st.state === 'bad') m = t('errDateLive', { f: datePlaceholder() });
    else if (st.state === 'partial') { if (final) m = t('errDateIncomplete', { f: datePlaceholder() }); }
    else if (el.dataset.max === 'today' && st.iso > today()) m = t('errFutureOpen');
  }
  mark(el, m);
  return m;
}
function mark(el, m) {
  el.setAttribute('aria-invalid', m ? 'true' : 'false');
  const p = el.closest('.field, .fl-wrap')?.querySelector('.msg');
  if (p) p.textContent = m;
}
const toIso = (text) => { const st = dateState(String(text || '').trim()); return st.state === 'ok' ? st.iso : null; };

// ---------- data ----------
async function load(...tables) {
  const map = { items: 'items', cats: 'categories', rules: 'reminder_rules', shop: 'shopping_entries' };
  const keys = tables.length ? tables : Object.keys(map);
  const rows = await Promise.all(keys.map((k) => api.select(map[k], S.hh.id)));
  keys.forEach((k, n) => { S[k] = rows[n]; });
  // Nothing with quantity 0 is kept or counted: an item that is used up leaves the inventory.
  S.items = S.items.filter((i) => num(i.quantity) > 0);
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

// Take an item out of the inventory and offer Undo that puts it back with its reminders.
async function removeItem(i, message, kind, amount) {
  const rules = S.rules.filter((x) => x.item_id === i.id);
  await api.remove('items', i.id);
  if (kind) api.insert('activity_log', { household_id: S.hh.id, item_name: i.name, kind, quantity: amount, unit: i.unit || '' }).catch(() => {});
  await load('items', 'rules');
  if (route().name === 'item' && route().id === i.id) back(); else render();
  const { due_date, created_at, updated_at, ...row } = i;
  toast(message, async () => { await api.insert('items', row); for (const { created_at: c, updated_at: u, ...x } of rules) await api.insert('reminder_rules', x); await load('items', 'rules'); render(); toast(t('undone')); });
}

// ---------- views ----------
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
const ICONS = {
  back: 'm14 5-7 7 7 7', plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M6 18 18 6', search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4', spark: 'm12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z', cal: 'M4 6h16v15H4ZM4 10h16M8 3v5M16 3v5', down: 'm6 9 6 6 6-6', up: 'm6 15 6-6 6 6',
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
    <form id="join-form" class="join field" novalidate><div class="lab-row"><span>${t('haveCode')}</span>${infoBtn()}</div><p class="tip" hidden>${t('tip_code')}</p>
      <div class="inline start"><div class="fl-wrap grow">${floating('code', t('codePlaceholder'), 'data-v="code" maxlength="24" autocapitalize="off" spellcheck="false"')}<p class="msg" role="alert"></p></div><button class="btn line">${t('join')}</button></div></form>
    <button class="link center" data-act="lang">${getLang() === 'en' ? '한국어' : 'English'}</button></main>`;
}
// Input whose label starts inside the box and moves up onto its top edge once you type, so it never disappears.
const floating = (name, label, attrs = '') => `<label class="fl"><input name="${name}" placeholder=" " autocomplete="off" ${attrs}><span>${esc(label)}</span></label>`;
const infoBtn = () => `<button type="button" class="info" data-act="tip" aria-expanded="false" aria-label="${t('tipWhat')}">i</button>`;

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
    return `<section><div class="h2"><h2>${t('categories')}</h2><a class="link" href="#/categories">${t('edit')}</a></div><div class="tiles">${tile('#/items/all', t('allItems'), S.items, 'all')}${S.cats.map((c) => tile(`#/items/${c.id}`, c.name, S.items.filter((i) => i.category_id === c.id))).join('')}${uncategorized.length ? tile('#/items/none', t('uncategorized'), uncategorized) : ''}<button class="tile add" data-act="newCat">${t('newCategory')}</button></div></section>`;
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
    const list = S.items.filter((i) => i.running_out);
    return `<section><div class="h2"><h2>${t('runningLow')}</h2></div>${list.length ? card(list.slice(0, 3).map((i) => itemRow(i)).join('')) : empty(t('nothingLow'))}</section>`;
  },
};

function vHome() {
  const date = new Date().toLocaleDateString(getLang() === 'ko' ? 'ko-KR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const sections = S.layout.order.filter((x) => !S.layout.hidden.includes(x)).map((x) => SECTION_VIEW[x]()).join('');
  return `<main class="page with-nav"><div class="top"><div><p class="sub">${esc(date)}</p><h1>${esc(S.hh.name)}</h1><p class="sub">${t('totalItems', { n: S.items.length, c: S.cats.length })}</p></div><div class="inline"><a class="round" href="#/items/all?focus=1" aria-label="${t('search')}">${icon('search')}</a><a class="round" href="#/more" aria-label="${t('more')}">${icon('more', 'bold')}</a></div></div>
    <a class="assist-card" href="#/assistant"><span class="assist-h">${icon('spark')}${t('assistCard')}</span><span class="assist-in">${t('assistExample')}</span></a>
    <a class="btn line" href="#/edit/new">${icon('plus')}${t('addManuallyBtn')}</a>
    ${sections}<a class="link center" href="#/customize">${t('customizeHome')}</a></main>${nav('home')}`;
}

function listFor(id) {
  const q = S.q.trim().toLowerCase();
  let list = S.items;
  // A search always covers every category, and the screen says so.
  if (q) list = list.filter((i) => [i.name, catName(i.category_id), i.location, i.notes].join(' ').toLowerCase().includes(q));
  else if (id === 'none') list = list.filter((i) => !i.category_id);
  else if (id !== 'all') list = list.filter((i) => i.category_id === id);
  const f = { all: () => true, soon: needsAttention, opened: (i) => !!i.opened_on, low: (i) => i.running_out, nodate: (i) => !i.due_date }[S.filter];
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
const quickBtns = (i) => `<div class="row-btns"><button class="btn line" data-act="usedOne" data-id="${i.id}">${t('usedOne')}</button><button class="btn line" data-act="usedUp" data-id="${i.id}">${t('usedUp')}</button><button class="btn line" data-act="threw" data-id="${i.id}">${t('threwAway')}</button></div>`;

function vItems(r) {
  const id = r.id || 'all';
  const { base } = listFor(id);
  const count = (key, fn) => base.filter(fn).length;
  const chips = [['all', t('fAll'), base.length], ['soon', t('fSoon'), count('soon', needsAttention)], ['opened', t('fOpened'), count('o', (i) => !!i.opened_on)], ['low', t('fLow'), count('l', (i) => i.running_out)], ['nodate', t('fNoDate'), count('n', (i) => !i.due_date)]];
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
      ? `${kv(t('opened'), fmtDate(i.opened_on))}<p class="small muted">${t('useBy', { d: fmtDate(i.due_date) })}</p><button class="btn soft" data-act="unopen" data-id="${i.id}">${t('clearOpened')}</button>`
      : `${kv(t('opened'), t('notYet'))}<p class="q">${t('haveYouOpened')}</p><div class="row-btns"><button class="btn pri" data-act="openToday" data-id="${i.id}">${t('openedToday')}</button><button class="btn line" data-act="openOther" data-id="${i.id}">${t('anotherDate')}</button></div><p class="small muted">${t('ifOpenedToday', { d: fmtDate(addDays(today(), i.after_opening_days)) })}</p>`)
    : `<button class="link" data-act="setPao" data-id="${i.id}">${t('addAfterOpening')}</button>`;
  const own = S.rules.filter((x) => x.item_id === i.id);
  return `<main class="page">${top(catName(i.category_id), `<a class="link" href="#/edit/${i.id}">${t('edit')}</a>`)}
    <div class="top">${h1(i.name, `${catName(i.category_id)} · ${qty(i)}${i.location ? ' · ' + i.location : ''}`)}${pill(i)}</div>
    <div class="card pad">${i.date_type !== 'none' ? kv(t('dt_' + i.date_type), i.printed_date ? fmtDate(i.printed_date) + (i.estimated ? ` (${t('estimated')})` : '') : t('notSet')) : kv(t('date'), t('noDate'))}${i.after_opening_days ? kv(t('afterOpening'), t('withinDays', { n: i.after_opening_days })) : ''}${openBlock}</div>
    ${quickBtns(i)}
    ${i.interval_days ? `<button class="btn line" data-act="replaced" data-id="${i.id}">${t('replacedToday', { n: i.interval_days })}</button>` : ''}
    <div class="card pad"><div class="kv"><span>${t('remindersN', { n: own.length || S.rules.filter((x) => !x.item_id).length })}</span><b>${own.length ? t('ownReminders') : t('usingDefaults')}</b></div><p class="small muted">${esc((own.length ? own : S.rules.filter((x) => !x.item_id)).map(ruleSummary).join(' · ') || t('noReminders'))}</p><a class="btn line" href="#/reminders/${i.id}">${icon('bell')}${t('changeReminders')}</a></div>
    <button class="btn soft" data-act="toShop" data-id="${i.id}">${t('addToShopping')}</button>
    ${i.notes ? `<p class="notes">${esc(i.notes)}</p>` : ''}
    <button class="link danger center" data-act="delItem" data-id="${i.id}">${t('deleteItem')}</button></main>`;
}

function blankDraft(r) {
  return { id: null, name: S.q || '', category_id: cat(r.q.get('cat')) ? r.q.get('cat') : '', quantity: '1', unit: '', printed_date: '', after_opening_days: '', date_type: 'expiration', estimated: false, location: '', notes: '', manufactured_on: '', interval_days: '', opened_on: '', running_out: false };
}
const DATE_FIELDS = ['printed_date', 'opened_on', 'manufactured_on'];
// One labelled field: label (with * when required), an (i) button that shows what the field is for, the control, and a line for the red message.
function field(name, label, control, { tipKey = '', req = false } = {}) {
  return `<div class="field"><div class="lab-row"><label for="f-${name}">${label}${req ? ` <span class="req" title="${t('required')}">*</span>` : ''}</label>${tipKey ? infoBtn() : ''}</div>${tipKey ? `<p class="tip" hidden>${t(tipKey)}</p>` : ''}${control}<p class="msg" role="alert"></p></div>`;
}
const textCtl = (name, value, attrs = '') => `<input id="f-${name}" name="${name}" value="${esc(value ?? '')}" autocomplete="off" ${attrs}>`;
// Dates are typed in the format chosen under More → Date format; the calendar button opens the phone's own picker.
const dateCtl = (name, value, max = '') => `<div class="datebox"><input id="f-${name}" name="${name}" value="${esc(value ?? '')}" data-v="date" ${max ? `data-max="${max}"` : ''} inputmode="numeric" autocomplete="off" placeholder="${datePlaceholder()}" maxlength="10"><button type="button" class="round flat" data-act="pick" data-for="${name}" aria-label="${t('calendar')}">${icon('cal')}</button><input type="date" class="native-date" tabindex="-1" aria-hidden="true" data-native="${name}" min="1990-01-01" max="${max === 'today' ? today() : '2099-12-31'}"></div>`;

function vEdit(r) {
  if (!S.draft || S.draft._for !== r.id) {
    const src = r.id === 'new' ? blankDraft(r) : item(r.id);
    if (!src) return `<main class="page">${top(t('back'))}${empty(t('itemGone'))}</main>`;
    S.draft = { ...src, _for: r.id, quantity: String(num(src.quantity)) };
    DATE_FIELDS.forEach((k) => { S.draft[k] = src[k] ? fmtDate(src[k]) : ''; });
    S.more = !!(src.after_opening_days || src.opened_on);
  }
  const d = S.draft;
  return `<main class="page with-save"><div class="top"><button class="link" data-act="back">${t('cancel')}</button><h1 class="h-small">${r.id === 'new' ? t('newItem') : t('editItem')}</h1><span class="spacer"></span></div>
    <form id="item-form" novalidate>
    <p class="small muted"><span class="req">*</span> ${t('required')}</p>
    ${field('name', t('name'), textCtl('name', d.name, 'data-v="name" maxlength="120"'), { req: true })}
    <div class="field"><div class="lab-row"><span class="lab">${t('category')}</span>${infoBtn()}</div><p class="tip" hidden>${t('tip_category')}</p><div class="chips wrap">${S.cats.map((c) => `<button type="button" class="chip big ${d.category_id === c.id ? 'on' : ''}" aria-pressed="${d.category_id === c.id}" data-act="pickCat" data-id="${c.id}">${esc(c.name)}</button>`).join('')}<button type="button" class="chip big dashed" data-act="newCatInForm">${t('newCategory')}</button></div></div>
    <div class="grid2">${field('quantity', t('howMany'), `<div class="stepper"><button type="button" data-act="step" data-d="-1" aria-label="${t('fewer')}">−</button><input id="f-quantity" name="quantity" inputmode="decimal" data-v="qty" value="${esc(d.quantity)}" autocomplete="off"><button type="button" data-act="step" data-d="1" aria-label="${t('moreQty')}">+</button></div>`, { tipKey: 'tip_qty' })}
    ${field('unit', t('unit'), textCtl('unit', d.unit, `maxlength="20" placeholder="${t('unitPlaceholder')}"`), { tipKey: 'tip_unit' })}</div>
    ${field('printed_date', t('dateOnPackage'), dateCtl('printed_date', d.printed_date), { tipKey: 'tip_date' })}
    <button type="button" class="row cardlike" data-act="toggleMore" aria-expanded="${S.more}"><span class="grow"><span class="row-t">${t('moreDetails')}</span><span class="row-m">${t('moreDetailsSub')}</span></span>${icon(S.more ? 'up' : 'down')}</button>
    ${S.more ? `${field('after_opening_days', t('afterOpeningUse'), `<div class="inline">${textCtl('after_opening_days', d.after_opening_days, 'data-v="days" inputmode="numeric" class="tiny"')}<span>${t('days')}</span></div>`, { tipKey: 'tip_pao' })}
      ${field('opened_on', t('openedOn'), dateCtl('opened_on', d.opened_on, 'today'), { tipKey: 'tip_openedOn' })}
      ${field('date_type', t('dateType'), `<select id="f-date_type" name="date_type">${['expiration', 'bestBefore', 'sellBy', 'replaceBy', 'none'].map((k) => `<option value="${k}" ${d.date_type === k ? 'selected' : ''}>${t('dt_' + k)}</option>`).join('')}</select>`, { tipKey: 'tip_dateType' })}
      <div class="field"><div class="lab-row"><label class="check"><input type="checkbox" name="estimated" ${d.estimated ? 'checked' : ''}>${t('dateEstimated')}</label>${infoBtn()}</div><p class="tip" hidden>${t('tip_estimated')}</p></div>
      ${field('manufactured_on', t('madeOn'), dateCtl('manufactured_on', d.manufactured_on, 'today'), { tipKey: 'tip_madeOn' })}
      ${field('interval_days', t('replaceEvery'), `<div class="inline">${textCtl('interval_days', d.interval_days, 'data-v="days" inputmode="numeric" class="tiny"')}<span>${t('days')}</span></div>`, { tipKey: 'tip_replace' })}
      ${field('location', t('location'), textCtl('location', d.location, `maxlength="80" placeholder="${t('locationPlaceholder')}"`), { tipKey: 'tip_location' })}
      <div class="field"><div class="lab-row"><label class="check"><input type="checkbox" name="running_out" ${d.running_out ? 'checked' : ''}>${t('markLow')}</label>${infoBtn()}</div><p class="tip" hidden>${t('tip_low')}</p></div>
      ${field('notes', t('notes'), `<textarea id="f-notes" name="notes" maxlength="1000" rows="3">${esc(d.notes ?? '')}</textarea>`)}` : ''}
    ${r.id === 'new' ? `<p class="small muted">${t('remindersDefaultNote')}</p>` : `<a class="btn line" href="#/reminders/${r.id}">${icon('bell')}${t('changeReminders')}</a>`}
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
      <p class="hint">${esc(fireText(x, i))}</p><p class="error" role="alert"></p>${x.item_id ? `<button type="button" class="btn soft" data-act="makeDefault" data-id="${x.id}">${t('makeDefault')}</button>` : ''}</form>`;
  };
  const inherited = !isDefault && !own.length;
  const shownRules = inherited ? defaults : own;
  const body = `${inherited ? `<p class="hint">${t('usingDefaultsLong')}</p>` : ''}${shownRules.map((x, n) => box(x, n + 1)).join('') || empty(t('noReminders'))}<button class="btn dashed" data-act="addRule" data-id="${r.id}">${t('addReminder')}</button>${!isDefault && own.length ? `<button class="link center" data-act="useDefaults" data-id="${r.id}">${t('backToDefaults')}</button>` : ''}`;
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
  const list = S.items.filter(needsAttention).sort(urgency), later = S.items.filter((i) => dueSoon(i) && snoozed(i)).sort(urgency);
  return `<main class="page with-nav">${h1(t('reminders'), list.length ? t('toDealWith', { n: list.length }) : t('allClear'))}<p class="notice">${t('pushLater')}</p>
    ${list.map((i) => `<div class="card pad"><a class="row bare" href="#/item/${i.id}"><span class="grow"><span class="row-t">${esc(i.name)}</span><span class="row-m">${meta(i)}</span></span>${pill(i)}</a>${quickBtns(i)}<button class="btn soft" data-act="snooze" data-id="${i.id}">${t('remindLater')}</button></div>`).join('') || empty(t('nothingDue'))}
    ${later.length ? `<p class="sec">${t('snoozedSection')}</p>${later.map((i) => `<div class="card pad"><a class="row bare" href="#/item/${i.id}"><span class="grow"><span class="row-t">${esc(i.name)}</span><span class="row-m">${esc(t('snoozedUntil', { d: fmtDateTime(i.snoozed_until) }))}</span></span>${pill(i)}</a><button class="btn line" data-act="wake" data-id="${i.id}">${t('remindNow')}</button></div>`).join('')}` : ''}</main>${nav('alerts')}`;
}

function vAssistant() {
  return `<main class="page">${top(t('home'))}${h1(t('assistant'), t('assistantSub'))}<div class="card pad"><p>${t('assistantSoon')}</p><a class="btn pri" href="#/edit/new">${t('addManually')}</a></div></main>`;
}

function vMore() {
  const guest = S.user?.is_anonymous;
  return `<main class="page">${top(t('home'))}${h1(t('more'), `${S.hh.name} · ${guest ? t('guestMode') : t('signedIn')}`)}
    ${card(rowLink('#/shopping', t('shoppingList'), '', `<span class="muted small">${t('nToBuy', { n: S.shop.filter((x) => !x.checked).length })}</span>`))}
    ${card(rowLink('#/reminders/default', t('defaultReminders'), esc(S.rules.filter((x) => !x.item_id).map(ruleSummary).join(' · ') || t('noReminders'))) + rowLink('#/categories', t('categories'), '', `<span class="muted small">${S.cats.length}</span>`) + rowLink('#/customize', t('homeScreen'), ''))}
    ${card(`<button class="row" data-act="rename"><span class="row-t">${t('homeName')}</span><span class="muted small">${esc(S.hh.name)}</span></button><button class="row" data-act="copyCode"><span class="grow"><span class="row-t">${t('familyCode')}</span><span class="row-m">${t('familyCodeSub')}</span></span><span class="link">${t('copy')}</span></button><button class="row" data-act="lang"><span class="row-t">${t('language')}</span><span class="muted small">${getLang() === 'en' ? 'English' : '한국어'}</span></button><button class="row" data-act="dateFmt"><span class="row-t">${t('dateFormat')}</span><span class="muted small">${fmtDate(today())}</span></button><button class="row" data-act="signOut"><span class="row-t danger">${t('signOut')}</span></button>`)}
    <p class="small muted center">${t('version')}</p></main>`;
}

function vShopping() {
  const row = (x) => `<label class="row"><input type="checkbox" class="sw" data-shop="${x.id}" ${x.checked ? 'checked' : ''}><span class="grow ${x.checked ? 'done' : ''}"><span class="row-t">${esc(x.name)}</span><span class="row-m">${num(x.quantity)} ${esc(x.unit)}</span></span><button type="button" class="round flat" data-act="delShop" data-id="${x.id}" aria-label="${t('delete')}">${icon('close')}</button></label>`;
  const open = S.shop.filter((x) => !x.checked), done = S.shop.filter((x) => x.checked);
  return `<main class="page">${top(t('back'))}${h1(t('shoppingList'), t('shoppingSub'))}
    <form id="shop-form" class="inline" novalidate><div class="fl-wrap grow">${floating('name', t('addToBuy'), 'maxlength="120"')}</div><button class="btn pri">${t('add')}</button></form>
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
  // Redrawing a form (opening More details, picking a category) must not lose the red marks.
  if (r.name === 'edit') document.querySelectorAll('#item-form [data-v]').forEach((el) => { if (el.value) check(el, false); });
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
  tip: (d, el) => { const p = el.closest('.field').querySelector('.tip'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); },
  pick: (d) => { const n = $(`[data-native="${d.for}"]`), cur = toIso($(`#f-${d.for}`).value); if (cur) n.value = cur; try { n.showPicker(); } catch { n.focus(); } },
  dateFmt: () => run(async () => { const v = await choose({ title: t('dateFormat'), body: t('dateFormatQ'), options: Object.keys(DATE_FORMATS).map((k) => ({ value: k, on: k === getDateFormat(), label: fmtDate(today(), k) + '  ·  ' + datePlaceholder(k) })) }); if (!v) return; setDateFormat(v); render(); await api.saveSettings(S.user.id, { date_format: v }).catch(() => {}); }),
  snooze: (d) => run(async () => {
    const i = item(d.id), now = new Date(), at = (days, h) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(h, 0, 0, 0); return x; };
    const options = [{ label: t('in1h'), value: new Date(now.getTime() + 36e5) }, ...(now.getHours() < 20 ? [{ label: t('tonight'), value: at(0, 21) }] : []), { label: t('tomorrowMorning'), value: at(1, 9) }, { label: t('in3days'), value: at(3, 9) }];
    const when = await choose({ title: t('remindLaterQ', { name: i.name }), body: t('snoozeNote'), options });
    if (when) await patchItem(i, { snoozed_until: when.toISOString() }, t('snoozeDone', { d: fmtDateTime(when) }));
  }),
  wake: (d) => run(async () => { await patchItem(item(d.id), { snoozed_until: null }, t('saved')); }),
  usedOne: (d) => run(async () => { const i = item(d.id), q = num(i.quantity) - 1; if (q <= 0) return removeItem(i, t('usedUpDone', { name: i.name }), 'consumed', num(i.quantity)); await patchItem(i, { quantity: q }, t('usedOneDone', { name: i.name }), 'consumed', 1); }),
  usedUp: (d) => run(async () => { const i = item(d.id); await removeItem(i, t('usedUpDone', { name: i.name }), 'consumed', num(i.quantity)); }),
  threw: (d) => run(async () => { const i = item(d.id); await removeItem(i, t('threwDone', { name: i.name }), 'wasted', num(i.quantity)); }),
  openToday: (d) => run(async () => { const i = item(d.id); await patchItem(i, { opened_on: today() }, t('openedDone', { d: fmtDate(addDays(today(), i.after_opening_days)) }), 'opened', 0); }),
  openOther: (d) => run(async () => { const i = item(d.id); const v = await ask({ title: t('whenOpened'), input: fmtDate(today()), v: 'date', max: 'today', placeholder: datePlaceholder(), ok: t('save') }); const day = v && toIso(v); if (!day) return; await patchItem(i, { opened_on: day }, t('openedDone', { d: fmtDate(addDays(day, i.after_opening_days)) }), 'opened', 0); }),
  unopen: (d) => run(async () => { await patchItem(item(d.id), { opened_on: null }, t('markedUnopened')); }),
  setPao: (d) => run(async () => { const v = await ask({ title: t('afterOpeningUse'), body: t('afterOpeningHint'), input: '', v: 'days', placeholder: t('days'), ok: t('save') }); if (!v) return; await patchItem(item(d.id), { after_opening_days: Number(v) }, t('saved')); }),
  replaced: (d) => run(async () => { const i = item(d.id); await patchItem(i, { date_type: 'replaceBy', printed_date: addDays(today(), i.interval_days), acquired_on: today(), opened_on: null, quantity: Math.max(1, num(i.quantity)), running_out: false, estimated: false }, t('replacedDone', { d: fmtDate(addDays(today(), i.interval_days)) })); }),
  toShop: (d) => run(async () => {
    const i = item(d.id);
    if (S.shop.some((x) => x.item_id === i.id && !x.checked)) return toast(t('alreadyOnList'));
    const row = await api.insert('shopping_entries', { household_id: S.hh.id, item_id: i.id, name: i.name, quantity: 1, unit: i.unit || '' });
    await load('shop'); render();
    toast(t('addedToShopping', { name: i.name }), async () => { await api.remove('shopping_entries', row.id); await load('shop'); render(); toast(t('undone')); });
  }),
  delItem: (d) => run(async () => { const i = item(d.id); if (!(await ask({ title: t('deleteQ', { name: i.name }), ok: t('delete'), danger: true }))) return; await removeItem(i, t('deletedDone', { name: i.name })); }),
  pickCat: (d) => { readForm(); S.draft.category_id = S.draft.category_id === d.id ? '' : d.id; render(); },
  toggleMore: () => { readForm(); S.more = !S.more; render(); },
  step: (d) => { readForm(); S.draft.quantity = String(Math.max(1, (Number(String(S.draft.quantity).replace(',', '.')) || 0) + Number(d.d))); render(); },
  newCat: () => run(async () => { const c = await createCategory(); if (c) { await load('cats'); render(); } }),
  newCatInForm: () => run(async () => { readForm(); const c = await createCategory(); if (c) { await load('cats'); S.draft.category_id = c.id; render(); } }),
  renameCat: (d) => run(async () => { const c = cat(d.id); const v = await ask({ title: t('renameCategory'), input: c.name, ok: t('save') }); if (!v || v === c.name) return; await api.update('categories', c.id, { name: v }); await load('cats'); render(); }),
  delCat: (d) => run(async () => {
    const c = cat(d.id), n = S.items.filter((i) => i.category_id === c.id).length;
    if (!(await ask({ title: t('deleteQ', { name: c.name }), body: n ? t('deleteCatKeeps', { n }) : '', ok: t('delete'), danger: true }))) return;
    await api.remove('categories', c.id); await load('cats', 'items'); render(); toast(t('deletedDone', { name: c.name }));
  }),
  rename: () => run(async () => { const v = await ask({ title: t('homeName'), input: S.hh.name, ok: t('save') }); if (!v) return; await api.update('households', S.hh.id, { name: v.slice(0, 40) }); S.hh.name = v.slice(0, 40); render(); }),
  makeDefault: (d) => run(async () => {
    await saveOpenRule();
    const { id, item_id, household_id, created_at, updated_at, ...rule } = S.rules.find((x) => x.id === d.id);
    const same = (a) => Object.keys(rule).every((k) => String(a[k] ?? '') === String(rule[k] ?? ''));
    if (S.rules.some((x) => !x.item_id && same(x))) return toast(t('alreadyDefault'));
    const made = await api.insert('reminder_rules', { ...rule, household_id, item_id: null });
    await load('rules'); render();
    toast(t('madeDefault'), async () => { await api.remove('reminder_rules', made.id); await load('rules'); render(); toast(t('undone')); });
  }),
  copyCode: () => run(async () => { try { await navigator.clipboard.writeText(S.hh.join_code); toast(t('codeCopied')); } catch { await ask({ title: t('familyCode'), body: S.hh.join_code, ok: t('ok') }); } }),
  openRule: (d) => run(async () => { await saveOpenRule(); S.openRule = d.id ? await ownRule(d.id) : null; render(); }),
  addRule: (d) => run(async () => { await saveOpenRule(); await ownRule(null); const row = await api.insert('reminder_rules', { household_id: S.hh.id, item_id: d.id === 'default' ? null : d.id, anchor: 'due', offset_amount: 1, offset_unit: 'days', at_time: '09:00' }); await load('rules'); S.openRule = row.id; render(); }),
  delRule: (d) => run(async () => { d = { id: await ownRule(d.id) }; const { created_at, updated_at, ...row } = S.rules.find((x) => x.id === d.id); await api.remove('reminder_rules', d.id); S.openRule = null; await load('rules'); render(); toast(t('reminderDeleted'), async () => { await api.insert('reminder_rules', row); await load('rules'); render(); toast(t('undone')); }); }),
  useDefaults: (d) => run(async () => { if (!(await ask({ title: t('backToDefaultsQ'), ok: t('ok') }))) return; for (const x of S.rules.filter((r) => r.item_id === d.id)) await api.remove('reminder_rules', x.id); S.openRule = null; await load('rules'); render(); }),
  delShop: (d) => run(async () => { await api.remove('shopping_entries', d.id); await load('shop'); render(); }),
  move: (d) => run(async () => { const o = [...S.layout.order], group = o.filter((x) => S.layout.hidden.includes(x) === S.layout.hidden.includes(d.id)), n = group.indexOf(d.id), other = group[n + Number(d.d)]; if (!other) return; const a = o.indexOf(d.id), b = o.indexOf(other); [o[a], o[b]] = [o[b], o[a]]; await saveLayout({ ...S.layout, order: o }); }),
  resetLayout: () => run(() => saveLayout(DEFAULT_LAYOUT)),
};
// On an item that still uses the home defaults, the first change gives the item its own copy of them,
// so the change never touches other items. Returns the id of the item's copy of the given rule.
async function ownRule(ruleId) {
  const r = route();
  if (r.name !== 'reminders' || r.id === 'default' || S.rules.some((x) => x.item_id === r.id)) return ruleId;
  let mine = ruleId;
  for (const { id, created_at, updated_at, ...x } of S.rules.filter((y) => !y.item_id)) { const made = await api.insert('reminder_rules', { ...x, item_id: r.id }); if (id === ruleId) mine = made.id; }
  await load('rules');
  return mine;
}
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
  const f = $('#item-form'), d = S.draft, err = (m) => { $('#form-error').textContent = m; $('#form-error').scrollIntoView({ block: 'center' }); };
  const wrong = [...f.querySelectorAll('[data-v]')].filter((el) => check(el, true));
  if (wrong.length) { err(t('errFixRed')); return wrong[0].focus(); }
  $('#form-error').textContent = '';
  const name = String(d.name).trim(), n = Number(String(d.quantity).replace(',', '.'));
  const int = (x) => (x === '' || x === null || x === undefined ? null : Number(x));
  const dates = Object.fromEntries(DATE_FIELDS.map((k) => [k, toIso(d[k])]));
  if (dates.manufactured_on && dates.printed_date && dates.printed_date < dates.manufactured_on) return err(t('errDateOrder'));
  const interval = int(d.interval_days);
  const row = { name, category_id: d.category_id || null, quantity: n, unit: String(d.unit || '').trim(), ...dates, after_opening_days: int(d.after_opening_days), date_type: d.date_type || 'expiration', estimated: !!d.estimated, location: String(d.location || '').trim(), notes: String(d.notes || '').trim(), interval_days: interval, running_out: !!d.running_out };
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
  if (f.id === 'join-form') { const el = f.elements.code; if (!el.value.trim()) { mark(el, t('errCodeFormat')); return el.focus(); } if (check(el, true)) return el.focus(); run(async () => { S.user = (await api.user()) || (await api.signInGuest()); await api.rpc('join_household', { code: el.value.trim().toLowerCase() }); await start(); }); }
  if (f.id === 'shop-form') run(async () => { const name = f.elements.name.value.trim(); if (!name) return; const linked = S.items.find((i) => i.name.toLowerCase() === name.toLowerCase()); await api.insert('shopping_entries', { household_id: S.hh.id, name, quantity: 1, unit: linked?.unit || '', item_id: linked?.id || null }); await load('shop'); render(); $('#shop-form input')?.focus(); });
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.v) { if (el.dataset.v === 'date') el.value = maskDate(el.value); check(el, false); }
  if (el.dataset.native) { const box = $(`#f-${el.dataset.native}`); if (el.value) { box.value = fmtDate(el.value); check(box, true); } }
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
    else if (i && num(i.quantity) - n <= 0) { await api.update('shopping_entries', id, { checked: false, item_id: null }); await api.remove('items', i.id); }
    else { if (i) await api.update('items', i.id, { quantity: num(i.quantity) - n }); await api.update('shopping_entries', id, { checked: false }); }
  }
  await load('items', 'shop'); render();
}
document.addEventListener('focusout', (e) => { if (e.target.dataset?.v) check(e.target, true); });
// A snoozed reminder comes back on its own: redraw the two overview screens once a minute, never while something is being typed.
setInterval(() => { if (S.ready && ['home', 'alerts'].includes(route().name) && !$('#modal').innerHTML && document.activeElement?.tagName !== 'INPUT') render(); }, 60000);
window.addEventListener('hashchange', render);
window.addEventListener('online', () => { $('#offline').hidden = true; });
window.addEventListener('offline', () => { $('#offline').hidden = false; });

async function start() {
  S.ready = false; render();
  await enter();
  const st = await api.settings(S.user.id).catch(() => null);
  if (st?.language && st.language !== getLang()) setLang(st.language);
  if (st?.date_format) setDateFormat(st.date_format);
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
