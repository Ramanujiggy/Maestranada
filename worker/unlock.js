// The unlock check: "did this checkout, or this email, pay for Prancheta?"
// Asked of Stripe with a restricted, read-only key (the Worker secret
// STRIPE_KEY). The answer is only yes or no; nothing about the buyer goes
// back to the app. PAYMENT_LINK (a plink_ id, optional) keeps other products
// in the same Stripe account from counting.

const STRIPE = 'https://api.stripe.com/v1';
const SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function isPaid(proof, env, fetchImpl = fetch) {
  if (!env.STRIPE_KEY) throw new Error('STRIPE_KEY is not set on this Worker');
  const get = async (path) => {
    const res = await fetchImpl(STRIPE + path, { headers: { Authorization: `Bearer ${env.STRIPE_KEY}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Stripe answered ${res.status}`);
    return res.json();
  };
  const ours = (s) =>
    !!s && s.status === 'complete' && s.payment_status === 'paid' && (!env.PAYMENT_LINK || s.payment_link === env.PAYMENT_LINK);

  if (typeof proof.session === 'string') {
    if (!SESSION_ID.test(proof.session)) return false;
    return ours(await get(`/checkout/sessions/${proof.session}`));
  }
  if (typeof proof.email === 'string') {
    const typed = proof.email.trim();
    if (typed.length > 254 || !EMAIL.test(typed)) return false;
    // Stripe keeps the address as the buyer typed it, so ask both ways.
    for (const email of new Set([typed, typed.toLowerCase()])) {
      const q = new URLSearchParams({ 'customer_details[email]': email, status: 'complete', limit: '100' });
      if (env.PAYMENT_LINK) q.set('payment_link', env.PAYMENT_LINK);
      const list = await get(`/checkout/sessions?${q}`);
      if (list?.data?.some(ours)) return true;
    }
  }
  return false;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function unlockRoute(request, env, fetchImpl) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let proof;
  try {
    proof = await request.json();
  } catch {
    return json({ ok: false }, 400);
  }
  try {
    return json({ ok: await isPaid(proof && typeof proof === 'object' ? proof : {}, env, fetchImpl) });
  } catch (e) {
    console.error(e);
    // No "ok" in the answer: the app says it couldn't check, and to try again.
    return json({ error: 'check failed' }, 502);
  }
}
