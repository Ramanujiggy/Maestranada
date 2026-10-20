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

The look follows the Journada design language: forest surfaces, copper borders, champagne titles, orange actions.
