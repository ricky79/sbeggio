import { nuovoId } from '../core/id';
import { dataValida } from '../core/tempo';
import { aggiornaUscitaPrevista } from '../core/uscitaPrevista';
import {
  IMPOSTAZIONI_PREDEFINITE,
  TIPI_EVENTO,
  type Evento,
  type Giornata,
  type Impostazioni,
  type SigarettaNonConteggiata,
  type TipoEvento,
} from '../core/tipi';

export const VERSIONE_CORRENTE = 1;

export interface DatiSalvati {
  version: typeof VERSIONE_CORRENTE;
  impostazioni: Impostazioni;
  giornate: Record<string, Giornata>;
}

export function datiVuoti(): DatiSalvati {
  return { version: VERSIONE_CORRENTE, impostazioni: clonaImpostazioni(IMPOSTAZIONI_PREDEFINITE), giornate: {} };
}

export function clonaImpostazioni(i: Impostazioni): Impostazioni {
  return {
    ...i,
    minutiDovuti: { predefinito: i.minutiDovuti.predefinito, perGiorno: [...i.minutiDovuti.perGiorno] },
    pranzo: { ...i.pranzo },
    avvisi: { ...i.avvisi },
    ufficio: i.ufficio ? { ...i.ufficio } : null,
  };
}

export class ErroreMigrazione extends Error {}

type Grezzo = Record<string, unknown>;
const isObj = (v: unknown): v is Grezzo => typeof v === 'object' && v !== null && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

/**
 * Porta dati grezzi (localStorage o backup JSON) allo schema corrente.
 * Ogni passo `vN → vN+1` va aggiunto a MIGRAZIONI.
 */
const MIGRAZIONI: Record<number, (d: Grezzo) => Grezzo> = {
  // v0 = dati senza campo version (prototipi / import manuali): stessa forma di v1.
  0: (d) => ({ ...d, version: 1 }),
};

export function migra(grezzo: unknown): DatiSalvati {
  if (!isObj(grezzo)) throw new ErroreMigrazione('Formato dati non riconosciuto.');
  let d: Grezzo = grezzo;
  let v = typeof d.version === 'number' ? d.version : 0;
  if (v > VERSIONE_CORRENTE) {
    throw new ErroreMigrazione(`I dati provengono da una versione più recente dell'app (v${v}).`);
  }
  while (v < VERSIONE_CORRENTE) {
    const passo = MIGRAZIONI[v];
    if (!passo) throw new ErroreMigrazione(`Migrazione da v${v} non disponibile.`);
    d = passo(d);
    v++;
  }
  return normalizza(d);
}

/** Valida e ripulisce dati in forma v1, sostituendo i valori mancanti con i predefiniti. */
function normalizza(d: Grezzo): DatiSalvati {
  const out = datiVuoti();
  out.impostazioni = normalizzaImpostazioni(d.impostazioni);
  if (isObj(d.giornate)) {
    for (const [chiave, g] of Object.entries(d.giornate)) {
      const giornata = normalizzaGiornata(g, chiave);
      if (!giornata) continue;
      // Giornate salvate prima che esistesse il dato (o backup che non lo hanno): si calcola con le
      // impostazioni del file.
      if (giornata.uscitaPrevista === undefined) aggiornaUscitaPrevista(giornata, out.impostazioni);
      out.giornate[giornata.data] = giornata;
    }
  }
  return out;
}

export function normalizzaImpostazioni(v: unknown): Impostazioni {
  const p = IMPOSTAZIONI_PREDEFINITE;
  const imp = clonaImpostazioni(p);
  if (!isObj(v)) return imp;
  if (isObj(v.minutiDovuti)) {
    imp.minutiDovuti.predefinito = intIn(v.minutiDovuti.predefinito, 0, 1440) ?? p.minutiDovuti.predefinito;
    if (Array.isArray(v.minutiDovuti.perGiorno) && v.minutiDovuti.perGiorno.length === 7) {
      imp.minutiDovuti.perGiorno = v.minutiDovuti.perGiorno.map((x) => (x === null ? null : intIn(x, 0, 1440) ?? null));
    }
  }
  if (isObj(v.pranzo)) {
    const inizio = intIn(v.pranzo.inizio, 0, 1439);
    const fine = intIn(v.pranzo.fine, 0, 1440);
    if (inizio !== undefined && fine !== undefined && fine > inizio) imp.pranzo = { inizio, fine };
  }
  imp.pausaDaScalare = intIn(v.pausaDaScalare, 0, 600) ?? p.pausaDaScalare;
  imp.orarioMinimoConteggio = intIn(v.orarioMinimoConteggio, 0, 1439) ?? p.orarioMinimoConteggio;
  imp.pausaMinima = intIn(v.pausaMinima, 0, 600) ?? p.pausaMinima;
  imp.tolleranzaSigaretta = intIn(v.tolleranzaSigaretta, 0, 60) ?? p.tolleranzaSigaretta;
  const tipo = v.tipoSigaretta;
  imp.tipoSigaretta = tipo === 'normale' || tipo === 'elettronica' ? tipo : p.tipoSigaretta;
  if (isObj(v.avvisi)) {
    const a = v.avvisi;
    imp.avvisi = {
      uscita: typeof a.uscita === 'boolean' ? a.uscita : p.avvisi.uscita,
      sigaretta: typeof a.sigaretta === 'boolean' ? a.sigaretta : p.avvisi.sigaretta,
      sigarettaAnticipo: intIn(a.sigarettaAnticipo, 0, 30) ?? p.avvisi.sigarettaAnticipo,
      pranzo: typeof a.pranzo === 'boolean' ? a.pranzo : p.avvisi.pranzo,
      pranzoMinuti: intIn(a.pranzoMinuti, 1, 240) ?? p.avvisi.pranzoMinuti,
    };
  }
  if (isObj(v.ufficio)) {
    const { lat, lon } = v.ufficio;
    if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      imp.ufficio = { lat, lon };
    }
  }
  return imp;
}

function normalizzaGiornata(g: unknown, chiave: string): Giornata | null {
  if (!isObj(g)) return null;
  const data = typeof g.data === 'string' ? g.data : chiave;
  if (!dataValida(data)) return null;
  const eventi: Evento[] = [];
  if (Array.isArray(g.eventi)) {
    for (const e of g.eventi) {
      if (!isObj(e)) continue;
      const tipo = e.tipo as TipoEvento;
      const minuti = intIn(e.minuti, 0, 1439);
      if (!TIPI_EVENTO.includes(tipo) || minuti === undefined) continue;
      const ev: Evento = { id: typeof e.id === 'string' && e.id ? e.id : nuovoId(), tipo, minuti };
      const pc = intIn(e.pausaConfermata, 0, 1440);
      if (tipo === 'RIENTRO_PERMESSO' && pc !== undefined) ev.pausaConfermata = pc;
      if (tipo === 'USCITA_PERMESSO' && e.sigaretta === true) ev.sigaretta = true;
      eventi.push(ev);
    }
  }
  const giornata: Giornata = {
    data,
    permessoInizioMinuti: intIn(g.permessoInizioMinuti, 0, 1440) ?? 0,
    permessoUscitaMinuti: intIn(g.permessoUscitaMinuti, 0, 1440) ?? 0,
    eventi,
  };
  if (g.luogo === 'smart' || g.luogo === 'sede') giornata.luogo = g.luogo;
  if (g.ferie === true) giornata.ferie = true;
  const uscita = intIn(g.uscitaPrevista, 0, 2879);
  if (uscita !== undefined) giornata.uscitaPrevista = uscita;
  const sigarette: SigarettaNonConteggiata[] = [];
  if (Array.isArray(g.sigaretteNonConteggiate)) {
    for (const s of g.sigaretteNonConteggiate) {
      if (!isObj(s)) continue;
      const minuti = intIn(s.minuti, 0, 1439);
      const durata = intIn(s.durata, 1, 1440);
      if (minuti !== undefined && durata !== undefined) sigarette.push({ minuti, durata });
    }
  }
  if (sigarette.length > 0) giornata.sigaretteNonConteggiate = sigarette;
  return giornata;
}
