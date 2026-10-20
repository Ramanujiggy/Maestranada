/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Lemon Squeezy store id. Set it to turn on the free limit and license unlock. */
  readonly VITE_LS_STORE_ID?: string;
  /** Checkout link shown on the unlock sheet. */
  readonly VITE_BUY_URL?: string;
}
