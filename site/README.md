# Sales page

The one-page site for pranchetabjj.com. Plain HTML, no build step. The app itself lives in `app/`.

## Before launch

At the bottom of `index.html`, set:

- `BUY_BUTTON`: the Stripe buy button's id and publishable key (the same as in `app/src/lib/access.ts`). It replaces the price section's buy link once Stripe's script loads. A `pk_test_` key takes test cards only; swap in the live id and key to sell.
- `APP_URL`: the app (`https://app.pranchetabjj.com`). The Try it free buttons open it.
- `SUPPORT_EMAIL`: the address shown in the footer.

## Deploy

Recommended: a Cloudflare Pages project with Root directory `site`, no build command, output `.`. Netlify reads `site/netlify.toml` (Base directory `site`). See [HOSTING.md](../HOSTING.md).

On Railway: add a second service from this repo and set its **Root Directory** to `site`. It serves the folder as-is on Railway's `PORT`. Then add `pranchetabjj.com` as its custom domain, and `app.pranchetabjj.com` on the app's service.

## Preview locally

```bash
cd site
npx serve .
```

The screenshots in `img/` are taken from the app at a 390 × 844 phone size; retake them when the app's look changes.
