// Cloudflare Pages Function: passes a license check from the app on to Lemon
// Squeezy, from the app's own address, so the browser never has to be let
// through to Lemon Squeezy itself. Only the key goes along. See app/src/lib/access.ts.
export async function onRequestPost({ request }) {
  const form = await request.formData().catch(() => null);
  const key = String(form?.get('license_key') ?? '').trim().slice(0, 100);
  const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ license_key: key }),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
