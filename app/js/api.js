// One small data interface with two back ends:
//   - Supabase (the real one);
//   - an in-memory mock, used with ?mock in the address for local tests.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const TABLES = ['items', 'categories', 'reminder_rules', 'shopping_entries', 'activity_log'];

export async function createApi() {
  return new URLSearchParams(location.search).has('mock') ? mockApi() : supabaseApi();
}

async function supabaseApi() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  return {
    async user() { return ok(await sb.auth.getSession()).session?.user ?? null; },
    async signInGuest() { return ok(await sb.auth.signInAnonymously()).user; },
    async signOut() { ok(await sb.auth.signOut()); },
    async households() {
      return ok(await sb.from('household_members').select('joined_at, households(*)').order('joined_at', { ascending: false }))
        .map((m) => m.households).filter(Boolean);
    },
    async rpc(name, args) { return ok(await sb.rpc(name, args)); },
    async select(table, householdId) { return ok(await sb.from(table).select('*').eq('household_id', householdId)); },
    async insert(table, row) { return ok(await sb.from(table).insert(row).select().single()); },
    async update(table, id, patch) { return ok(await sb.from(table).update(patch).eq('id', id).select().single()); },
    async remove(table, id) { ok(await sb.from(table).delete().eq('id', id)); },
    async settings(userId) { return ok(await sb.from('user_settings').select('*').eq('user_id', userId).maybeSingle()); },
    async saveSettings(userId, patch) { return ok(await sb.from('user_settings').upsert({ user_id: userId, ...patch }).select().single()); },
  };
}

// ---- mock: mirrors what the database does (generated due_date, defaults) ----
function mockApi() {
  const db = Object.fromEntries(TABLES.map((t) => [t, []]));
  let user = null, household = null, settings = null;
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const plus = (date, days) => { const [y, m, d] = date.split('-').map(Number); const x = new Date(y, m - 1, d + days); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const derive = (table, r) => {
    if (table !== 'items') return r;
    const a = r.date_type === 'none' ? null : r.printed_date || null;
    const b = r.opened_on && r.after_opening_days ? plus(r.opened_on, r.after_opening_days) : null;
    r.due_date = a && b ? (a < b ? a : b) : a || b;
    return r;
  };
  const defaults = { items: { quantity: 1, unit: '', location: '', notes: '', date_type: 'expiration', estimated: false, running_out: false }, reminder_rules: { anchor: 'due', offset_amount: 0, offset_unit: 'days', at_time: '09:00:00', enabled: true } };
  return {
    async user() { return user; },
    async signInGuest() { user = { id: uid(), is_anonymous: true }; return user; },
    async signOut() { user = null; },
    async households() { return household ? [household] : []; },
    async rpc(name, args) {
      if (name === 'create_household') {
        household = { id: uid(), name: args.household_name, join_code: 'mock1234mock5678ab', timezone: 'Asia/Seoul' };
        db.reminder_rules.push({ ...defaults.reminder_rules, id: uid(), household_id: household.id, item_id: null, offset_amount: 7 });
        db.reminder_rules.push({ ...defaults.reminder_rules, id: uid(), household_id: household.id, item_id: null, repeat_every_amount: 1, repeat_every_unit: 'days' });
        return household.id;
      }
      if (name === 'join_household') throw new Error('No household has this code');
      throw new Error('Unknown function ' + name);
    },
    async select(table) { return db[table].map((r) => ({ ...r })); },
    async insert(table, row) { const r = derive(table, { ...(defaults[table] || {}), id: uid(), created_at: now(), updated_at: now(), ...row }); db[table].push(r); return { ...r }; },
    async update(table, id, patch) { const r = db[table].find((x) => x.id === id); if (!r) throw new Error('Not found'); Object.assign(r, patch, { updated_at: now() }); derive(table, r); return { ...r }; },
    async remove(table, id) {
      db[table] = db[table].filter((x) => x.id !== id);
      if (table === 'items') db.reminder_rules = db.reminder_rules.filter((x) => x.item_id !== id);
      if (table === 'categories') db.items.forEach((i) => { if (i.category_id === id) i.category_id = null; });
    },
    async settings() { return settings; },
    async saveSettings(userId, patch) { settings = { user_id: userId, ...(settings || {}), ...patch }; return settings; },
  };
}
