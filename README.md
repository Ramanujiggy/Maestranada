# Maestranada

The perfect Jiu-Jitsu class prep tool.

Every class follows one structure:

1. **Warm-up · Movement** — solo movement drills (forward rolls, shrimps, cartwheels…)
2. **Concept** — the one general rule the class is about
3. **Positional game** — a spar from a position toward a goal. Show the general goals and movements first, then the details of beating the position, the transition and the submission. Rounds are set as e.g. 2 × 3 min, switch partners, then switch positions.
4. **Gems** — the specific moves and the options off them
5. **Free roll**

The app lets a coach build a plan in that shape, see how long the class runs, teach it from a phone or tablet with a round timer, and print a one-page class sheet.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run test:run   # unit tests
npm run build      # static build in app/dist
```

## Deploy on Railway

Create a service from this repo and leave the Root Directory empty. The root `railway.toml` and `package.json` build `app/` and serve the static build on Railway's `PORT`.

Plans are saved in the browser's local storage on the device they were made on. Export and import (JSON) move them between devices.

## Install and offline

The app is a Progressive Web App. After the first visit it works with no connection (app, fonts and icons are all cached). On Chrome, Edge and Android it shows an **Install app** button; on iPhone and iPad, use Share → Add to Home Screen. New versions show an **Update** prompt.

## Selling it (pay once, no accounts)

The app has an optional license gate built for a one-time purchase through [Lemon Squeezy](https://www.lemonsqueezy.com/):

- Free version: up to 3 class plans. Everything else works.
- Full version: the buyer enters the license key from their receipt. The app activates it once against Lemon Squeezy's public license API and remembers it on that device. No account, no sign-in, no data collected.

It is **off by default**. To turn it on, set these Railway variables and redeploy:

| Variable | Value |
|---|---|
| `VITE_LS_STORE_ID` | Your Lemon Squeezy store id (keys from other stores are rejected) |
| `VITE_BUY_URL` | Your product's checkout link, shown on the unlock screen |

In Lemon Squeezy, enable license keys on the product and set the activation limit to how many devices one purchase covers.

The look follows the Journada design language: forest surfaces, copper borders, champagne titles, orange actions.
