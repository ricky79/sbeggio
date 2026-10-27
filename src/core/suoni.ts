// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Festa } from './festa';

/**
 * Suoni dell'app: quale file riprodurre per ogni momento, e il "solo al primo passaggio"
 * dell'apertura. Logica pura: i file stanno in public/suoni/, qui se ne sceglie solo il nome.
 */
export type MomentoSuono = 'timbratura' | 'finePausa' | 'passaggio';

/** `null` = nessun suono. Un file a tema messo a `null` ricade su quello di tutto l'anno. */
const SUONI: Record<Festa | 'sempre', Record<MomentoSuono, string | null>> = {
  sempre: { timbratura: 'ding.mp3', finePausa: 'ding-doppio.mp3', passaggio: null },
  natale: {
    timbratura: 'natale-campanellino.mp3',
    finePausa: 'natale-ohoh.mp3',
    passaggio: 'natale-campanelle.mp3',
  },
  halloween: {
    timbratura: 'halloween-campana.mp3',
    finePausa: 'halloween-ululato.mp3',
    passaggio: 'halloween-risata.mp3',
  },
};

/** Il file in public/suoni/ per quel momento nella festa data (null = fuori festa), o null se niente suono. */
export function fileSuono(momento: MomentoSuono, festa: Festa | null): string | null {
  const aTema = festa === null ? null : SUONI[festa][momento];
  return aTema ?? SUONI.sempre[momento];
}

/**
 * Il suono di passaggio parte una volta sola per apertura. Se il browser lo blocca (`suona` dà
 * `false` o la promessa è rifiutata) si riprova al passaggio dopo; mentre il primo tentativo è in
 * corso gli altri passaggi non fanno nulla. `allaRiapertura` riparte da capo.
 */
export function creaPassaggio(suona: () => Promise<boolean>): {
  alPassaggio(): void;
  allaRiapertura(): void;
} {
  let stato: 'da-suonare' | 'in-corso' | 'suonato' = 'da-suonare';
  return {
    alPassaggio() {
      if (stato !== 'da-suonare') return;
      stato = 'in-corso';
      suona().then(
        (riuscito) => {
          stato = riuscito ? 'suonato' : 'da-suonare';
        },
        () => {
          stato = 'da-suonare';
        },
      );
    },
    allaRiapertura() {
      stato = 'da-suonare';
    },
  };
}
