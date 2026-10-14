// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

export const FUSO = 'Europe/Rome';
export const MINUTI_GIORNO = 24 * 60;

/** "08:30" → 510. Restituisce null se il formato non è valido. */
export function parseOra(testo: string): number | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(testo);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 → "08:30". Valori fuori giornata vengono riportati nelle 24h. */
export function formattaOra(minuti: number): string {
  const v = ((Math.round(minuti) % MINUTI_GIORNO) + MINUTI_GIORNO) % MINUTI_GIORNO;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** 90 → "1h30", 60 → "1h", 45 → "45 min", 0 → "0 min". */
export function formattaDurata(minuti: number): string {
  const v = Math.abs(Math.round(minuti));
  const h = Math.floor(v / 60);
  const m = v % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** Saldo con segno: +1h, −30 min, 0 min. */
export function formattaSaldo(minuti: number): string {
  const r = Math.round(minuti);
  if (r === 0) return '0 min';
  return `${r > 0 ? '+' : '−'}${formattaDurata(r)}`;
}

/** Minuti → ore decimali con virgola, per Excel in italiano: 450 → "7,50". */
export function oreDecimali(minuti: number): string {
  return (minuti / 60).toFixed(2).replace('.', ',');
}

/** "H:MM" o "HhMM" o minuti → minuti; usato nei campi durata. */
export function parseDurata(testo: string): number | null {
  const t = testo.trim().toLowerCase();
  if (t === '') return null;
  let m = /^(\d{1,2})\s*[:h.]\s*(\d{1,2})?$/.exec(t);
  if (m) {
    const min = m[2] ? Number(m[2]) : 0;
    if (min > 59) return null;
    return Number(m[1]) * 60 + min;
  }
  m = /^(\d{1,4})\s*(min|m)?$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

const fmtRoma = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Data ('YYYY-MM-DD') e minuti correnti nel fuso Europe/Rome. */
export function adessoRoma(istante: Date = new Date()): { data: string; minuti: number } {
  const parti: Record<string, string> = {};
  for (const p of fmtRoma.formatToParts(istante)) parti[p.type] = p.value;
  const ore = Number(parti.hour) % 24;
  return {
    data: `${parti.year}-${parti.month}-${parti.day}`,
    minuti: ore * 60 + Number(parti.minute),
  };
}

/** Giorno della settimana di una data 'YYYY-MM-DD': 0 = domenica. */
export function giornoSettimana(data: string): number {
  const [y, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export const NOMI_GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
export const NOMI_MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** "2026-10-01" → "Giovedì 1 ottobre 2026". */
export function formattaDataLunga(data: string): string {
  const [y, m, d] = data.split('-').map(Number);
  return `${NOMI_GIORNI[giornoSettimana(data)]} ${d} ${NOMI_MESI[m! - 1]} ${y}`;
}

/** "2026-10-01" → "gio 1". */
export function formattaDataBreve(data: string): string {
  const d = Number(data.slice(8, 10));
  return `${NOMI_GIORNI[giornoSettimana(data)]!.slice(0, 3).toLowerCase()} ${d}`;
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [y, m, d] = data.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

/** Somma giorni a una data 'YYYY-MM-DD'. */
export function spostaData(data: string, giorni: number): string {
  const [y, m, d] = data.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + giorni));
  return dt.toISOString().slice(0, 10);
}

/** Somma mesi a 'YYYY-MM'. */
export function spostaMese(mese: string, delta: number): string {
  const [y, m] = mese.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return dt.toISOString().slice(0, 7);
}

export function nomeMese(mese: string): string {
  const [y, m] = mese.split('-').map(Number);
  return `${NOMI_MESI[m! - 1]} ${y}`;
}
