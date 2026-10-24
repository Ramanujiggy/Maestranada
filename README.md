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

How the unlock works (`app/src/lib/access.ts`): Lemon Squeezy issues a license key with the purchase. The coach pastes it into the unlock sheet once; the app checks it with Lemon Squeezy's License API while online, remembers it on the device, and works offline from then on. The check goes through the app's own address first (`functions/api/license.js` on Cloudflare Pages, a proxy rule in `netlify.toml`), then straight to Lemon Squeezy.

On iPhone the Home Screen app keeps storage apart from Safari, so the unlock travels with **Copy my classes**: pasting into the other copy unlocks it too. Only a mark saying "unlocked" travels, never the key: the key stays in that one copy's storage and is never in copied classes, backups, class files or exports. Entering the key again also works. The same goes for a new web address.

Someone technical could get around this by clearing storage or sharing a key. At $10 that's fine; stopping it would need accounts.

### Lemon Squeezy setup

1. Create a $10 product. Turn on **Generate license keys**, with no expiry and no activation limit (the app only checks keys, it never uses up activations).
2. Copy the checkout link into `CHECKOUT_URL` in `app/src/lib/access.ts` and in `site/index.html`, and the product id into `PRODUCT_ID` in `access.ts`, so keys for any other product are turned down.
3. Add one line to the receipt: "Open Prancheta, tap Unlock on the class list, and paste your license key." Include the app link.
4. Install works the same for everyone, buyers or not:
   - **Laptop:** Chrome or Edge show an **Install app** button. Safari on a Mac uses File → Add to Dock.
   - **iPhone / iPad:** Share → Add to Home Screen.
   - **Android:** the **Install app** button.

Plans stay on the coach's device. Nothing about them is collected; the checkout keeps the buyer's email for the receipt, and the license check sends only the key.
