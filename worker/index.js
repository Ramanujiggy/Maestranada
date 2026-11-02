// The app's Cloudflare Worker. It serves the built app (app/dist) as plain
// files and runs code for /api/* only: /api/unlock, the purchase check behind
// the unlock (see unlock.js and app/src/lib/access.ts), and /api/ai/*, the
// Prancheta AI subscription and chat (see ai.js and app/src/lib/aiService.ts).
import { unlockRoute } from './unlock.js';
import { aiRoute } from './ai.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/unlock') return unlockRoute(request, env);
    if (pathname.startsWith('/api/ai/')) return aiRoute(request, env);
    return env.ASSETS.fetch(request);
  },
};
