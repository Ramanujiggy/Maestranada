import { describe, expect, it } from 'vitest';
import { aiReady, aiRoute, costCents, emailCode, makeKey, readKey, type AiEnv } from '../../../worker/ai.js';
import { aiSession, replyText } from './aiService.ts';
import { chatFormat, readAiReply } from './aiClass.ts';

function memoryKv() {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k: string) => data.get(k) ?? null,
    put: async (k: string, v: string) => void data.set(k, v),
  };
}

function setup(over: Partial<AiEnv> = {}) {
  const kv = memoryKv();
  const env: AiEnv = {
    ANTHROPIC_KEY: 'sk-test',
    AI_SECRET: 'secret',
    STRIPE_KEY: 'rk_test',
    RESEND_KEY: 're_test',
    AI_CHECKOUT_URL: 'https://buy.stripe.com/test_ai',
    AI_PORTAL_URL: 'https://billing.stripe.com/p/login/test',
    AI_KV: kv,
    ...over,
  };
  return { env, kv };
}

const checkout = (over: Record<string, unknown> = {}) => ({
  id: 'cs_test_abc',
  mode: 'subscription',
  status: 'complete',
  subscription: 'sub_123',
  ...over,
});

/** A fake Stripe and Resend: one subscriber, coach@gym.com, with sub_123. */
function fakeFetch(subStatus = 'active', sent: { to: string; text: string }[] = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('api.resend.com')) {
      const body = JSON.parse(String(init?.body));
      sent.push({ to: body.to[0], text: body.text });
      return ok({ id: 'email_1' });
    }
    if (url.includes('/subscriptions/sub_123')) return ok({ id: 'sub_123', status: subStatus });
    if (url.includes('/checkout/sessions/cs_test_abc')) return ok(checkout());
    if (url.includes('/checkout/sessions/cs_test_unlock')) return ok(checkout({ mode: 'payment', subscription: null }));
    if (url.includes('/checkout/sessions?')) {
      const email = new URL(url).searchParams.get('customer_details[email]');
      return ok({ data: email === 'coach@gym.com' ? [checkout()] : [] });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

const post = (path: string, body: unknown) =>
  new Request(`https://app.pranchetabjj.com/api/ai/${path}`, { method: 'POST', body: JSON.stringify(body) });

const CLASS_REPLY = 'Here it is.\n```json\n{"prancheta":1,"title":"Half guard","blocks":[{"kind":"rolling","rounds":3,"minutes":5}]}\n```';

function fakeClient(reply = CLASS_REPLY, stop = 'end_turn') {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (params: unknown) => {
          calls.push(params as Record<string, unknown>);
          return {
            content: [{ type: 'text', text: reply }],
            stop_reason: stop,
            usage: { input_tokens: 4000, output_tokens: 800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          };
        },
      },
    },
  };
}

describe('Prancheta AI keys and codes', () => {
  it('reads back only keys it made', async () => {
    const { env } = setup();
    const key = await makeKey('sub_123', env);
    expect(await readKey(key, env)).toBe('sub_123');
    expect(await readKey(key.replace('sub_123', 'sub_999'), env)).toBeNull();
    expect(await readKey(key.slice(0, -2), env)).toBeNull();
    expect(await readKey(key, { ...env, AI_SECRET: 'other' })).toBeNull();
    expect(await readKey('nonsense', env)).toBeNull();
  });

  it('makes a 6-digit code per email and window', async () => {
    const { env } = setup();
    const a = await emailCode('Coach@Gym.com ', 5, env);
    expect(a).toMatch(/^\d{6}$/);
    expect(await emailCode('coach@gym.com', 5, env)).toBe(a);
    expect(await emailCode('coach@gym.com', 6, env)).not.toBe(a);
  });

  it('counts cost from token use', () => {
    // 4,000 in and 800 out at $4 / $20 per million: 1.6 + 1.6 cents.
    expect(costCents('claude-opus-5-5', { input_tokens: 4000, output_tokens: 800 })).toBeCloseTo(3.2);
  });
});

describe('Prancheta AI routes', () => {
  it('stays off until everything is set', async () => {
    expect(aiReady(setup({ ANTHROPIC_KEY: undefined }).env)).toBe(false);
    const res = await aiRoute(new Request('https://x/api/ai/info'), setup({ AI_CHECKOUT_URL: undefined }).env);
    expect(await res.json()).toEqual({ ready: false, checkout: null, portal: null });
    const on = await aiRoute(new Request('https://x/api/ai/info'), setup().env);
    expect(await on.json()).toMatchObject({ ready: true, checkout: 'https://buy.stripe.com/test_ai' });
  });

  it('turns a subscription checkout into a key, but not the $10 unlock', async () => {
    const { env } = setup();
    const deps = { fetch: fakeFetch() };
    const joined = (await (await aiRoute(post('join', { session: 'cs_test_abc' }), env, deps)).json()) as { ok: boolean; key: string };
    expect(joined.ok).toBe(true);
    expect(await readKey(joined.key, env)).toBe('sub_123');
    const unlock = await (await aiRoute(post('join', { session: 'cs_test_unlock' }), env, deps)).json();
    expect(unlock).toEqual({ ok: false });
  });

  it('emails a code only to subscribers, and the code gives the key', async () => {
    const { env } = setup();
    const sent: { to: string; text: string }[] = [];
    const now = Date.UTC(2026, 9, 28, 12, 0);
    const deps = { fetch: fakeFetch('active', sent), now };
    expect(await (await aiRoute(post('code', { email: 'stranger@gym.com' }), env, deps)).json()).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    expect(await (await aiRoute(post('code', { email: 'coach@gym.com' }), env, deps)).json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    const code = sent[0].text.match(/\d{6}/)![0];

    const wrong = await (await aiRoute(post('verify', { email: 'coach@gym.com', code: code === '000000' ? '111111' : '000000' }), env, deps)).json();
    expect(wrong).toEqual({ ok: false });
    // Still good a few minutes later, in the next window.
    const later = { ...deps, now: now + 12 * 60 * 1000 };
    const right = (await (await aiRoute(post('verify', { email: 'coach@gym.com', code }), env, later)).json()) as { key: string };
    expect(await readKey(right.key, env)).toBe('sub_123');
  });

  it('stops guessing after five tries', async () => {
    const { env } = setup();
    const deps = { fetch: fakeFetch(), now: Date.UTC(2026, 9, 28, 12, 0) };
    for (let i = 0; i < 5; i++) await aiRoute(post('verify', { email: 'coach@gym.com', code: '000000' }), env, deps);
    const code = await emailCode('coach@gym.com', Math.floor(deps.now / 600000), env);
    const res = await (await aiRoute(post('verify', { email: 'coach@gym.com', code }), env, deps)).json();
    expect(res).toEqual({ ok: false, error: 'tooMany' });
  });

  it('chats for an active subscriber and counts the month', async () => {
    const { env, kv } = setup({ AI_MONTHLY_CENTS: '100' });
    const client = fakeClient();
    const key = await makeKey('sub_123', env);
    const now = Date.UTC(2026, 9, 28);
    const res = await aiRoute(
      post('chat', { key, format: chatFormat('en'), messages: [{ role: 'user', text: 'Half guard, 60 minutes' }] }),
      env,
      { fetch: fakeFetch(), client, now },
    );
    const body = (await res.json()) as { ok: boolean; reply: string; used: number };
    expect(body.ok).toBe(true);
    expect('error' in readAiReply(body.reply)).toBe(false);
    // 4,000 in and 800 out at $0.10 / $0.50 per million: 0.08 cents.
    expect(body.used).toBeCloseTo(0.0008);
    expect(Number(kv.data.get('use:sub_123:2026-10'))).toBeCloseTo(0.08);
    const params = client.calls[0];
    expect(params.model).toBe('claude-haiku-5-5');
    // Haiku has no server-side refusal fallback.
    expect(params.fallbacks).toBeUndefined();
    expect(JSON.stringify(params.system)).toContain('Prancheta AI');
  });

  it('turns away a cancelled subscription, a used-up month and a bad key', async () => {
    const { env, kv } = setup({ AI_MONTHLY_CENTS: '100' });
    const key = await makeKey('sub_123', env);
    const chatBody = { key, format: 'f', messages: [{ role: 'user', text: 'hi' }] };
    const off = await aiRoute(post('chat', chatBody), env, { fetch: fakeFetch('canceled'), client: fakeClient() });
    expect(await off.json()).toEqual({ error: 'notActive' });

    const { env: env2, kv: kv2 } = setup({ AI_MONTHLY_CENTS: '100' });
    kv2.data.set('use:sub_123:2026-10', '100');
    const full = await aiRoute(post('chat', { ...chatBody, key: await makeKey('sub_123', env2) }), env2, {
      fetch: fakeFetch(),
      client: fakeClient(),
      now: Date.UTC(2026, 9, 28),
    });
    expect(full.status).toBe(429);

    const bad = await aiRoute(post('chat', { ...chatBody, key: 'sub_123.forged' }), env, { fetch: fakeFetch() });
    expect(bad.status).toBe(401);
    expect(kv.data.size).toBeGreaterThan(0);
  });

  it('refuses chats that are too long or malformed', async () => {
    const { env } = setup();
    const key = await makeKey('sub_123', env);
    const deps = { fetch: fakeFetch(), client: fakeClient() };
    const long = await aiRoute(post('chat', { key, format: 'f', messages: [{ role: 'user', text: 'x'.repeat(20000) }] }), env, deps);
    expect(long.status).toBe(400);
    const endsWithAi = await aiRoute(post('chat', { key, format: 'f', messages: [{ role: 'assistant', text: 'hi' }] }), env, deps);
    expect(endsWithAi.status).toBe(400);
  });
});

describe('Prancheta AI in the app', () => {
  it('reads the checkout id Stripe sends back', () => {
    expect(aiSession('?ai=cs_live_a1B2')).toBe('cs_live_a1B2');
    expect(aiSession('?ai=<script>')).toBeNull();
    expect(aiSession('?paid=cs_live_x')).toBeNull();
  });

  it('shows the words of a reply without the class JSON', () => {
    expect(replyText(CLASS_REPLY)).toBe('Here it is.');
    expect(replyText('How long is the class?')).toBe('How long is the class?');
  });

  it('has the format in both languages', () => {
    expect(chatFormat('en')).toContain('"kind": "warmup"');
    expect(chatFormat('pt')).toContain('português');
  });
});
