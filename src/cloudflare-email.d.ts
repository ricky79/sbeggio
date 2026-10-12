/** Modulo fornito dal runtime dei Worker Cloudflare (non esiste in Node né nel browser). */
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string | ReadableStream);
  }
}
