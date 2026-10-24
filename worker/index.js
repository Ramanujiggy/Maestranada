// The app's Cloudflare Worker. It serves the built app (app/dist) as plain
// files and runs code for one route only: /api/unlock, the purchase check
// behind the unlock (see unlock.js and app/src/lib/access.ts).
import { unlockRoute } from './unlock.js';

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/unlock') return unlockRoute(request, env);
    return env.ASSETS.fetch(request);
  },
};
