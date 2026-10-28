// Prancheta AI, the app's side: the monthly subscription and the chat that
// plans a class with the coach (the server side is worker/ai.js). There are no
// accounts. Subscribing on Stripe sends the coach back with the checkout's id
// (?ai=cs_...), which the Worker swaps for this phone's key; another phone
// gets the same key with a code sent to the email they subscribed with. The
// key stays on this device and only ever goes to our own Worker. Chats aren't
// kept anywhere but this tab.

import { chatFormat } from './aiClass.ts';
import { getLang } from './i18n.ts';

const KEY_KEY = 'maestranada.aiKey';
const CHAT_KEY = 'maestranada.aiChat';

export interface AiInfo {
  ready: boolean;
  checkout: string | null;
  portal: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export type ChatError = 'offline' | 'badKey' | 'notActive' | 'limit' | 'busy' | 'noAnswer' | 'failed';
export type ChatResult = { reply: string; cutOff: boolean; used: number } | { error: ChatError; used?: number };

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // Private mode: it lasts until the tab closes.
  }
}

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage);
const session = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage);

export const getAiKey = (): string | null => safeGet(local(), KEY_KEY);
export const saveAiKey = (key: string | null): void => safeSet(local(), KEY_KEY, key);

/** The chat so far in this tab, so closing the sheet by mistake doesn't lose it. */
export function savedChat(): ChatMessage[] {
  try {
    const v: unknown = JSON.parse(safeGet(session(), CHAT_KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v.filter(
      (m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string',
    );
  } catch {
    return [];
  }
}

export const saveChat = (messages: ChatMessage[]): void =>
  safeSet(session(), CHAT_KEY, messages.length ? JSON.stringify(messages) : null);

/** The checkout id Stripe sends a new subscriber back with (`?ai=cs_...`), if any. */
export function aiSession(search: string): string | null {
  const id = new URLSearchParams(search).get('ai');
  return id && /^cs_[A-Za-z0-9_]+$/.test(id) ? id : null;
}

async function post(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`/api/ai/${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
    const data = (await res.json()) as unknown;
    return data && typeof data === 'object' ? { status: res.status, data: data as Record<string, unknown> } : null;
  } catch {
    return null;
  }
}

/** Whether Prancheta AI is switched on, and where to subscribe and manage it. Null when offline. */
export async function aiInfo(): Promise<AiInfo | null> {
  try {
    const res = await fetch('/api/ai/info', { headers: { Accept: 'application/json' } });
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
    const d = (await res.json()) as Partial<AiInfo>;
    return { ready: d.ready === true, checkout: d.checkout ?? null, portal: d.portal ?? null };
  } catch {
    return null;
  }
}

export type KeyResult = 'ok' | 'bad' | 'tooMany' | 'offline';

function takeKey(res: Awaited<ReturnType<typeof post>>): KeyResult {
  if (!res) return 'offline';
  if (res.data.ok === true && typeof res.data.key === 'string') {
    saveAiKey(res.data.key);
    return 'ok';
  }
  if (res.data.error === 'tooMany') return 'tooMany';
  return res.status >= 500 ? 'offline' : 'bad';
}

/** Back from subscribing: swaps the checkout for this phone's key. */
export const joinWith = async (checkout: string): Promise<KeyResult> => takeKey(await post('join', { session: checkout }));

/** Emails a code to this address if it subscribes. The answer doesn't say whether it does. */
export async function sendCode(email: string): Promise<'ok' | 'offline'> {
  const res = await post('code', { email, lang: getLang() });
  return res && res.data.ok !== undefined ? 'ok' : 'offline';
}

export const verifyCode = async (email: string, code: string): Promise<KeyResult> =>
  takeKey(await post('verify', { email, code }));

/** How much of this month's Prancheta AI is used (0 to 1), or why it can't be used. */
export async function aiStatus(): Promise<{ used: number } | { error: ChatError }> {
  const key = getAiKey();
  if (!key) return { error: 'badKey' };
  const res = await post('status', { key });
  if (!res) return { error: 'offline' };
  if (res.data.ok === true) return { used: Number(res.data.used) || 0 };
  return { error: errorOf(res.data.error) };
}

const ERRORS: ChatError[] = ['badKey', 'notActive', 'limit', 'busy', 'noAnswer'];
const errorOf = (e: unknown): ChatError => (ERRORS.includes(e as ChatError) ? (e as ChatError) : 'failed');

/** Sends the chat so far and gets Prancheta AI's next message. */
export async function chat(messages: ChatMessage[]): Promise<ChatResult> {
  const key = getAiKey();
  if (!key) return { error: 'badKey' };
  const res = await post('chat', { key, format: chatFormat(), messages });
  if (!res) return { error: 'offline' };
  const used = typeof res.data.used === 'number' ? res.data.used : undefined;
  if (res.data.ok === true && typeof res.data.reply === 'string') {
    return { reply: res.data.reply, cutOff: res.data.cutOff === true, used: used ?? 0 };
  }
  const error = errorOf(res.data.error);
  // A key the Worker no longer takes is no use on this phone.
  if (error === 'badKey') saveAiKey(null);
  return used === undefined ? { error } : { error, used };
}

/** The reply's words without the class JSON, which the app shows as a class instead. */
export function replyText(reply: string): string {
  return reply.replace(/```[a-zA-Z]*\s*\n?[\s\S]*?(```|$)/g, '').trim();
}
