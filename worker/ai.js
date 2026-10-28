// Prancheta AI: the paid monthly chat that plans a class with the coach.
// There are still no accounts. Stripe is the only record of who pays:
//
// - Subscribing goes through a Stripe payment link, which sends the coach
//   back with the checkout's id (?ai=cs_...). /api/ai/join turns a paid
//   subscription checkout into this phone's key: the subscription's id,
//   signed with AI_SECRET so nobody can make one up.
// - Another phone asks for a 6-digit code by email (/api/ai/code), and
//   /api/ai/verify swaps the code for the same key. Codes aren't stored:
//   each one is a signature of the email and a 10-minute window.
// - /api/ai/chat checks the key, asks Stripe (cached for 10 minutes) that the
//   subscription is still active, checks this month's allowance, then asks
//   Claude. Classes and chats are never stored; the KV store only keeps
//   usage per subscription per month and short-lived counters.
// - /api/ai/info tells the app whether Prancheta AI is set up and where to
//   subscribe and manage it, so turning it on needs no new app release.
//
// Worker secrets: ANTHROPIC_KEY, AI_SECRET, RESEND_KEY, STRIPE_KEY (shared
// with the unlock; needs read access to subscriptions). Variables:
// AI_CHECKOUT_URL, AI_PORTAL_URL, AI_PAYMENT_LINK (plink_ id, optional),
// AI_MODEL, AI_MONTHLY_CENTS, AI_FROM. KV binding: AI_KV. See AI.md.

import Anthropic from '@anthropic-ai/sdk';

const STRIPE = 'https://api.stripe.com/v1';
const SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]+$/;
const SUB_ID = /^sub_[A-Za-z0-9]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIVE = new Set(['active', 'trialing']);

export const DEFAULT_MODEL = 'claude-haiku-5-5';
/** What a month of Prancheta AI may cost us, in US cents, unless AI_MONTHLY_CENTS says otherwise. */
export const DEFAULT_MONTHLY_CENTS = 250;
const CODE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;

/** Dollars per million tokens: input, output, cache read, cache write. */
const PRICES = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
};
// Models that take the server-side fallback on a refusal.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-opus-5']);

// Limits on what one chat request may send, so a key can't run up a bill.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 12000;
const MAX_CHAT_CHARS = 60000;
const MAX_FORMAT_CHARS = 16000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const month = (now) => new Date(now).toISOString().slice(0, 7);
const normEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase() : '');

// ─── Signing ────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** This phone's key for a subscription: its id and a signature. */
export async function makeKey(subId, env) {
  return `${subId}.${b64url(await sign(env.AI_SECRET, `key|${subId}`))}`;
}

/** The subscription id in a key, or null if the key wasn't made here. */
export async function readKey(key, env) {
  if (typeof key !== 'string' || key.length > 200) return null;
  const dot = key.indexOf('.');
  const subId = key.slice(0, dot);
  if (dot < 0 || !SUB_ID.test(subId)) return null;
  return sameText(key, await makeKey(subId, env)) ? subId : null;
}

/** The 6-digit email code for this address in a given 10-minute window. */
export async function emailCode(email, window, env) {
  const mac = await sign(env.AI_SECRET, `code|${normEmail(email)}|${window}`);
  const n = ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, '0');
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

function stripe(env, fetchImpl) {
  if (!env.STRIPE_KEY) throw new Error('STRIPE_KEY is not set on this Worker');
  return async (path) => {
    const res = await fetchImpl(STRIPE + path, { headers: { Authorization: `Bearer ${env.STRIPE_KEY}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Stripe answered ${res.status}`);
    return res.json();
  };
}

const subIdOf = (s) => (typeof s?.subscription === 'string' ? s.subscription : s?.subscription?.id ?? null);

/** A finished checkout for Prancheta AI (not the $10 unlock). */
const aiCheckout = (s, env) =>
  !!s && s.mode === 'subscription' && s.status === 'complete' && !!subIdOf(s) && (!env.AI_PAYMENT_LINK || s.payment_link === env.AI_PAYMENT_LINK);

/** Whether the subscription is active, asked of Stripe at most every 10 minutes. */
export async function subscriptionLive(subId, env, fetchImpl = fetch) {
  const cacheKey = `sub:${subId}`;
  const cached = await env.AI_KV.get(cacheKey);
  if (cached) return cached === 'live';
  const sub = await stripe(env, fetchImpl)(`/subscriptions/${subId}`);
  const live = !!sub && LIVE.has(sub.status);
  await env.AI_KV.put(cacheKey, live ? 'live' : 'off', { expirationTtl: 600 });
  return live;
}

/** The active Prancheta AI subscription paid for with this email, if any. */
async function subscriptionFor(email, env, fetchImpl) {
  const get = stripe(env, fetchImpl);
  const typed = email.trim();
  for (const address of new Set([typed, typed.toLowerCase()])) {
    const q = new URLSearchParams({ 'customer_details[email]': address, status: 'complete', limit: '100' });
    if (env.AI_PAYMENT_LINK) q.set('payment_link', env.AI_PAYMENT_LINK);
    const list = await get(`/checkout/sessions?${q}`);
    for (const s of list?.data ?? []) {
      if (!aiCheckout(s, env)) continue;
      const subId = subIdOf(s);
      if (await subscriptionLive(subId, env, fetchImpl)) return subId;
    }
  }
  return null;
}

// ─── Usage ──────────────────────────────────────────────────────────────────

const allowanceOf = (env) => {
  const n = Number(env.AI_MONTHLY_CENTS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_CENTS;
};

async function usedCents(subId, env, now) {
  return Number((await env.AI_KV.get(`use:${subId}:${month(now)}`)) ?? 0) || 0;
}

/** What a reply cost, in cents, from the token counts the API reports. */
export function costCents(model, usage) {
  const [inp, out, read, write] = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  const u = usage ?? {};
  const dollars =
    ((u.input_tokens ?? 0) * inp + (u.output_tokens ?? 0) * out + (u.cache_read_input_tokens ?? 0) * read + (u.cache_creation_input_tokens ?? 0) * write) /
    1_000_000;
  return dollars * 100;
}

// ─── The chat ───────────────────────────────────────────────────────────────

// The app sends the class format with each chat (aiClass.ts chatFormat), so
// the importer that reads the answer and the format the AI fills stay one
// piece of code. These rules come first and the format can't undo them.
const SYSTEM = `You are Prancheta AI, inside Prancheta, an app jiu-jitsu coaches plan their classes in. You help one coach plan one class.

The coach's own ideas are the class. Your job is to ask about them and arrange them in the format, not to invent a class for them. Talk like a fellow coach: short, plain, no hype, no slogans, no emoji.

Only help with planning jiu-jitsu or grappling classes. If asked for anything else, say in one line that you only plan classes here.

The app shows the coach your replies as chat messages and builds the class from the JSON in your reply. When you give the class, put the whole class in one \`\`\`json code block, with at most one short sentence before it.`;

function readChat(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const out = [];
  let total = 0;
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return null;
    const text = m.text.trim();
    if (!text || text.length > MAX_MESSAGE_CHARS) return null;
    total += text.length;
    out.push({ role: m.role, content: text });
  }
  if (total > MAX_CHAT_CHARS || out[0].role !== 'user' || out[out.length - 1].role !== 'user') return null;
  return out;
}

async function askClaude(format, messages, env, client) {
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const ai = client ?? new Anthropic({ apiKey: env.ANTHROPIC_KEY });
  const params = {
    model,
    max_tokens: 16000,
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: `${SYSTEM}\n\n${format}`, cache_control: { type: 'ephemeral' } }],
    messages,
  };
  if (FALLBACK_MODELS.has(model)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  const res = await ai.beta.messages.create(params);
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { model, res, text };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/** Whether everything Prancheta AI needs is set on the Worker. */
export const aiReady = (env) => !!(env.ANTHROPIC_KEY && env.AI_SECRET && env.STRIPE_KEY && env.AI_KV && env.AI_CHECKOUT_URL);

const EMAILS = {
  en: (code) => ({
    subject: `Your Prancheta AI code: ${code}`,
    text: `Your code is ${code}\n\nType it in Prancheta to use Prancheta AI on this phone. It works for 10 minutes.\n\nIf you didn't ask for it, you can ignore this email.`,
  }),
  pt: (code) => ({
    subject: `Seu código do Prancheta AI: ${code}`,
    text: `Seu código é ${code}\n\nDigite no Prancheta para usar o Prancheta AI neste aparelho. Ele vale por 10 minutos.\n\nSe você não pediu, pode ignorar este e-mail.`,
  }),
};

async function sendCode(email, lang, env, fetchImpl, now) {
  const code = await emailCode(email, Math.floor(now / CODE_WINDOW_MS), env);
  const { subject, text } = (EMAILS[lang] ?? EMAILS.en)(code);
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.AI_FROM || 'Prancheta <help@pranchetabjj.com>', to: [email.trim()], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
}

/**
 * Every /api/ai/* route. `deps` swaps in a fake fetch, Claude client or
 * clock for tests.
 */
export async function aiRoute(request, env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now();
  const path = new URL(request.url).pathname.replace(/^\/api\/ai\/?/, '');

  if (path === 'info') {
    const ready = aiReady(env);
    return json({ ready, checkout: ready ? env.AI_CHECKOUT_URL : null, portal: ready ? env.AI_PORTAL_URL || null : null });
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!aiReady(env)) return json({ error: 'notReady' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'bad' }, 400);

  try {
    if (path === 'join') {
      if (typeof body.session !== 'string' || !SESSION_ID.test(body.session)) return json({ ok: false });
      const s = await stripe(env, fetchImpl)(`/checkout/sessions/${body.session}`);
      if (!aiCheckout(s, env)) return json({ ok: false });
      return json({ ok: true, key: await makeKey(subIdOf(s), env) });
    }

    if (path === 'code') {
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      if (email.length > 254 || !EMAIL.test(email)) return json({ ok: false });
      // One email a minute per address, so the form can't be used to flood an inbox.
      const sentKey = `sent:${normEmail(email)}`;
      if (await env.AI_KV.get(sentKey)) return json({ ok: true });
      await env.AI_KV.put(sentKey, '1', { expirationTtl: 60 });
      // The answer is the same whether or not the email pays, so the form
      // can't be used to find out who subscribes.
      if (env.RESEND_KEY && (await subscriptionFor(email, env, fetchImpl))) {
        await sendCode(email, body.lang === 'pt' ? 'pt' : 'en', env, fetchImpl, now);
      }
      return json({ ok: true });
    }

    if (path === 'verify') {
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
      if (!EMAIL.test(email) || code.length !== 6) return json({ ok: false });
      const window = Math.floor(now / CODE_WINDOW_MS);
      const triesKey = `try:${normEmail(email)}:${window}`;
      const tries = Number((await env.AI_KV.get(triesKey)) ?? 0);
      if (tries >= MAX_TRIES) return json({ ok: false, error: 'tooMany' });
      await env.AI_KV.put(triesKey, String(tries + 1), { expirationTtl: 1200 });
      // A code from the last window still works, so one sent at 9:59 lasts past 10:00.
      const good = (await emailCode(email, window, env)) === code || (await emailCode(email, window - 1, env)) === code;
      if (!good) return json({ ok: false });
      const subId = await subscriptionFor(email, env, fetchImpl);
      return subId ? json({ ok: true, key: await makeKey(subId, env) }) : json({ ok: false });
    }

    if (path === 'status' || path === 'chat') {
      const subId = await readKey(body.key, env);
      if (!subId) return json({ error: 'badKey' }, 401);
      const allowance = allowanceOf(env);
      if (!(await subscriptionLive(subId, env, fetchImpl))) return json({ error: 'notActive' }, 402);
      let used = await usedCents(subId, env, now);
      if (path === 'status') return json({ ok: true, used: Math.min(1, used / allowance) });
      if (used >= allowance) return json({ error: 'limit', used: 1 }, 429);

      const messages = readChat(body.messages);
      const format = typeof body.format === 'string' ? body.format : '';
      if (!messages || !format || format.length > MAX_FORMAT_CHARS) return json({ error: 'bad' }, 400);

      const { model, res, text } = await askClaude(format, messages, env, deps.client);
      used += costCents(model, res.usage);
      await env.AI_KV.put(`use:${subId}:${month(now)}`, String(used), { expirationTtl: 40 * 24 * 3600 });
      if (res.stop_reason === 'refusal' || !text) return json({ error: 'noAnswer', used: Math.min(1, used / allowance) }, 502);
      return json({ ok: true, reply: text, cutOff: res.stop_reason === 'max_tokens', used: Math.min(1, used / allowance) });
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) return json({ error: 'busy' }, 503);
    return json({ error: 'failed' }, 502);
  }
}
