// Stripe's buy button, loaded from Stripe only when the unlock sheet shows it.
// It needs a connection; offline (or if Stripe's script is blocked) a line
// says so instead.

import { useEffect, useState } from 'react';
import { BUY_BUTTON } from '../lib/access.ts';
import { t } from '../lib/i18n.ts';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': HTMLAttributes<HTMLElement> & { 'buy-button-id': string; 'publishable-key': string };
    }
  }
}

const SRC = 'https://js.stripe.com/v3/buy-button.js';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (customElements.get('stripe-buy-button')) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Stripe buy button did not load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function BuyButton() {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() =>
    customElements.get('stripe-buy-button') ? 'ready' : 'loading',
  );
  useEffect(() => {
    let live = true;
    loadScript().then(
      () => live && setState('ready'),
      () => live && setState('failed'),
    );
    return () => {
      live = false;
    };
  }, []);

  if (state === 'failed') return <p className="muted unlock-buy-off">{t('unlockBuyOffline')}</p>;
  return (
    <div className="unlock-buy" aria-busy={state === 'loading'}>
      {state === 'ready' && <stripe-buy-button buy-button-id={BUY_BUTTON.id} publishable-key={BUY_BUTTON.publishableKey} />}
    </div>
  );
}
