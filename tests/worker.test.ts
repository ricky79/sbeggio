import { describe, expect, it, vi } from 'vitest';
import { MESSAGGIO_MASSIMO } from '../src/core/collega';
import worker from '../src/worker';

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';

function envFinto() {
  const fetch = vi.fn(async (_r: Request) => new Response('asset'));
  const relay = vi.fn(async (_r: Request) => new Response('relay', { status: 404 }));
  const idFromName = vi.fn((nome: string) => `id:${nome}`);
  const get = vi.fn((_id: unknown) => ({ fetch: relay }));
  return { env: { ASSETS: { fetch }, COLLEGAMENTI: { idFromName, get } }, fetch, relay, idFromName, get };
}

describe('worker di sbeggio.app', () => {
  it('www.sbeggio.app rimanda a sbeggio.app con 301, tenendo percorso e query', async () => {
    const { env, fetch } = envFinto();
    const r = await worker.fetch(new Request('http://www.sbeggio.app/prova?x=1'), env);
    expect(r.status).toBe(301);
    expect(r.headers.get('Location')).toBe('https://sbeggio.app/prova?x=1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['/', '/assets/index-abc.js', '/qualunque/percorso', `/collega/${ID}`])(
    'sbeggio.app%s serve i file statici della PWA, come prima',
    async (percorso) => {
      const { env, fetch, relay } = envFinto();
      const richiesta = new Request(`https://sbeggio.app${percorso}`);
      const r = await worker.fetch(richiesta, env);
      expect(await r.text()).toBe('asset');
      expect(fetch).toHaveBeenCalledWith(richiesta);
      expect(relay).not.toHaveBeenCalled();
    },
  );
});

describe('worker di web.sbeggio.app', () => {
  it.each(['/', '/index.html', '/altro'])('%s serve la pagina del sito', async (percorso) => {
    const { env, fetch } = envFinto();
    await worker.fetch(new Request(`https://web.sbeggio.app${percorso}`), env);
    // Workers Assets serve web.html all'indirizzo /web (/web.html farebbe un redirect).
    expect(fetch.mock.calls[0]![0].url).toBe('https://web.sbeggio.app/web');
  });

  it.each(['/assets/web-abc.js', '/favicon.svg'])('%s resta quello richiesto', async (percorso) => {
    const { env, fetch } = envFinto();
    const richiesta = new Request(`https://web.sbeggio.app${percorso}`);
    await worker.fetch(richiesta, env);
    expect(fetch).toHaveBeenCalledWith(richiesta);
  });

  it('un id non valido risponde 400 senza svegliare il relay', async () => {
    const { env, relay } = envFinto();
    const r = await worker.fetch(new Request('https://web.sbeggio.app/collega/corto', { method: 'POST' }), env);
    expect(r.status).toBe(400);
    expect(relay).not.toHaveBeenCalled();
  });

  it('preflight CORS solo per le origini dell\'app', async () => {
    const { env, relay } = envFinto();
    const preflight = (origine: string) =>
      worker.fetch(new Request(`https://web.sbeggio.app/collega/${ID}`, { method: 'OPTIONS', headers: { Origin: origine } }), env);
    const ok = await preflight('https://sbeggio.app');
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://sbeggio.app');
    expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('POST');
    expect((await preflight('https://localhost')).headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect((await preflight('https://evil.example')).headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(relay).not.toHaveBeenCalled();
  });

  it('passa la richiesta al Durable Object dell\'id e aggiunge il CORS', async () => {
    const { env, relay, idFromName, get } = envFinto();
    const r = await worker.fetch(
      new Request(`https://web.sbeggio.app/collega/${ID}`, { method: 'POST', headers: { Origin: 'https://localhost' }, body: 'x' }),
      env,
    );
    expect(idFromName).toHaveBeenCalledWith(ID);
    expect(get).toHaveBeenCalledWith(`id:${ID}`);
    expect(relay).toHaveBeenCalledOnce();
    expect(r.status).toBe(404);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
  });

  it('un invio dichiarato oltre la dimensione massima è rifiutato senza svegliare il relay', async () => {
    const { env, relay } = envFinto();
    const r = await worker.fetch(
      new Request(`https://web.sbeggio.app/collega/${ID}`, {
        method: 'POST',
        headers: { Origin: 'https://sbeggio.app', 'Content-Length': String(MESSAGGIO_MASSIMO + 1) },
        body: 'x',
      }),
      env,
    );
    expect(r.status).toBe(413);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://sbeggio.app');
    expect(relay).not.toHaveBeenCalled();
  });

  it('in locale (wrangler dev) il relay risponde anche su localhost', async () => {
    const { env, relay } = envFinto();
    await worker.fetch(new Request(`http://localhost:8787/collega/${ID}`, { method: 'POST', body: 'x' }), env);
    expect(relay).toHaveBeenCalledOnce();
  });
});
