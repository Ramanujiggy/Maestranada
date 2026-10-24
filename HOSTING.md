# Hosting and outages

Written 2026-10-22, during another Railway outage (it was also down on 2026-10-20 and 2026-10-21).

## What an outage means today

Prancheta is a set of plain files (HTML, scripts, icons). Nothing runs on a server: classes live on the coach's own device. So a hosting outage only affects getting the files, not using them.

| Who | During an outage |
| --- | --- |
| A coach who has opened the app before (installed or not) | Keeps working. The app, fonts and icons are cached on the device, so it opens and saves offline. They just don't get updates until the host is back. |
| A new coach trying it, or a buyer opening the receipt link | Sees an error page. A buyer who already has the app can unlock later; the check needs the Cloudflare Worker and Stripe to be up. |
| Someone visiting the sales page | Sees an error page, so no sales during the outage. |

## The rule that matters most: own the address

A web app's saved classes belong to its address. If the app moves from one address to another, coaches' classes stay behind at the old one. So the address must never change, and the host behind it must be swappable.

That's what a domain gives you. With `app.pranchetabjj.com` pointing at a host, switching hosts is a one-line DNS change, and coaches keep everything because the address they use is the same. Without a domain, the address *is* the host (`something.up.railway.app`), and leaving Railway means losing everyone's data.

So: buy the domain and put the app on it before the first sale. Never give buyers a host's own URL.

If classes ever do need to move (your own classes on the Railway address, say), keep the old address up until they're across: open the old one, tap **Copy my classes** at the bottom of the class list, then open the new address with `?paste` on the end (`https://app.pranchetabjj.com/?paste`) and tap **Paste**. Clips come along. Don't redirect the old address before this, or its classes can't be reached.

## Recommendation

1. **Put `pranchetabjj.com`'s DNS on Cloudflare** (bought 2026-10-24). If it was bought elsewhere, add it to a free Cloudflare account and switch the nameservers at the registrar to the two Cloudflare gives you.
2. **Host the app and sales page on Cloudflare Pages** (free). It serves static files from data centres worldwide, with no server to keep alive. Railway runs a small server just to hand out files, which is one more thing that can fail.
3. **Keep a ready copy on Netlify** (free), built from the same `main` branch on every push, but not pointed at by the domain. If Cloudflare Pages is ever down for long, point the two DNS records at Netlify and you're back in minutes.
4. **Turn Railway off** once the domain works on Cloudflare Pages, or keep it as a second spare. The repo still builds there unchanged.
5. **Add a free uptime check** (UptimeRobot or Better Stack) on `pranchetabjj.com` and `app.pranchetabjj.com`, so you hear about an outage from a text, not from a buyer.

One honest limit: if Cloudflare itself has a bad day, DNS and hosting go down together. That's rare, it's short when it happens, and installed coaches keep working regardless. Splitting DNS and hosting across companies adds setup and accounts for little real gain at this size.

## The same setup for future products

Any product that is plain files (a PWA, a landing page) can follow this exactly: its own domain at the registrar, a Pages project, a Netlify spare. Products that need a server or a database (accounts, sync) need more: a database backup and a second place to run the server. Plan that per product when it comes up.

## Setup steps

### Cloudflare Pages (primary)

Create two Pages projects from the GitHub repo (Workers & Pages → Create → Pages → Connect to Git):

| Project | Root directory | Build command | Output directory |
| --- | --- | --- | --- |
| App | *(empty)* | `npm run build` | `app/dist` |
| Sales page | `site` | *(empty)* | `.` |

Then add custom domains: `app.pranchetabjj.com` on the app project, `pranchetabjj.com` on the sales page project. Because the domain is on Cloudflare, it sets the DNS records for you.

### Netlify (spare)

Import the same repo twice (Add new site → Import an existing project). The app reads `netlify.toml` at the root; for the sales page set **Base directory** to `site`, which reads `site/netlify.toml`. Don't add the custom domains yet; note the two `*.netlify.app` addresses.

### Switching during an outage

In Cloudflare DNS, change the `app` and root records to CNAMEs pointing at the Netlify addresses (proxy off), then add the custom domains in Netlify so it issues certificates. Switch back the same way. Coaches notice nothing; their classes are untouched because the address never changed.

### Files in the repo for each host

- `app/public/_headers`: cache rules for Cloudflare Pages and Netlify. The page and service worker are always rechecked, so updates reach buyers.
- `app/public/serve.json`: the same rules for Railway.
- `netlify.toml`, `site/netlify.toml`: Netlify build settings.
- `wrangler.jsonc`, `worker/`: the app's Cloudflare Worker. It serves `app/dist` and answers the unlock check at `/api/unlock` (needs the `STRIPE_KEY` secret). Netlify and Railway have no unlock check; there the app says it can't check right now.
- `railway.toml`, `site/railway.toml`, root `package.json`: Railway.
- `.node-version`: Node 22 for every host's build.
