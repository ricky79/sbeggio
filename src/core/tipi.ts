/** Tipi di evento registrabili con un orario. */
export type TipoEvento =
  | 'ENTRATA'
  | 'INIZIO_PAUSA'
  | 'FINE_PAUSA'
  | 'USCITA_PERMESSO'
  | 'RIENTRO_PERMESSO'
  | 'USCITA'
  | 'USCITA_ANTICIPATA';

export const TIPI_EVENTO: readonly TipoEvento[] = [
  'ENTRATA',
  'INIZIO_PAUSA',
  'FINE_PAUSA',
  'USCITA_PERMESSO',
  'RIENTRO_PERMESSO',
  'USCITA',
  'USCITA_ANTICIPATA',
];

export const ETICHETTE_EVENTO: Record<TipoEvento, string> = {
  ENTRATA: 'Entrata',
  INIZIO_PAUSA: 'Inizio pausa pranzo',
  FINE_PAUSA: 'Fine pausa pranzo',
  USCITA_PERMESSO: 'Uscita in permesso',
  RIENTRO_PERMESSO: 'Rientro da permesso',
  USCITA: 'Uscita',
  USCITA_ANTICIPATA: 'Uscita anticipata',
};

export interface Evento {
  id: string;
  tipo: TipoEvento;
  /** Minuti dalla mezzanotte, ora locale Europe/Rome (es. 510 = 08:30). */
  minuti: number;
  /**
   * Solo su RIENTRO_PERMESSO: minuti dell'intervallo di permesso che l'utente
   * ha confermato come pausa pranzo. Se assente si usa la proposta automatica.
   */
  pausaConfermata?: number;
  /** Solo su USCITA_PERMESSO: il permesso che apre è una pausa sigaretta. */
  sigaretta?: true;
}

export type Luogo = 'smart' | 'sede';

/** Posizione geografica in gradi decimali (WGS84). */
export interface Coordinate {
  lat: number;
  lon: number;
}

export interface Giornata {
  /** 'YYYY-MM-DD' nel fuso Europe/Rome. */
  data: string;
  /** Permesso a inizio giornata (ingresso posticipato), in minuti. */
  permessoInizioMinuti: number;
  /** Permesso in uscita pianificato, in minuti: anticipa l'uscita prevista. */
  permessoUscitaMinuti: number;
  /**
   * Dove si lavora: da casa (smart working) o in sede. Assente = non ancora scelto; si mostra
   * quello rilevato dalla posizione o, senza, la sede.
   */
  luogo?: Luogo;
  /** Giornata di ferie: le ore dovute sono coperte dalle ferie. Assente = giornata normale. */
  ferie?: true;
  /**
   * Giornata chiusa: l'orario (minuti) a cui si sarebbe dovuti uscire, salvato alla chiusura con le
   * impostazioni di allora. Assente se la giornata non è chiusa.
   */
  uscitaPrevista?: number;
  eventi: Evento[];
  /**
   * Pause sigaretta rientrate entro la tolleranza: non contano nelle ore, si mostrano solo
   * nel riepilogo del giorno. Assente se non ce ne sono.
   */
  sigaretteNonConteggiate?: SigarettaNonConteggiata[];
}

/** Pausa sigaretta cancellata al rientro perché entro la tolleranza. */
export interface SigarettaNonConteggiata {
  /** Ora dell'uscita, minuti dalla mezzanotte. */
  minuti: number;
  /** Durata in minuti (almeno 1). */
  durata: number;
}

/** Avvisi (notifiche) dell'app Android: quali ricevere e dopo quanto avvisare del rientro dal pranzo. */
export interface Avvisi {
  /** Avviso all'ora di uscita prevista. */
  uscita: boolean;
  /** Avviso di rientro dalla pausa sigaretta, `sigarettaAnticipo` minuti prima della fine della tolleranza. */
  sigaretta: boolean;
  /** Minuti di anticipo dell'avviso della sigaretta rispetto alla fine della tolleranza (0 = alla fine). */
  sigarettaAnticipo: number;
  /** Avviso di rientro dalla pausa pranzo. */
  pranzo: boolean;
  /** Durata della pausa pranzo dopo la quale avvisare (minuti). */
  pranzoMinuti: number;
}

/** Disegno della schermata della pausa sigaretta. */
export type TipoSigaretta = 'normale' | 'elettronica';

export interface Impostazioni {
  minutiDovuti: {
    predefinito: number;
    /** Indice 0 = domenica … 6 = sabato. null = usa il predefinito. */
    perGiorno: (number | null)[];
  };
  pranzo: { inizio: number; fine: number };
  /** Minuti di permesso da considerare pausa se il permesso copre la fascia pranzo. */
  pausaDaScalare: number;
  /** Le timbrature precedenti questo orario contano come questo orario. */
  orarioMinimoConteggio: number;
  /** Una pausa più breve di così conta come questa durata. */
  pausaMinima: number;
  /** Una pausa sigaretta che non supera questi minuti viene cancellata al rientro. */
  tolleranzaSigaretta: number;
  /** Disegno della schermata della pausa: sigaretta normale o elettronica. */
  tipoSigaretta: TipoSigaretta;
  avvisi: Avvisi;
  /** Posizione dell'ufficio, per proporre casa o sede all'apertura; null = non impostata. */
  ufficio: Coordinate | null;
}

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  minutiDovuti: { predefinito: 480, perGiorno: [0, null, null, null, null, null, 0] },
  pranzo: { inizio: 735, fine: 870 },
  pausaDaScalare: 30,
  orarioMinimoConteggio: 510,
  pausaMinima: 30,
  tolleranzaSigaretta: 11,
  tipoSigaretta: 'normale',
  ufficio: null,
  avvisi: { uscita: true, sigaretta: true, sigarettaAnticipo: 2, pranzo: true, pranzoMinuti: 30 },
};

export type StatoGiornata = 'NON_INIZIATA' | 'AL_LAVORO' | 'IN_PAUSA' | 'IN_PERMESSO' | 'CHIUSA';

/** Ripartizione pausa/permesso di un permesso che copre la fascia pranzo. */
export interface Ripartizione {
  /** Id dell'evento RIENTRO_PERMESSO (assente se il permesso è ancora in corso). */
  eventoRientroId?: string;
  da: number;
  a: number;
  /** Proposta automatica in minuti di pausa. */
  proposta: number;
  /** Minuti effettivamente considerati pausa. */
  pausa: number;
  /** Minuti effettivamente considerati permesso. */
  permesso: number;
  confermata: boolean;
}

/** Pausa sigaretta conclusa: permesso conteggiato a blocchi. */
export interface PermessoSigaretta {
  /** Id dell'evento RIENTRO_PERMESSO che l'ha chiusa. */
  eventoRientroId?: string;
  da: number;
  a: number;
  /** Durata reale in minuti. */
  durata: number;
  /** Permesso conteggiato (blocchi da 30 min). */
  permesso: number;
}

/** Permesso intermedio concluso (non sigaretta): parte di permesso reale e valore a blocchi. */
export interface PermessoABlocchi {
  /** Id dell'evento RIENTRO_PERMESSO che l'ha chiuso. */
  eventoRientroId?: string;
  da: number;
  a: number;
  /** Parte di permesso reale in minuti (esclusa l'eventuale quota di pausa pranzo). */
  durata: number;
  /** Permesso conteggiato (blocchi da 30 min). */
  permesso: number;
}

export interface RisultatoGiornata {
  stato: StatoGiornata;
  daCorreggere: boolean;
  problemi: string[];
  dovuti: number;
  lavorati: number;
  /** Pausa effettivamente conteggiata (registrata, con il minimo applicato, + scalata). */
  pausa: number;
  /** Minuti aggiunti alle pause concluse più brevi della pausa minima (inclusi in `pausa`). */
  pausaAggiuntaMinima: number;
  /**
   * Pausa minima scalata all'uscita perché obbligatoria e non registrata (inclusa in `pausa`);
   * 0 se non scalata.
   */
  pausaAutomatica: number;
  permessoInizio: number;
  /** Permesso a inizio giornata inserito; `permessoInizio` è il valore a blocchi. */
  permessoInizioDichiarato: number;
  permessoIntermedio: number;
  permessoUscita: number;
  permesso: number;
  /** Ore di ferie (minuti): in una giornata di ferie coprono le ore dovute. */
  ferie: number;
  coperti: number;
  saldo: number;
  /** Minuti dalla mezzanotte; null se non applicabile. */
  uscitaPrevista: number | null;
  /** True se l'uscita prevista include la pausa pranzo non ancora fatta. */
  uscitaPrevistaConPausa: boolean;
  /** True se l'uscita prevista è anticipata dal permesso in uscita pianificato. */
  uscitaPrevistaConPermesso: boolean;
  /** Minuti del permesso in uscita pianificato della giornata. */
  permessoUscitaPianificato: number;
  pausaFatta: boolean;
  ripartizioni: Ripartizione[];
  sigarette: PermessoSigaretta[];
  permessiIntermedi: PermessoABlocchi[];
}
