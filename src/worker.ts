import { ID_VALIDO, MESSAGGIO_MASSIMO } from './core/collega';

export { Collegamento } from './collegamento';

/**
 * Worker Cloudflare davanti ai file statici (wrangler.jsonc):
 * - www.sbeggio.app rimanda alla radice di sbeggio.app, tenendo percorso e query;
 * - sbeggio.app serve la PWA;
 * - web.sbeggio.app serve il sito per scaricare le timbrature (web.html) e il relay /collega/<id>,
 *   un Durable Object per collegamento (src/collegamento.ts). In locale il relay risponde anche su localhost.
 */
interface Env {
  ASSETS: { fetch(richiesta: Request): Promise<Response> };
  COLLEGAMENTI: {
    idFromName(nome: string): unknown;
    get(id: unknown): { fetch(richiesta: Request): Promise<Response> };
  };
}

const DOMINIO = 'sbeggio.app';
const SITO = `web.${DOMINIO}`;
/** PWA, app Android (Capacitor) e server di sviluppo di Vite. */
const ORIGINI_CORS = ['https://sbeggio.app', 'https://localhost', 'http://localhost:5173'];
const PREFISSO_COLLEGA = '/collega/';

function intestazioniCors(origine: string | null): Headers {
  const h = new Headers({ Vary: 'Origin' });
  if (origine && ORIGINI_CORS.includes(origine)) h.set('Access-Control-Allow-Origin', origine);
  return h;
}

async function collega(richiesta: Request, env: Env, url: URL): Promise<Response> {
  const id = url.pathname.slice(PREFISSO_COLLEGA.length);
  const cors = intestazioniCors(richiesta.headers.get('Origin'));
  if (!ID_VALIDO.test(id)) return new Response('Collegamento non valido', { status: 400, headers: cors });
  if (richiesta.method === 'OPTIONS') {
    cors.set('Access-Control-Allow-Methods', 'POST');
    cors.set('Access-Control-Allow-Headers', 'Content-Type');
    cors.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: cors });
  }
  // Troppo grande già a dichiararlo: non serve svegliare il relay (che comunque ricontrolla leggendo).
  if (Number(richiesta.headers.get('Content-Length')) > MESSAGGIO_MASSIMO) {
    return new Response(null, { status: 413, headers: cors });
  }
  const risposta = await env.COLLEGAMENTI.get(env.COLLEGAMENTI.idFromName(id)).fetch(richiesta);
  // Il 101 del WebSocket va restituito così com'è (porta con sé il socket).
  if (risposta.status === 101) return risposta;
  const intestazioni = new Headers(risposta.headers);
  cors.forEach((valore, nome) => intestazioni.set(nome, valore));
  return new Response(risposta.body, { status: risposta.status, headers: intestazioni });
}

/** I chunk in /assets/ e l'icona restano quelli richiesti; ogni altro percorso è la pagina del sito. */
function richiestaSito(richiesta: Request, url: URL): Request {
  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') return richiesta;
  // Workers Assets (html_handling predefinito) serve web.html all'indirizzo /web.
  return new Request(new URL('/web', url), richiesta);
}

export default {
  async fetch(richiesta: Request, env: Env): Promise<Response> {
    const url = new URL(richiesta.url);
    if (url.hostname === `www.${DOMINIO}`) {
      url.protocol = 'https:';
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }
    const locale = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if ((url.hostname === SITO || locale) && url.pathname.startsWith(PREFISSO_COLLEGA)) return collega(richiesta, env, url);
    if (url.hostname === SITO) return env.ASSETS.fetch(richiestaSito(richiesta, url));
    return env.ASSETS.fetch(richiesta);
  },
};
