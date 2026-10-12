import { gestisciEmail, type EnvEmail, type MailInArrivo } from './email';

/**
 * Worker Cloudflare davanti ai file statici della PWA (wrangler.jsonc). Serve sbeggio.app e rimanda
 * www.sbeggio.app alla radice del dominio, tenendo percorso e query. Riceve anche la posta di
 * supporto@sbeggio.app (src/email.ts).
 */
interface Env extends EnvEmail {
  ASSETS: { fetch(richiesta: Request): Promise<Response> };
}

const DOMINIO = 'sbeggio.app';

export default {
  async fetch(richiesta: Request, env: Env): Promise<Response> {
    const url = new URL(richiesta.url);
    if (url.hostname === `www.${DOMINIO}`) {
      url.protocol = 'https:';
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(richiesta);
  },

  async email(mail: MailInArrivo, env: Env): Promise<void> {
    await gestisciEmail(mail, env, async (da, a, grezzo) => {
      const { EmailMessage } = await import('cloudflare:email');
      return new EmailMessage(da, a, grezzo);
    });
  },
};
