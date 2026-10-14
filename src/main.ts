// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import './style.css';
import { adessoRoma } from './core/tempo';
import { richiediPersistenza, seguiAltreSchede, store } from './storage/store';
import { avviso } from './ui/dialoghi';
import { el, monta } from './ui/dom';
import { conTransizione, creaTabbar, SCHEDE, type Scheda } from './ui/tabbar';
import { impostaOrologio, vistaGiorno, type Adesso } from './ui/giorno';
import { riprendiPausaSigaretta } from './ui/sigaretta';
import { vistaImpostazioni } from './ui/impostazioni';
import { vistaStorico } from './ui/storico';
import { apriAiuto, EVENTO_APRI_AIUTO, vistaAiuto } from './ui/aiuto';
import { registraServiceWorker } from './pwa';
import { avviaTema } from './ui/tema';
import { avviaNovita } from './ui/novita';
import { avviaBannerInstallazione } from './ui/installa';
import { avviaControlloAggiornamenti } from './ui/aggiornamento';
import { avviaTagNfc } from './ui/tagNfc';
import { avviaProposteLuogo, rilevaLuogo } from './ui/posizione';
import { inApp } from './native/app';
import { avviaAvvisi as avviaAvvisiApp } from './native/avvisi';
import { avviaAvvisi as avviaAvvisiPwa } from './web/avvisi';

const stato: { scheda: Scheda; mese: string; giornoAperto: string | null; aiuto: string | null } = {
  scheda: 'oggi',
  aiuto: null,
  mese: adessoRoma().data.slice(0, 7),
  giornoAperto: null,
};

avviaTema();
impostaOrologio(() => adessoRoma());

const app = document.getElementById('app')!;
const contenuto = el('main', { class: 'contenuto' });
const tabbar = creaTabbar((s) => vai(s));
app.append(contenuto, tabbar.elemento);

let ultimoRender = '';

function render(forza = true): void {
  const adesso: Adesso = adessoRoma();
  // Evita di ridisegnare (e perdere lo scroll) se nulla è cambiato.
  const chiave = `${adesso.data} ${adesso.minuti}`;
  if (!forza && chiave === ultimoRender) return;
  // Aiuto e impostazioni non dipendono dall'orario: niente refresh periodico
  // (chiuderebbe le risposte aperte e toglierebbe il focus dai campi).
  if (!forza && (stato.scheda === 'aiuto' || stato.scheda === 'impostazioni')) return;
  if (!forza && document.querySelector('dialog[open]')) return; // non disturbare un dialogo aperto
  ultimoRender = chiave;

  const scroll = window.scrollY;
  let vista: HTMLElement;
  if (stato.scheda === 'oggi') vista = vistaGiorno(adesso.data, adesso, null);
  else if (stato.scheda === 'storico') {
    vista = stato.giornoAperto
      ? vistaGiorno(stato.giornoAperto, adesso, () => vai('storico'))
      : vistaStorico(stato.mese, adesso, (m) => {
          stato.mese = m;
          render();
        }, (data) => {
          if (data === adesso.data) return vai('oggi');
          conTransizione('avanti', () => {
            stato.giornoAperto = data;
            render();
            window.scrollTo(0, 0);
          });
        });
  } else if (stato.scheda === 'aiuto') {
    vista = vistaAiuto(stato.aiuto);
    stato.aiuto = null;
  } else vista = vistaImpostazioni(adesso);
  monta(contenuto, vista);
  window.scrollTo(0, scroll);
  // Pausa sigaretta in corso (app riaperta o tornata in primo piano): ripresenta la schermata.
  riprendiPausaSigaretta(adesso.data);

  tabbar.aggiorna(stato.scheda);
}

function vai(scheda: Scheda): void {
  // Verso una scheda più a destra si va "avanti"; tornare allo Storico da un giorno è "indietro".
  const da = SCHEDE.indexOf(stato.scheda);
  const a = SCHEDE.indexOf(scheda);
  const direzione = a > da ? 'avanti' : 'indietro';
  const cambia = () => {
    if (scheda !== stato.scheda || scheda === 'storico') stato.giornoAperto = null;
    stato.scheda = scheda;
    render();
    window.scrollTo(0, 0);
  };
  if (a === da && !(scheda === 'storico' && stato.giornoAperto)) cambia();
  else conTransizione(direzione, cambia);
}

store.ascolta(() => render());
seguiAltreSchede();
avviaProposteLuogo();
window.addEventListener(EVENTO_APRI_AIUTO, (e) => {
  stato.aiuto = (e as CustomEvent<string | undefined>).detail ?? null;
  vai('aiuto');
});
render();

// Casa o ufficio: all'apertura (e al ritorno in primo piano) la posizione propone il luogo di oggi.
const proponiLuogo = () => void rilevaLuogo(adessoRoma().data, () => render());
proponiLuogo();

// Aggiorna l'orario ogni 15 s e quando l'app torna in primo piano.
setInterval(() => render(false), 15_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  render(false);
  proponiLuogo();
});

void richiediPersistenza();
if (inApp()) {
  // App Android: niente service worker né invito a installare; le notifiche sono locali.
  avviaAvvisiApp();
  // L'APK non si aggiorna da solo: un banner propone la nuova versione pubblicata su GitHub.
  avviaControlloAggiornamenti(__VERSIONE_APP__);
  // Tag NFC (sbeggio://timbra): timbra come il pulsante principale. Dopo il primo render, così
  // l'evento trattenuto all'avvio a freddo trova la vista già montata.
  avviaTagNfc(() => vai('oggi'));
} else {
  registraServiceWorker();
  // PWA: gli avvisi passano dal backend e arrivano come notifiche push.
  avviaAvvisiPwa();
  avviaBannerInstallazione(() => apriAiuto('installazione'));
}
if (store.erroreCaricamento) void avviso('Attenzione', store.erroreCaricamento);
// Dopo un aggiornamento: una volta sola, cosa è cambiato.
avviaNovita(__VERSIONE_APP__);
