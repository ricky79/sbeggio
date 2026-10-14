// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { formattaDurata, formattaOra } from './tempo';
import type { Impostazioni } from './tipi';

/** Indirizzo a cui arrivano suggerimenti e segnalazioni. */
export const EMAIL_CONTATTO = 'supporto@sbeggio.app';

export type TipoSegnalazione = 'suggerimento' | 'problema';

export type Piattaforma = 'app Android' | 'app installata' | 'browser';

/** Dati tecnici raccolti al momento del tocco (vedi src/ui/aiuto.ts). */
export interface ContestoApp {
  versione: string;
  piattaforma: Piattaforma;
  dispositivo: string;
  schermo: string;
  tema: string;
  dataOra: string;
}

/** Lunedì → domenica, come nelle impostazioni. */
const GIORNI: [number, string][] = [
  [1, 'lun'],
  [2, 'mar'],
  [3, 'mer'],
  [4, 'gio'],
  [5, 'ven'],
  [6, 'sab'],
  [0, 'dom'],
];

const siNo = (v: boolean) => (v ? 'sì' : 'no');

/** Le impostazioni che servono a rifare i calcoli e a capire gli avvisi (nessun dato personale). */
function righeImpostazioni(imp: Impostazioni): string[] {
  const dovute = GIORNI.map(([g, nome]) => `${nome} ${formattaDurata(imp.minutiDovuti.perGiorno[g] ?? imp.minutiDovuti.predefinito)}`);
  const a = imp.avvisi;
  return [
    `Ore dovute: ${dovute.join(', ')}`,
    `Fascia pranzo: ${formattaOra(imp.pranzo.inizio)}–${formattaOra(imp.pranzo.fine)}`,
    `Pausa da scalare: ${formattaDurata(imp.pausaDaScalare)}`,
    `Pausa minima: ${formattaDurata(imp.pausaMinima)}`,
    `Inizio conteggio: ${formattaOra(imp.orarioMinimoConteggio)}`,
    `Pausa sigaretta: tolleranza ${formattaDurata(imp.tolleranzaSigaretta)}, ${imp.tipoSigaretta}`,
    `Avvisi: uscita ${siNo(a.uscita)}, sigaretta ${siNo(a.sigaretta)} (${formattaDurata(a.sigarettaAnticipo)} prima), pranzo ${siNo(a.pranzo)} (dopo ${formattaDurata(a.pranzoMinuti)})`,
  ];
}

/** Link `mailto:` con oggetto e testo già pronti; l'utente li rivede nell'app di posta prima di inviare. */
export function linkSegnalazione(tipo: TipoSegnalazione, c: ContestoApp, imp: Impostazioni): string {
  const versione = [`Versione: Sbeggio v${c.versione}`, `Piattaforma: ${c.piattaforma}`];
  const [oggetto, righe] =
    tipo === 'suggerimento'
      ? ['Sbeggio: suggerimento', ['Il tuo suggerimento:', '', '', '', '—', ...versione]]
      : [
          'Sbeggio: segnalazione di un problema',
          [
            'Cosa è successo:',
            '',
            '',
            'Cosa ti aspettavi:',
            '',
            '',
            'Come riprodurlo:',
            '',
            '',
            '— Dati tecnici (puoi cancellarli) —',
            ...versione,
            `Dispositivo: ${c.dispositivo}`,
            `Schermo: ${c.schermo}`,
            `Tema: ${c.tema}`,
            `Data e ora: ${c.dataOra}`,
            ...righeImpostazioni(imp),
          ],
        ];
  // RFC 6068: gli a capo nel testo sono CRLF.
  return `mailto:${EMAIL_CONTATTO}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(righe.join('\r\n'))}`;
}
