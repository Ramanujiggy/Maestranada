# Prancheta AI: setup

Prancheta AI is the optional $5/month chat inside the app that plans a class with the coach. Code: `worker/ai.js` (server), `app/src/lib/aiService.ts` and `app/src/components/PranchetaAi.tsx` (app). It stays hidden in the app until the Worker has everything below, so the code can ship before the setup is done.

There are still no accounts. Stripe is the only record of who pays. The phone keeps a signed key; another phone gets it with a 6-digit code sent to the subscription's email. Classes and chats are never stored on the server. The KV store `AI_KV` only keeps each subscription's usage this month and short-lived counters. It's created automatically on the first deploy.

All of the settings below go on the **`prancheta`** Worker: Cloudflare dashboard → Workers & Pages → `prancheta` → Settings → Variables and Secrets. "Secret" means choose type *Secret*; the rest are *Text*. `wrangler.jsonc` has `keep_vars: true`, so deploys keep them.

## 1. Anthropic (the AI)

1. Go to console.anthropic.com and sign up. This is separate from a Claude subscription: a Claude Pro or Max plan can't be used by an app, and the API is billed per use.
2. Billing: add a card and some credit.
3. Limits: set a monthly spend limit (for example $50), so a surprise can't run up a bill.
4. API keys → Create key, named `prancheta-worker`. Copy it.
5. On the Worker add the secret **`ANTHROPIC_KEY`** with that key.

## 2. The signing secret

On the Worker add the secret **`AI_SECRET`**: any long random text (40 or more characters, for example from a password generator). Never change it later: every phone's key is signed with it, and changing it signs everyone out of Prancheta AI.

## 3. Stripe (live)

1. **Product:** Product catalog → Add product → name *Prancheta AI*, price $5.00, **Recurring, Monthly**.
2. **Payment link:** Payment links → New → pick *Prancheta AI*. Under *After payment*, choose *Don't show confirmation page* and redirect to:
   `https://app.pranchetabjj.com/?ai={CHECKOUT_SESSION_ID}`
   Turn on *Allow promotion codes* (for the test coupon below). Create the link.
3. On the Worker add the variable **`AI_CHECKOUT_URL`** with the link's `https://buy.stripe.com/...` address. Optional: **`AI_PAYMENT_LINK`** with its `plink_...` id (from the link's page in the dashboard), so only this link counts.
4. **Customer portal:** Settings → Billing → Customer portal → turn it on. Allow customers to cancel, **at the end of the billing period**. Copy the portal's *login link* (`https://billing.stripe.com/p/login/...`) and add it as the variable **`AI_PORTAL_URL`**.
5. **STRIPE_KEY permissions:** Developers → API keys → the restricted key already used as `STRIPE_KEY` → Edit → add **Subscriptions: Read**. Keep Checkout Sessions: Read.
6. **Test coupon:** Product catalog → Coupons → New: 100% off, *Once*. Add a promotion code to it (for example `TESTAI`), limited to 1 or 2 uses. Use it for your own test purchase so it doesn't charge you.

## 4. Resend (the email codes)

1. Sign up at resend.com. The free plan is enough.
2. Domains → Add domain → `pranchetabjj.com`. Add the DNS records it lists in Cloudflare → `pranchetabjj.com` → DNS (Resend can do this for you if you sign in to Cloudflare from there). Wait until it says *Verified*.
3. API keys → Create, with *Sending access* only. On the Worker add the secret **`RESEND_KEY`**.
4. Codes are sent from `Prancheta <help@pranchetabjj.com>`. To change that, add the variable `AI_FROM`.

## 5. Optional knobs

| Variable | Default | What it does |
| --- | --- | --- |
| `AI_MODEL` | `claude-haiku-5-5` | Which Claude model answers. `claude-sonnet-5-5` or `claude-opus-5-5` write better classes but cost far more. |
| `AI_MONTHLY_CENTS` | `250` | What one subscriber's AI may cost us in a month, in US cents. The app shows it as "This month: N% used". |

Rough cost per class with the default model (Haiku 5.5) is well under a cent (a few questions and the class JSON), so $2.50 a month covers hundreds of classes. The same class on `claude-opus-5-5` costs 10 to 15 cents, about 20 classes for $2.50. The real numbers show in console.anthropic.com → Usage after a few test classes.

## 6. Turn it on and test

1. Merge the pull request. The deploy creates the KV store.
2. Open the app → New class. **Talk it through with Prancheta AI** appears once everything above is set.
3. Subscribe with the test promotion code. Stripe sends you back to the app, which sets up this phone.
4. Plan a normal class, a seminar, and a class you change a few times. Then check Usage in the Anthropic console and adjust `AI_MONTHLY_CENTS` if needed.
5. On another device (or the Home Screen app): New class → Prancheta AI → *Already subscribed?* → your email → the code.
6. Cancel from *Manage subscription* to check the portal works.
