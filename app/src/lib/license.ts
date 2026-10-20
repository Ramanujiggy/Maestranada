// Pay once, unlock forever, with no accounts.
//
// A buyer gets a license key from the checkout (Lemon Squeezy). Entering it
// activates this device once against Lemon Squeezy's public license API, and
// the result is kept in localStorage, so the app never needs the network again.
//
// The gate is OFF unless VITE_LS_STORE_ID is set at build time. Until then the
// app is fully open, which is what you want while testing or giving it away.

import { useCallback, useState } from 'react';

export const FREE_PLAN_LIMIT = 3;

const KEY = 'maestranada.license.v1';
const STORE_ID = import.meta.env.VITE_LS_STORE_ID as string | undefined;
export const BUY_URL = (import.meta.env.VITE_BUY_URL as string | undefined) ?? '';

export function licensingEnabled(): boolean {
  return Boolean(STORE_ID);
}

export interface License {
  key: string;
  instanceId: string;
  activatedAt: string;
}

function read(): License | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as License) : null;
  } catch {
    return null;
  }
}

function write(license: License): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(license));
  } catch {
    // Without storage the unlock lasts for this session only.
  }
}

interface ActivateResponse {
  activated?: boolean;
  error?: string | null;
  instance?: { id: string } | null;
  meta?: { store_id?: number };
}

export type ActivateResult = { ok: true; license: License } | { ok: false; message: string };

/** Activates a key for this device. `fetchImpl` is injectable for tests. */
export async function activate(key: string, fetchImpl: typeof fetch = fetch): Promise<ActivateResult> {
  const licenseKey = key.trim();
  if (!licenseKey) return { ok: false, message: 'Enter the license key from your receipt.' };
  let res: Response;
  try {
    res = await fetchImpl('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ license_key: licenseKey, instance_name: deviceName() }),
    });
  } catch {
    return { ok: false, message: 'Could not reach the license server. Check your connection and try again.' };
  }
  let data: ActivateResponse;
  try {
    data = (await res.json()) as ActivateResponse;
  } catch {
    return { ok: false, message: 'The license server sent an unexpected reply. Try again.' };
  }
  if (!data.activated || !data.instance) {
    return { ok: false, message: data.error || 'That key was not accepted.' };
  }
  if (STORE_ID && String(data.meta?.store_id) !== String(STORE_ID)) {
    return { ok: false, message: 'That key is for a different product.' };
  }
  const license = { key: licenseKey, instanceId: data.instance.id, activatedAt: new Date().toISOString() };
  write(license);
  return { ok: true, license };
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const kind = /iphone|ipad|android|mobile/i.test(ua) ? 'Phone or tablet' : 'Computer';
  return `${kind} · ${new Date().toLocaleDateString()}`;
}

export interface LicenseApi {
  enabled: boolean;
  unlocked: boolean;
  /** True when a new plan would go past the free limit. */
  atLimit: (planCount: number) => boolean;
  unlock: (key: string) => Promise<ActivateResult>;
}

export function useLicense(): LicenseApi {
  const [license, setLicense] = useState<License | null>(read);
  const enabled = licensingEnabled();
  const unlocked = !enabled || license !== null;

  const unlock = useCallback(async (key: string) => {
    const result = await activate(key);
    if (result.ok) setLicense(result.license);
    return result;
  }, []);

  return {
    enabled,
    unlocked,
    atLimit: (count) => !unlocked && count >= FREE_PLAN_LIMIT,
    unlock,
  };
}
