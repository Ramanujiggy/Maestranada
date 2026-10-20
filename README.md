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

## Selling it (pay once, download, it works)

There is no free tier, no account and no license key. A buyer pays once and gets the app.

1. Create a $10 product in Lemon Squeezy or Gumroad.
2. Set the purchase to deliver the app link (the Railway URL) in the receipt page and email. The same link is the install for every device:
   - **Laptop:** Chrome or Edge show an **Install app** button. Safari on a Mac uses File → Add to Dock.
   - **iPhone / iPad:** Share → Add to Home Screen.
   - **Android:** the **Install app** button.
3. Once installed it opens like any other app and runs offline. Every deploy reaches every buyer as an update.

Plans stay on the buyer's device. Nothing about them is collected; the checkout keeps the buyer's email for the receipt.

The app link itself is not secret: anyone who has it can open the app. At $10 that trade-off keeps delivery simple.
