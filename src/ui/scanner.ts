import { motivoFotocamera, type MotivoFotocamera } from '../core/collega';
import { el } from './dom';

/** BarcodeDetector (Chrome Android, WebView) non è nei tipi DOM di TypeScript. */
interface RilevatoreCodici {
  detect(sorgente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface CostruttoreRilevatore {
  new (opzioni: { formats: string[] }): RilevatoreCodici;
  getSupportedFormats(): Promise<string[]>;
}

type Decodifica = (video: HTMLVideoElement) => Promise<string | null>;

export class ErroreFotocamera extends Error {
  constructor(readonly motivo: MotivoFotocamera) {
    super(motivo);
  }
}

/** BarcodeDetector dove c'è; altrimenti (iPhone) jsQR, caricato solo ora per non pesare sull'avvio. */
export async function rilevatoreQrDisponibile(Rilevatore: CostruttoreRilevatore | undefined): Promise<boolean> {
  if (!Rilevatore) return false;
  try {
    return (await Rilevatore.getSupportedFormats()).includes('qr_code');
  } catch {
    return false;
  }
}

async function creaDecodifica(): Promise<Decodifica> {
  const Rilevatore = (globalThis as { BarcodeDetector?: CostruttoreRilevatore }).BarcodeDetector;
  if (Rilevatore && (await rilevatoreQrDisponibile(Rilevatore))) {
    const rilevatore = new Rilevatore({ formats: ['qr_code'] });
    return async (video) => (await rilevatore.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (video) => {
    const scala = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scala);
    canvas.height = Math.round(video.videoHeight * scala);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(immagine.data, immagine.width, immagine.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

/**
 * Fotocamera posteriore a tutto schermo finché non inquadra un QR che `valida` accetta.
 * Restituisce null se l'utente annulla; lancia ErroreFotocamera se la fotocamera non si apre.
 * Alla chiusura, per qualunque motivo, la fotocamera si spegne.
 */
export async function scansionaQr<T>(valida: (testo: string) => T | null): Promise<T | null> {
  let flusso: MediaStream;
  try {
    flusso = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (e) {
    throw new ErroreFotocamera(motivoFotocamera(e));
  }
  let decodifica: Decodifica;
  try {
    decodifica = await creaDecodifica();
  } catch {
    flusso.getTracks().forEach((t) => t.stop());
    throw new ErroreFotocamera('altro');
  }

  return new Promise((risolvi) => {
    const video = el('video', { class: 'scanner-video', playsinline: true, muted: true, autoplay: true });
    const nota = el('p', { class: 'scanner-nota' }, 'Inquadra il codice QR mostrato da web.sbeggio.app');
    const dlg = el(
      'dialog',
      { class: 'scanner', 'aria-label': 'Collega al computer' },
      video,
      el('div', { class: 'scanner-mirino', 'aria-hidden': 'true' }),
      el(
        'div',
        { class: 'scanner-barra' },
        nota,
        el('button', { type: 'button', class: 'btn btn-neutro', onclick: () => dlg.close() }, 'Annulla'),
      ),
    );
    let finito = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fine = (valore: T | null) => {
      if (finito) return;
      finito = true;
      clearTimeout(timer);
      flusso.getTracks().forEach((t) => t.stop());
      if (dlg.open) dlg.close();
      dlg.remove();
      risolvi(valore);
    };
    // Annulla, Esc o "indietro" di Android.
    dlg.addEventListener('close', () => fine(null));

    const ciclo = async () => {
      if (finito) return;
      try {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const testo = await decodifica(video);
          if (testo !== null) {
            const valore = valida(testo);
            if (valore !== null) return fine(valore);
            nota.textContent = 'Questo non è un codice di Sbeggio';
          }
        }
      } catch {
        // fotogramma non leggibile: si riprova
      }
      timer = setTimeout(() => void ciclo(), 100);
    };

    document.body.append(dlg);
    dlg.showModal();
    video.srcObject = flusso;
    void video.play().catch(() => {});
    void ciclo();
  });
}
