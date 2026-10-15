// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Novità di ogni versione, per chi usa l'app: il foglio dopo un aggiornamento, Impostazioni → Novità, la pagina
 * web.sbeggio.app/novita e le note dei rilasci su GitHub nascono tutti da qui.
 *
 * A ogni cambio di versione in package.json si aggiunge una voce in cima (un test lo controlla).
 * Testo semplice, frasi brevi rivolte all'utente; niente dettagli tecnici. Nessun import: lo legge anche
 * scripts/rilascio.ts con Node.
 */
export interface Novita {
  /** x.y.z, come in package.json. */
  versione: string;
  /** Data del rilascio, 'YYYY-MM-DD'. */
  data: string;
  voci: string[];
}

export const NOVITA: readonly Novita[] = [
  {
    versione: '2.12.0',
    data: '2026-10-15',
    voci: [
      'Impostazioni rinnovate, come sull\'iPhone: un elenco con le icone colorate, ogni voce apre la sua pagina e una sola ricerca trova impostazioni e risposte dell\'Aiuto.',
      'L\'Aiuto e le Novità ora sono in Impostazioni: la barra in basso ha tre schede.',
      'I fogli che si aprono dal basso si chiudono con la ✕ in alto a destra o trascinandoli verso il basso.',
      'Nuova sezione "Dispositivi collegati": "+ Collega un dispositivo" per aprire Sbeggio sul computer.',
      'Timbra al volo: tieni premuta l\'icona di Sbeggio e scegli Timbra (Android), oppure crea un comando rapido su iPhone con l\'indirizzo sbeggio.app/?timbra. Trovi come in Aiuto.',
    ],
  },
  {
    versione: '2.11.0',
    data: '2026-10-14',
    voci: [
      'Esporta in Excel: un foglio per mese con entrata, pausa, uscita, permessi, uscita prevista e le ore del giorno, con i totali in fondo. Si apre in Excel in qualunque lingua, dall\'app e da web.sbeggio.app.',
      'Impostazioni e Aiuto sono divisi in sezioni che si aprono toccando il titolo.',
      'Nuova ricerca nelle impostazioni, come sull\'iPhone: scrivi, tocca il risultato e ti porta all\'impostazione. Anche la ricerca dell\'Aiuto ora mostra l\'elenco delle domande.',
    ],
  },
  {
    versione: '2.10.0',
    data: '2026-10-14',
    voci: [
      'Novità: dopo ogni aggiornamento Sbeggio ti mostra cosa è cambiato. La cronologia completa è in Aiuto → Novità e su web.sbeggio.app/novita.',
      'Sbeggio è software libero: il codice è pubblicato con licenza GPL 3.0 (o successive).',
    ],
  },
  {
    versione: '2.9.0',
    data: '2026-10-13',
    voci: ['Sbeggio sul computer: apri web.sbeggio.app, inquadra il codice QR con l\'app e scarica le timbrature in CSV o il backup.'],
  },
  {
    versione: '2.8.1',
    data: '2026-10-13',
    voci: ['Giornata di ferie: resta un solo pulsante, "Togli le ferie", invece di due che facevano la stessa cosa.'],
  },
  {
    versione: '2.8.0',
    data: '2026-10-12',
    voci: ['Chi scrive a supporto@sbeggio.app riceve subito una conferma che il messaggio è arrivato.'],
  },
  {
    versione: '2.7.0',
    data: '2026-10-12',
    voci: [
      'Storico: per ogni giorno l\'orario di uscita e quello a cui saresti dovuto uscire ("Uscita 17:55 · prevista 17:40").',
      '"Elimina la giornata" in fondo a ogni giorno salvato, con Annulla.',
      'Casa o ufficio scelto dalla posizione: se elimini tutte le timbrature se ne va anche lui.',
    ],
  },
  {
    versione: '2.6.0',
    data: '2026-10-10',
    voci: [
      'Ferie: segna un giorno libero dalla giornata, o una settimana intera (anche in anticipo) dallo Storico con "🏖️ Ferie".',
      'Pausa pranzo obbligatoria nelle giornate con almeno 6 ore dovute.',
    ],
  },
  {
    versione: '2.5.0',
    data: '2026-10-09',
    voci: ['Le pause sigaretta rientrate entro la tolleranza restano tra le timbrature come "non conteggiate": le vedi e le puoi correggere.'],
  },
  {
    versione: '2.4.0',
    data: '2026-10-09',
    voci: [
      'App Android: l\'esportazione dei dati ti chiede dove salvare il file.',
      'Riepilogo del giorno: la voce "Pausa pranzo" e le sigarette non conteggiate.',
      'Casa o ufficio: la posizione viene riletta finché non timbri l\'entrata.',
    ],
  },
  {
    versione: '2.3.0',
    data: '2026-10-08',
    voci: ['Nuova barra delle schede in basso, trasparente, con un\'animazione quando cambi schermata.'],
  },
  {
    versione: '2.2.0',
    data: '2026-10-08',
    voci: [
      'Nuovo logo.',
      'Casa o ufficio: in alto a destra segni se lavori da casa (🏠) o in sede (🏢); Sbeggio può proporlo dalla posizione. Lo Storico conta i giorni da casa del mese.',
      'Nuovi valori predefiniti: fascia pranzo dalle 12:15, avviso della sigaretta 2 minuti prima della fine.',
    ],
  },
  {
    versione: '2.0.1',
    data: '2026-10-07',
    voci: ['Nuovo indirizzo per suggerimenti e segnalazioni: supporto@sbeggio.app.'],
  },
  {
    versione: '2.0.0',
    data: '2026-10-07',
    voci: ['Krumiro diventa Sbeggio: nuovo nome e nuovo indirizzo, sbeggio.app.'],
  },
];

/** -1, 0, 1 confrontando due versioni x.y.z (una versione non valida conta come 0.0.0). */
export function confrontaVersioni(a: string, b: string): number {
  const parti = (v: string) => (/^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim()) ?? [0, 0, 0, 0]).slice(1).map(Number);
  const [x, y] = [parti(a), parti(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! < y[i]! ? -1 : 1;
  return 0;
}

/** Le novità uscite dopo `precedente` fino ad `attuale` compresa, dalla più recente. */
export function novitaDopo(precedente: string, attuale: string, elenco: readonly Novita[] = NOVITA): Novita[] {
  return elenco.filter((n) => confrontaVersioni(n.versione, precedente) > 0 && confrontaVersioni(n.versione, attuale) <= 0);
}

/** Note del rilascio su GitHub (Markdown) per una versione; null se non c'è la voce. */
export function noteRilascio(versione: string, elenco: readonly Novita[] = NOVITA): string | null {
  const n = elenco.find((x) => x.versione === versione);
  if (!n) return null;
  return ['## Novità', '', ...n.voci.map((v) => `- ${v}`), ''].join('\n');
}

/** "14 ottobre 2026". */
export function dataNovita(data: string): string {
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const [a, m, g] = data.split('-').map(Number);
  return `${g} ${MESI[(m ?? 1) - 1]} ${a}`;
}
