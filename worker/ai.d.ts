// Types for ai.js, so the app's tests can import it.
export interface AiKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
export interface AiEnv {
  ANTHROPIC_KEY?: string;
  AI_SECRET?: string;
  RESEND_KEY?: string;
  STRIPE_KEY?: string;
  AI_CHECKOUT_URL?: string;
  AI_PORTAL_URL?: string;
  AI_PAYMENT_LINK?: string;
  AI_MODEL?: string;
  AI_MONTHLY_CENTS?: string;
  AI_FROM?: string;
  AI_KV?: AiKv;
}
export interface AiDeps {
  fetch?: typeof fetch;
  client?: { beta: { messages: { create(params: unknown): Promise<unknown> } } };
  now?: number;
}
export const DEFAULT_MODEL: string;
export const DEFAULT_MONTHLY_CENTS: number;
export function makeKey(subId: string, env: AiEnv): Promise<string>;
export function readKey(key: unknown, env: AiEnv): Promise<string | null>;
export function emailCode(email: string, window: number, env: AiEnv): Promise<string>;
export function subscriptionLive(subId: string, env: AiEnv, fetchImpl?: typeof fetch): Promise<boolean>;
export function costCents(model: string, usage: unknown): number;
export function aiReady(env: AiEnv): boolean;
export function aiRoute(request: Request, env: AiEnv, deps?: AiDeps): Promise<Response>;
