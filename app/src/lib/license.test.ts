import { activate } from './license.ts';

const reply = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

describe('license activation', () => {
  it('accepts an activated key and stores it', async () => {
    const r = await activate(' KEY-1 ', reply({ activated: true, instance: { id: 'inst-1' }, meta: { store_id: 1 } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.license).toMatchObject({ key: 'KEY-1', instanceId: 'inst-1' });
    expect(localStorage.getItem('maestranada.license.v1')).toContain('inst-1');
  });

  it('passes on the server error for a bad key', async () => {
    const r = await activate('nope', reply({ activated: false, error: 'license_key not found.' }));
    expect(r).toEqual({ ok: false, message: 'license_key not found.' });
  });

  it('explains a network failure', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const r = await activate('KEY', offline);
    expect(r.ok).toBe(false);
  });

  it('rejects an empty key without calling the server', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect((await activate('  ', spy)).ok).toBe(false);
    expect(called).toBe(false);
  });
});
