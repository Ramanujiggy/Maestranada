import { beforeEach, describe, expect, it } from 'vitest';
import { checkPurchase, FREE_CLASSES, freeLeft, getUnlock, isUnlocked, paidSession, recordMade, roomFor, saveUnlock, takeCarriedUnlock } from './access.ts';
import { isPaid, keyStatus, unlockRoute } from '../../../worker/unlock.js';
import { blankPlan, duplicatePlan, normalizePlan, samplePlan, type ClassPlan } from './plan.ts';
import { copyClasses, readBackup, takeUnlockFrom } from './carry.ts';

const own = (): ClassPlan => ({ ...blankPlan(), updatedAt: '2099-01-01T00:00:00.000Z' });

describe('free classes', () => {
  beforeEach(() => localStorage.clear());

  it('lets three classes in, then asks for the unlock', () => {
    let plans: ClassPlan[] = [samplePlan()];
    for (let i = 0; i < FREE_CLASSES; i++) {
      const next = own();
      expect(roomFor(plans, [next])).toBe(true);
      plans = [next, ...plans];
      recordMade(plans);
    }
    expect(freeLeft(plans)).toBe(0);
    expect(roomFor(plans, [own()])).toBe(false);
  });

  it('never gives a slot back when a class is deleted', () => {
    const plans = [own(), own(), own()];
    recordMade(plans);
    expect(roomFor(plans.slice(1), [own()])).toBe(false);
    expect(freeLeft([])).toBe(0);
  });

  it('always lets classes already here be changed', () => {
    const plans = [own(), own(), own()];
    recordMade(plans);
    expect(roomFor(plans, [{ ...plans[0], title: 'Edited' }])).toBe(true);
  });

  it("doesn't count the example, but counts a copy of it", () => {
    const sample = samplePlan();
    recordMade([sample]);
    expect(freeLeft([sample])).toBe(FREE_CLASSES);
    const copy = duplicatePlan(sample);
    expect(copy.example).toBeUndefined();
    expect(freeLeft([copy, sample])).toBe(FREE_CLASSES - 1);
  });

  it('keeps the example mark through saving and loading', () => {
    expect(normalizePlan(JSON.parse(JSON.stringify(samplePlan())))?.example).toBe(true);
    expect(normalizePlan(JSON.parse(JSON.stringify(own())))?.example).toBeUndefined();
  });

  it('keeps every class a coach made before the free version, and stops new ones', () => {
    const plans = [own(), own(), own(), own(), own()];
    expect(freeLeft(plans)).toBe(0);
    expect(roomFor(plans, [plans[0]])).toBe(true);
    expect(roomFor(plans, [own()])).toBe(false);
  });

  it('lets everything in once unlocked', () => {
    const plans = [own(), own(), own()];
    recordMade(plans);
    saveUnlock({ via: 'paid', at: '' });
    expect(roomFor(plans, [own(), own()])).toBe(true);
  });
});

describe('paidSession', () => {
  it('reads the checkout id Stripe sends back, and nothing else', () => {
    expect(paidSession('?paid=cs_live_a1B2c3')).toBe('cs_live_a1B2c3');
    expect(paidSession('?paid={CHECKOUT_SESSION_ID}')).toBeNull();
    expect(paidSession('?paste')).toBeNull();
  });
});

describe('checkPurchase', () => {
  const answer = (body: unknown, type = 'application/json') =>
    Object.assign(globalThis, { fetch: async () => new Response(JSON.stringify(body), { headers: { 'content-type': type } }) });

  it('says ok or bad from the Worker, and offline when there is no Worker', async () => {
    answer({ ok: true });
    expect(await checkPurchase({ session: 'cs_test_1' })).toBe('ok');
    answer({ ok: false });
    expect(await checkPurchase({ email: 'a@b.co' })).toBe('bad');
    answer({ error: 'check failed' });
    expect(await checkPurchase({ email: 'a@b.co' })).toBe('offline');
    answer('<html>', 'text/html');
    expect(await checkPurchase({ email: 'a@b.co' })).toBe('offline');
  });
});

describe('the Worker unlock check', () => {
  const env = { STRIPE_KEY: 'rk_test_x', PAYMENT_LINK: 'plink_1' };
  const paid = { status: 'complete', payment_status: 'paid', payment_link: 'plink_1' };
  const stripe = (routes: Record<string, unknown>) => {
    const asked: string[] = [];
    const impl = (async (url: string) => {
      asked.push(url);
      const hit = Object.entries(routes).find(([k]) => url.includes(k));
      return hit ? new Response(JSON.stringify(hit[1])) : new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    return { impl, asked };
  };

  it('takes a paid checkout from the payment link', async () => {
    const { impl } = stripe({ '/checkout/sessions/cs_live_ok': paid, '/checkout/sessions/cs_live_other': { ...paid, payment_link: 'plink_2' } });
    expect(await isPaid({ session: 'cs_live_ok' }, env, impl)).toBe(true);
    expect(await isPaid({ session: 'cs_live_other' }, env, impl)).toBe(false);
    expect(await isPaid({ session: 'cs_live_missing' }, env, impl)).toBe(false);
    expect(await isPaid({ session: '../customers' }, env, impl)).toBe(false);
  });

  it('turns down a checkout that is not paid', async () => {
    const { impl } = stripe({ '/checkout/sessions/cs_live_open': { ...paid, payment_status: 'unpaid' } });
    expect(await isPaid({ session: 'cs_live_open' }, env, impl)).toBe(false);
  });

  it('finds a purchase by email, as typed or in lower case', async () => {
    const { impl, asked } = stripe({ 'email%5D=coach%40gym.com': { data: [paid] } });
    expect(await isPaid({ email: ' Coach@Gym.com ' }, env, impl)).toBe(true);
    expect(asked[0]).toContain('payment_link=plink_1');
    expect(await isPaid({ email: 'not an email' }, env, impl)).toBe(false);
  });

  it('answers without ok when Stripe or the secret fails, so the app says try again', async () => {
    const post = (body: unknown) => new Request('https://x/api/unlock', { method: 'POST', body: JSON.stringify(body) });
    const res = await unlockRoute(post({ email: 'a@b.co' }), {});
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'check failed' });
  });
});

describe('the Worker key check', () => {
  it('says whether the secret is set and whether Stripe takes it, never the key', async () => {
    expect(await keyStatus({})).toBe('STRIPE_KEY is not set on this Worker');
    const ok = (async () => new Response('{"data":[]}')) as unknown as typeof fetch;
    expect(await keyStatus({ STRIPE_KEY: 'rk_live_secret' }, ok)).toBe('ok (live key)');
    const denied = (async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid API Key provided: rk_test_****cret' } }), { status: 401 })) as unknown as typeof fetch;
    const status = await keyStatus({ STRIPE_KEY: 'rk_test_secret' }, denied);
    expect(status).toBe('Stripe answered 401 for the test key: Invalid API Key provided: [key]');
    expect(status).not.toContain('secret');
  });
});

describe('carrying the unlock', () => {
  beforeEach(() => localStorage.clear());

  it('reads the classes and the unlock mark from copied text', () => {
    const text = JSON.stringify({ classes: [own(), own()], unlocked: true });
    expect(readBackup(text)).toHaveLength(2);
    expect(takeUnlockFrom(text)).toBe(true);
    expect(isUnlocked()).toBe(true);
    expect(getUnlock()?.via).toBe('carried');
  });

  it('ignores copied text without the mark', () => {
    expect(takeUnlockFrom(JSON.stringify([own()]))).toBe(false);
    expect(takeCarriedUnlock({ key: 'ABC' })).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it('puts only a mark in copied classes, nothing about the purchase', async () => {
    saveUnlock({ via: 'paid', at: '' });
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (s: string) => void (copied = s) } });
    expect(await copyClasses([own()])).toBe(true);
    expect(copied).not.toContain('"via"');
    expect(JSON.parse(copied).unlocked).toBe(true);
  });
});
