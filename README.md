# Prancheta

The perfect Jiu-Jitsu class prep tool.

A class is made of blocks: **Warm-up**, **Concept**, **Positional sparring**, **Technique**, **Rolling**, and an optional **Wrap-up**. Coaches can add, remove, repeat, rename and reorder them, or start from one of five formats (Game first, Technique first, Open mat, Drilling day, Comp prep).

The app lets a coach build a plan, see how long the class runs, teach it from a phone or tablet with a round timer, add short technique clips, send the whole class as one file, plan it with their own AI chat, and print a one-page class sheet. It runs in English and Brazilian Portuguese.

What's next is in [ROADMAP.md](ROADMAP.md).

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run test:run   # unit tests
npm run build      # static build in app/dist
```

## Deploy

The app is static files, so any static host works. The recommended setup (Cloudflare Pages, with a Netlify spare, behind the `pranchetabjj.com` domain) and what an outage means for buyers are in [HOSTING.md](HOSTING.md).

- **Cloudflare Pages:** Root directory empty, build command `npm run build`, output `app/dist`.
- **Netlify:** reads `netlify.toml`.
- **Railway:** leave the Root Directory empty. The root `railway.toml` and `package.json` build `app/` and serve it on Railway's `PORT`.

Plans are saved in the browser's local storage on the device they were made on. Back up all classes, or send a class file, to move them between devices.

## Install and offline

The app is a Progressive Web App. After the first visit it works with no connection (app, fonts and icons are all cached). On Chrome, Edge and Android it shows an **Install app** button; on iPhone and iPad, use Share → Add to Home Screen. New versions show an **Update** prompt.

## Selling it (3 classes free, then $10 once)

Anyone can open the app at `https://app.pranchetabjj.com` (never a host's own URL; see [HOSTING.md](HOSTING.md)), install it and make **3 classes free**, with everything in. Making a 4th asks for the $10 unlock. Every new class counts: blank, from a template, a duplicate, one planned or brought in with AI, or a single class file from someone else. Moving the coach's own classes (Paste classes, or restoring a whole-library backup) is never turned down, though those classes still count as made. Deleting a class never gives a free one back, the example class never counts, and every class already made stays open, teachable and printable. There are no accounts.

How the unlock works (`app/src/lib/access.ts`, `worker/`): the coach pays through a Stripe payment link (Managed Payments, so Stripe is the merchant of record and handles tax). Stripe sends them back to the app with the checkout's id (`?paid=cs_...`). The app asks its own Worker, `/api/unlock`, which asks Stripe with a restricted read-only key whether that checkout was paid, and answers only yes or no. The app remembers the yes and works offline from then on. The id is taken off the address straight away.

On another copy of the app (the iPhone Home Screen app, which keeps storage apart from Safari, a new phone, or a new web address), the coach taps Unlock and enters the email they paid with; the Worker looks for a paid checkout with that email. **Copy my classes** also carries the unlock: only a mark saying "unlocked" travels, never the checkout id or the email, so nothing about the purchase is in copied classes, backups, class files or exports.

Someone technical could get around this by editing the app's storage, and anyone who knows a buyer's email could unlock with it. At $10 that's fine; stopping it would need accounts. A refunded checkout still reads as paid; refunds are rare enough to leave.

The check needs the Worker: on the Netlify spare the app says it can't check right now (classes and everything else still work).

### Stripe setup

1. Turn on Managed Payments. Create a $10 one-time product with a software or digital tax category, and a payment link for it with **Enable Managed Payments** ticked.
2. In the payment link, under **After payment**, choose not to show the confirmation page and redirect to `https://app.pranchetabjj.com/?paid={CHECKOUT_SESSION_ID}`, exactly as written.
3. Create a restricted key with **Read** on Checkout Sessions and Charges, and nothing else (Charges lets it turn down refunded purchases). In Cloudflare, on the `prancheta-app` Worker, add it as a secret named `STRIPE_KEY` (Settings → Variables and Secrets). Optionally add a plain variable `PAYMENT_LINK` with the link's `plink_...` id, so other products in the account don't unlock the app.
4. Put the payment link's address (`https://buy.stripe.com/...`) in `CHECKOUT_URL` in `app/src/lib/access.ts` and in `site/index.html`. Both show it as our own styled button. A `test_` link (and a test-mode `STRIPE_KEY`) takes test cards only; swap both for live ones to sell.
5. Install works the same for everyone, buyers or not:
   - **Laptop:** Chrome or Edge show an **Install app** button. Safari on a Mac uses File → Add to Dock.
   - **iPhone / iPad:** Share → Add to Home Screen.
   - **Android:** the **Install app** button.

Plans stay on the coach's device. Nothing about them is collected; Stripe keeps the buyer's email for the receipt, and the unlock check sends only the checkout id or the email the coach types, and gets back yes or no.
