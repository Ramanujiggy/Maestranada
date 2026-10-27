// Types for unlock.js, so the app's tests can import it.
export interface UnlockEnv {
  STRIPE_KEY?: string;
  PAYMENT_LINK?: string;
}
export function isPaid(proof: { session?: unknown; email?: unknown }, env: UnlockEnv, fetchImpl?: typeof fetch): Promise<boolean>;
export function unlockRoute(request: Request, env: UnlockEnv, fetchImpl?: typeof fetch): Promise<Response>;
