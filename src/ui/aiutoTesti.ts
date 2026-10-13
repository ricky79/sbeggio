import { DURATA_PAUSA_PROPOSTA, OFFSET_PAUSA_PROPOSTA } from '../core/pausaPranzo';
import { RAGGIO_UFFICIO } from '../core/posizione';
import type { Azione } from '../core/statoGiornata';
import { formattaDurata, formattaOra } from '../core/tempo';
import type { Impostazioni } from '../core/tipi';
import { URL_APK } from './aggiornamento';

/**
 * Contenuti dell'aiuto. Testo semplice: ogni elemento di `testo` è un paragrafo;
 * le righe che iniziano con "• " diventano un elenco puntato e "[testo](url)" diventa un link.
 * Gli importi (fascia pranzo, pausa da scalare…) seguono le impostazioni correnti.
 */
export interface VoceAiuto {
  id: string;
  sezione: string;
  domanda: string;
  testo: string[];
  /** Azione dell'app a cui la voce si riferisce, per l'aiuto contestuale. */
  azione?: Azione;
}

export const SEZIONI_AIUTO = [
  'Primi passi',
  'I bottoni',
  'Come si calcola',
  'Correggere gli errori',
  'Storico e riepilogo',
  'Dati e backup',
  'Avvisi',
  'Installazione',
] as const;

export function vociAiuto(imp: Impostazioni): VoceAiuto[] {
  const pranzo = `${formattaOra(imp.pranzo.inizio)}–${formattaOra(imp.pranzo.fine)}`;
  const scalare = formattaDurata(imp.pausaDaScalare);
  const minimo = formattaOra(imp.orarioMinimoConteggio);
  const pausaMin = formattaDurata(imp.pausaMinima);
  const dovute = formattaDurata(imp.minutiDovuti.predefinito);
  const tolleranza = formattaDurata(imp.tolleranzaSigaretta);
  const pranzoAvviso = formattaDurata(imp.avvisi.pranzoMinuti);
  const inizioProposta = imp.pranzo.inizio + OFFSET_PAUSA_PROPOSTA;
  const pausaProposta = `${formattaOra(inizioProposta)}–${formattaOra(inizioProposta + DURATA_PAUSA_PROPOSTA)}`;
  const fineFascia = formattaOra(imp.pranzo.fine);
  const fineSigaretta =
    imp.tipoSigaretta === 'elettronica' ? 'il serbatoio si svuota, il LED lampeggia' : 'la sigaretta finisce nel posacenere';

  return [
    // --- Primi passi
    {
      id: 'come-funziona',
      sezione: 'Primi passi',
      domanda: 'Come funziona l\'app?',
      testo: [
        'Ogni volta che timbri al lavoro, tocca il bottone grande nella schermata Oggi: l\'app registra l\'orario attuale e ti propone già l\'azione successiva (Entrata → Inizio pausa pranzo → Fine pausa pranzo → Uscita).',
        'In alto vedi l\'ora di uscita prevista, le ore coperte rispetto a quelle dovute e il saldo della giornata.',
        'Sotto il bottone grande compaiono le azioni meno frequenti (permessi, uscita anticipata…), solo quando hanno senso in quel momento.',
      ],
    },
    {
      id: 'ore-coperte',
      sezione: 'Primi passi',
      domanda: 'Cosa sono le ore "coperte", "lavorate" e il "saldo"?',
      testo: [
        '• Lavorate: il tempo effettivamente passato al lavoro, escluse le pause.',
        '• Permesso: le ore di permesso (a inizio giornata, a metà giornata o per uscita anticipata).',
        '• Ogni permesso vale un multiplo di 30 min: un\'uscita anticipata con 1h23 mancanti conta 1h30; i minuti in più non contano come lavorate.',
        '• Coperte: lavorate + permesso. È il numero che deve arrivare alle ore dovute.',
        '• Saldo: coperte − dovute. Positivo = straordinario, negativo = ore mancanti.',
        'Mentre la giornata è in corso, al posto di un saldo negativo vedi "Mancano", cioè quanto ti resta da coprire.',
      ],
    },

    // --- I bottoni
    {
      id: 'entrata',
      sezione: 'I bottoni',
      azione: 'ENTRATA',
      domanda: 'Entrata',
      testo: ['Registra l\'inizio della giornata lavorativa all\'orario attuale.'],
    },
    {
      id: 'pausa',
      sezione: 'I bottoni',
      azione: 'INIZIO_PAUSA',
      domanda: 'Inizio pausa pranzo / Fine pausa pranzo',
      testo: [
        'Servono per la pausa pranzo, che non conta come ore coperte.',
        `Se la pausa dura meno di ${pausaMin}, viene comunque conteggiata come ${pausaMin}.`,
        'Con almeno 6 ore dovute nella giornata (quelle in Impostazioni, anche se prendi un permesso) la pausa pranzo è obbligatoria per legge e non si può saltare.',
        `Finché non hai fatto la pausa, l'uscita prevista include già ${pausaMin} di pausa, a qualunque ora (te lo segnala la scritta "inclusa pausa pranzo"). Non serve se esci entro la fine della fascia pranzo (${fineFascia}).`,
        `Se a fine fascia pranzo non hai registrato la pausa, in Oggi compare un riquadro che propone di aggiungerla (${pausaProposta}). Se esci senza averla registrata, il calcolo toglie comunque ${pausaMin} di pausa dalle ore lavorate e nel riepilogo leggi "non registrata".`,
        'Solo nelle giornate con meno di 6 ore dovute il riquadro offre anche "No, l\'ho saltata", che non te lo chiede più quel giorno.',
      ],
    },
    {
      id: 'fine-pausa',
      sezione: 'I bottoni',
      azione: 'FINE_PAUSA',
      domanda: 'Durante la pausa, cosa indica l\'uscita prevista?',
      testo: [`È l'orario di uscita se rientrassi adesso, tenendo conto che la pausa vale almeno ${pausaMin}.`],
    },
    {
      id: 'uscita',
      sezione: 'I bottoni',
      azione: 'USCITA',
      domanda: 'Uscita',
      testo: [
        'Chiude la giornata in modo normale. Se esci prima di aver coperto le ore dovute, il saldo sarà negativo: se invece vuoi coprire le ore mancanti con un permesso usa "Uscita anticipata".',
      ],
    },
    {
      id: 'permesso-vs-anticipata',
      sezione: 'I bottoni',
      azione: 'USCITA_PERMESSO',
      domanda: 'Differenza tra "Esco in permesso" e "Uscita anticipata"',
      testo: [
        'La differenza è se poi rientri al lavoro.',
        '• Esco in permesso: esci a metà giornata e poi torni (medico, commissione…). Il permesso va dall\'uscita al rientro e il bottone grande diventa "Rientro da permesso".',
        '• Uscita anticipata: esci e non torni più. Tutte le ore che mancano per arrivare alle dovute diventano permesso e il saldo è 0.',
        `Esempio con ${dovute} dovute: entrata 08:30, pausa 12:30–13:30, uscita anticipata 15:30 → lavorate 6h, permesso 2h, saldo 0.`,
        'Hai usato "Esco in permesso" ma poi non rientri? Tocca "Non rientro": l\'uscita in permesso diventa un\'uscita anticipata.',
      ],
    },
    {
      id: 'uscita-anticipata',
      sezione: 'I bottoni',
      azione: 'USCITA_ANTICIPATA',
      domanda: 'Uscita anticipata',
      testo: [
        'Chiude la giornata in permesso: le ore che mancano per arrivare alle dovute diventano ore di permesso, quindi il saldo è 0.',
        'Prima di registrarla l\'app ti mostra quante ore di permesso verranno conteggiate e chiede conferma.',
        'Se avevi già coperto tutte le ore, non viene conteggiato alcun permesso.',
      ],
    },
    {
      id: 'rientro',
      sezione: 'I bottoni',
      azione: 'RIENTRO_PERMESSO',
      domanda: 'Rientro da permesso e pausa pranzo',
      testo: [
        `Se il permesso si sovrappone alla fascia pranzo (${pranzo}) e quel giorno non hai registrato una pausa, una parte del permesso (fino a ${scalare}) viene considerata pausa pranzo e non permesso.`,
        'Al rientro l\'app ti mostra la ripartizione proposta, per esempio "1h pausa + 1h30 permesso", e puoi modificarla con − / + prima di confermare.',
        'Puoi cambiarla anche dopo, toccando il rientro nella timeline.',
      ],
    },
    {
      id: 'non-rientro',
      sezione: 'I bottoni',
      azione: 'NON_RIENTRO',
      domanda: 'Non rientro (chiudi in permesso)',
      testo: [
        'Compare mentre sei in permesso. Trasforma l\'ultima "Uscita in permesso" in "Uscita anticipata": la giornata si chiude e le ore mancanti diventano permesso.',
      ],
    },
    {
      id: 'pausa-sigaretta',
      sezione: 'I bottoni',
      azione: 'PAUSA_SIGARETTA',
      domanda: 'Pausa sigaretta',
      testo: [
        `Registra un'uscita in permesso e apre una schermata con il conto alla rovescia di ${tolleranza}: la sigaretta si consuma mentre il tempo passa. Quando torni tocca "Rientro".`,
        `Negli ultimi 30 secondi lo schermo lampeggia di rosso; oltre la tolleranza ${fineSigaretta} e lo sfondo resta rosso finché non rientri.`,
        `• Rientri entro ${tolleranza}: la pausa non conta nelle ore. Resta tra le timbrature come "🚬 Pausa sigaretta" con la durata e "non conteggiata": toccala per cambiarne orario e durata o per eliminarla. Puoi aggiungerne una a mano da "Aggiungi timbratura"; anche se è lunga non entra mai nel calcolo.`,
        '• Rientri dopo: la pausa diventa permesso a blocchi di 30 min (fino a 30 min → 30 min, fino a 1h → 1h, e così via).',
        'Le ore coperte e l\'uscita prevista non cambiano: il tempo del blocco oltre la pausa reale passa dalle ore lavorate al permesso.',
        'Esempio: pausa di 15 min → 30 min di permesso e 15 min in meno di lavorate; pausa di 42 min → 1h di permesso.',
        'Hai toccato il bottone per sbaglio? Usa "Annulla pausa" nella schermata. Se chiudi l\'app durante la pausa, alla riapertura il conto riprende da dove era.',
        'Tolleranza e tipo di sigaretta (normale o elettronica) si cambiano in Impostazioni → Pausa sigaretta.',
      ],
    },
    {
      id: 'entro-dopo',
      sezione: 'I bottoni',
      azione: 'PERMESSO_INIZIO_GIORNATA',
      domanda: 'Entro dopo (permesso a inizio giornata)',
      testo: [
        'Per gli ingressi posticipati: indichi quante ore di permesso prendi a inizio giornata (es. 2h). Non è un orario ma una durata, e conta come ore coperte.',
        'Puoi registrare l\'entrata insieme al permesso oppure aggiungere il permesso dopo, con "+ Permesso inizio giornata" sotto la timeline.',
        `Esempio con ${dovute} dovute: permesso 2h, entrata 10:30, pausa 12:30–13:30 → uscita prevista 17:30.`,
      ],
    },
    {
      id: 'permesso-uscita',
      sezione: 'I bottoni',
      domanda: 'Permesso in uscita (uscire prima)',
      testo: [
        'Se sai già che uscirai prima, tocca "+ Permesso in uscita" sotto la timeline e indica la durata (multipli di 30 min): l\'uscita prevista si anticipa di quel tempo.',
        'Quando esci usa il normale "Uscita": il permesso conteggiato è quello che manca davvero, a blocchi di 30 min.',
        'Esempio: uscita prevista 17:55 e 30 min di permesso in uscita → uscita prevista 17:25. Esci alle 17:25 → 30 min di permesso; alle 17:10 → 1h; dopo le 17:55 → nessun permesso.',
      ],
    },
    {
      id: 'riapri',
      sezione: 'I bottoni',
      azione: 'RIAPRI',
      domanda: 'Riapri giornata',
      testo: ['Elimina l\'ultima uscita (normale o anticipata) e riporta la giornata allo stato "Al lavoro". Utile se hai timbrato l\'uscita per sbaglio.'],
    },
    {
      id: 'ferie',
      sezione: 'I bottoni',
      domanda: 'Ferie: un giorno libero o una settimana intera',
      testo: [
        '• Un giorno solo: apri la giornata (Oggi, o un giorno dallo Storico) e, se non hai ancora timbrato, tocca "🏖️ In ferie questo giorno".',
        '• Più giorni, anche in anticipo: nello Storico tocca "🏖️ Ferie", scegli Dal e Al (propone la prossima settimana, da lunedì a venerdì) e tocca "Segna le ferie". I giorni senza ore dovute, come sabato e domenica, vengono saltati; quelli in cui hai già timbrato restano com\'erano.',
        'Un giorno di ferie copre le ore dovute: il saldo resta a zero e Oggi mostra 🏖️ al posto dei bottoni. Nello Storico il giorno ha "🏖️ Ferie" e il riepilogo del mese conta i giorni e le ore di ferie. Puoi andare avanti anche nei mesi futuri in cui hai segnato delle ferie.',
        'Per toglierle: "Togli le ferie" nella giornata, oppure lo stesso foglio dello Storico con "Togli le ferie" sulle date scelte. Se segni le ferie e poi timbri, la giornata risulta da correggere finché non togli le une o le altre.',
      ],
    },
    {
      id: 'smart',
      sezione: 'I bottoni',
      domanda: 'Casa o ufficio: segnare lo smart working',
      testo: [
        'In alto a destra, accanto alla data, ci sono due simboli: 🏠 vuol dire che quel giorno lavori da casa (smart working), 🏢 che lavori in sede. Se non tocchi nulla la giornata è in sede.',
        'Puoi cambiarlo quando vuoi, anche per un giorno passato: apri il giorno dallo Storico e tocca il simbolo giusto. Non cambia il calcolo delle ore.',
        `Se in Impostazioni → Sede di lavoro salvi la posizione dell'ufficio (mentre ci sei), quando apri l'app Sbeggio la legge e propone da solo: 🏢 entro ${RAGGIO_UFFICIO} m dall'ufficio, 🏠 altrove. Sotto i simboli compare "📍 dalla posizione". La proposta diventa definitiva alla prima timbratura; se tocchi tu un simbolo, la tua scelta vale e la posizione non la cambia più.`,
        'La posizione si legge solo con l\'app aperta, a ogni apertura finché non timbri o scegli tu (se apri l’app a casa e poi in ufficio, la proposta passa a 🏢), e resta sul telefono: non viene inviata a nessuno. La prima volta il telefono chiede il permesso; se lo neghi resta la sede e scegli a mano. Al chiuso la posizione può essere imprecisa: se non basta per decidere, Sbeggio lascia la proposta com’era.',
        'Nello Storico i giorni da casa hanno 🏠 Smart sotto la data e il riepilogo del mese conta quanti giorni hai lavorato da casa e quanti in sede.',
      ],
    },
    {
      id: 'tag-nfc',
      sezione: 'I bottoni',
      domanda: 'Timbrare con un tag NFC (app Android)',
      testo: [
        'Nell\'app per Android puoi timbrare avvicinando il telefono a un tag NFC di Sbeggio, per esempio quello vicino ai tornelli, anche ad app chiusa: Sbeggio si apre e registra l\'azione del bottone principale.',
        '• Giornata non iniziata: Entrata.',
        `• Al lavoro senza pausa: Inizio pausa pranzo. Dopo le ${fineFascia}, finita la fascia pranzo, ti chiede se è Inizio pausa pranzo o Uscita.`,
        '• In pausa: Fine pausa pranzo.',
        '• Al lavoro dopo la pausa: Uscita.',
        `• Pausa sigaretta in corso: Rientro, come con il tasto (entro ${tolleranza} la pausa non conta).`,
        '• In permesso: Rientro da permesso.',
        'Il telefono vibra e compare il solito messaggio, con il tasto Annulla per 5 secondi se il tag ha registrato la cosa sbagliata. Una seconda lettura entro un minuto viene ignorata. L\'inizio della pausa sigaretta e l\'uscita in permesso si fanno con i bottoni.',
        'Il telefono deve essere sbloccato e con l\'NFC attivo: lo vedi in Impostazioni → Tag NFC.',
      ],
    },
    {
      id: 'tag-nfc-preparare',
      sezione: 'I bottoni',
      domanda: 'Come preparo un tag NFC per Sbeggio?',
      testo: [
        'Serve un tag NFC qualsiasi (va bene un NTAG213, adesivo o portachiavi) e un\'app per scriverlo, per esempio NFC Tools:',
        '• in Scrivi aggiungi un record "URL / URI personalizzato" con il testo sbeggio://timbra e scrivilo sul tag;',
        '• prova che funzioni, poi, se il tag va in un posto pubblico come i tornelli, bloccalo in sola lettura (in NFC Tools: Altro → Blocca il tag), altrimenti chiunque può cancellarlo. Il blocco è definitivo.',
        'Lo stesso tag va bene per tutti i colleghi che hanno l\'app Sbeggio per Android; sugli altri telefoni non succede nulla.',
      ],
    },

    // --- Come si calcola
    {
      id: 'uscita-prevista',
      sezione: 'Come si calcola',
      domanda: 'Come viene calcolata l\'uscita prevista?',
      testo: [
        'Uscita prevista = adesso + (ore dovute − ore coperte).',
        `Se la pausa pranzo è obbligatoria (almeno 6 ore dovute), non l'hai ancora fatta e l'uscita cadrebbe dopo la fascia pranzo (${pranzo}), vengono aggiunti ${pausaMin} di pausa minima, a qualunque ora.`,
        'Quando l\'orario supera l\'uscita prevista compare "Ore completate alle…": da lì in poi è straordinario.',
        'Se hai inserito un permesso in uscita, l\'uscita prevista si anticipa di quella durata.',
      ],
    },
    {
      id: 'orario-minimo',
      sezione: 'Come si calcola',
      domanda: `Perché un'entrata prima delle ${minimo} non viene contata?`,
      testo: [
        `Ogni timbratura precedente le ${minimo} viene considerata come se fosse alle ${minimo}, in tutti i calcoli (uscita prevista, ore lavorate e saldo).`,
        `Esempio: entrata 08:00, pausa 12:00–13:00, uscita 18:00 → lavorate 8h30 (dalle ${minimo}), saldo +30 min.`,
        'L\'orario si cambia in Impostazioni → Conteggio.',
      ],
    },
    {
      id: 'pausa-minima',
      sezione: 'Come si calcola',
      domanda: `Perché una pausa breve conta ${pausaMin}?`,
      testo: [
        `Una pausa più breve di ${pausaMin} viene conteggiata come ${pausaMin}: la differenza viene tolta dalle ore lavorate.`,
        'Esempio: pausa 12:30–12:45 (15 min) → conta 30 min, quindi 15 min in meno di lavoro.',
        'Il valore si cambia in Impostazioni → Pausa pranzo.',
      ],
    },
    {
      id: 'ore-dovute',
      sezione: 'Come si calcola',
      domanda: 'Come imposto le ore dovute?',
      testo: [
        `In Impostazioni → Ore dovute: il valore predefinito (ora ${dovute}) vale per tutti i giorni con "predefinito" spuntato.`,
        'Per un giorno diverso (es. venerdì corto) togli la spunta e scegli le ore. 00:00 significa giorno libero: tutto ciò che lavori è straordinario.',
      ],
    },

    // --- Correggere gli errori
    {
      id: 'modifica',
      sezione: 'Correggere gli errori',
      domanda: 'Ho sbagliato o dimenticato una timbratura',
      testo: [
        'Tocca la timbratura nella timeline per cambiarne l\'orario o il tipo, oppure per eliminarla.',
        'Per una timbratura dimenticata usa "+ Aggiungi timbratura" e scegli tipo e orario. Le timbrature vengono sempre ordinate per orario.',
        'Per cancellare un giorno intero (timbrature, permessi, ferie, casa o ufficio) usa "Elimina la giornata" in fondo alla giornata: dopo c\'è Annulla per qualche secondo.',
      ],
    },
    {
      id: 'da-correggere',
      sezione: 'Correggere gli errori',
      domanda: 'Cosa significa "Giornata da correggere"?',
      testo: [
        'La sequenza delle timbrature non è coerente: per esempio una "Fine pausa pranzo" senza "Inizio pausa pranzo", due entrate, o una giornata passata senza uscita.',
        'L\'app spiega il problema nel riquadro arancione e calcola i totali ignorando le timbrature incoerenti (evidenziate in rosso). Aggiungi, modifica o elimina le timbrature finché il riquadro sparisce.',
      ],
    },
    {
      id: 'giorno-passato',
      sezione: 'Correggere gli errori',
      domanda: 'Come inserisco una giornata passata?',
      testo: ['In Storico tocca "+ Giornata dimenticata", scegli la data e aggiungi le timbrature con "+ Aggiungi timbratura".'],
    },

    // --- Storico
    {
      id: 'storico',
      sezione: 'Storico e riepilogo',
      domanda: 'Cosa mostra lo Storico?',
      testo: [
        'Per ogni giorno vedi tre voci: Lavoro, Straordinario e Permesso. Un trattino (–) significa zero.',
        '• Lavoro: le ore lavorate fino alle ore dovute, al netto del permesso.',
        '• Straordinario: il lavoro oltre le ore dovute, contato a blocchi da 30 minuti. 20 minuti in più non contano, 50 minuti valgono 30.',
        '• Permesso: le ore di permesso usate, sempre a blocchi da 30 minuti.',
        'Se in un giorno mancano ore, sotto compare "Mancano …". In alto il riepilogo del mese somma le tre voci; sotto trovi il saldo esatto, che non è arrotondato.',
        'La giornata di oggi non entra nel saldo del mese finché non è chiusa. Tocca un giorno per vederlo e correggerlo.',
        'Sotto ogni giorno chiuso trovi anche "Uscita 17:40 · prevista 17:25": l\'orario a cui sei uscito e quello a cui saresti dovuto uscire, cioè l\'uscita prevista che Oggi mostrava prima che timbrassi. Si salva alla chiusura con le impostazioni di quel giorno; per le giornate di prima, o importate da un backup che non lo ha, viene calcolato dalle timbrature. Per oggi, finché la giornata è in corso, vedi l\'uscita prevista del momento.',
      ],
    },
    {
      id: 'straordinario-blocchi',
      sezione: 'Storico e riepilogo',
      domanda: 'Perché 20 minuti di lavoro in più non compaiono?',
      testo: [
        'Lo straordinario viene contato solo a blocchi interi da 30 minuti, sempre per difetto: 20 minuti non contano, 50 minuti valgono 30, 1h10 vale 1h.',
        'Il saldo esatto del mese (sotto le tre voci) conserva invece tutti i minuti, senza arrotondare.',
      ],
    },

    // --- Dati
    {
      id: 'dove-dati',
      sezione: 'Dati e backup',
      domanda: 'Dove sono salvati i miei dati?',
      testo: [
        'Solo su questo telefono, nella memoria dell\'app: non vengono inviati a nessun server, salvo quando li mandi tu al computer con "Collega al computer" (cifrati da un capo all\'altro).',
        '• iPhone: se elimini l\'app dalla schermata Home, iOS cancella anche i dati.',
        '• Android: l\'app condivide i dati con Chrome, quindi se cancelli i dati del sito o disinstalli l\'app perdi le timbrature.',
        'In ogni caso, fai un backup ogni tanto.',
      ],
    },
    {
      id: 'backup',
      sezione: 'Dati e backup',
      domanda: 'Come faccio un backup o esporto in Excel?',
      testo: [
        '• Esporta CSV (Excel): una riga per giorno, separatore ";" e decimali con la virgola, si apre direttamente in Excel.',
        '• Esporta backup completo (JSON): tutte le timbrature e le impostazioni. Salvalo in File o iCloud Drive (iPhone), oppure in Drive o File (Android).',
        '• Importa: un backup JSON sostituisce tutti i dati; un CSV aggiunge le giornate (sovrascrivendo quelle con la stessa data) senza toccare le impostazioni.',
      ],
    },
    {
      id: 'computer',
      sezione: 'Dati e backup',
      domanda: 'Come scarico le timbrature sul computer?',
      testo: [
        'Sul computer apri web.sbeggio.app: compare un codice QR.',
        'Sul telefono vai in Impostazioni → Collega al computer, inquadra il codice e conferma con Invia.',
        'Dal computer scarichi il CSV (Excel) o il JSON di un mese a scelta o di tutte le timbrature.',
        '• Le timbrature viaggiano cifrate: il server che le passa al computer non può leggerle e non le conserva.',
        '• Il codice vale 5 minuti e una sola volta; chiudendo la pagina i dati spariscono dal computer.',
        '• Servono la connessione a internet e il permesso di usare la fotocamera.',
      ],
    },

    // --- Avvisi
    {
      id: 'avvisi',
      sezione: 'Avvisi',
      domanda: 'Come funzionano gli avvisi?',
      testo: [
        'Ricevi una notifica, anche ad app chiusa, in tre momenti:',
        '• Uscita prevista: quando puoi andare via. Si programma mentre sei al lavoro e si aggiorna se modifichi le timbrature.',
        `• Rientro dal pranzo: ${pranzoAvviso} dopo l'inizio della pausa. La durata si cambia in Impostazioni → Avvisi.`,
        imp.avvisi.sigarettaAnticipo > 0
          ? `• Pausa sigaretta: ${formattaDurata(imp.avvisi.sigarettaAnticipo)} prima della fine della tolleranza (${tolleranza}), per rientrare prima che diventi permesso. L'anticipo si cambia in Impostazioni → Avvisi.`
          : `• Pausa sigaretta: allo scadere della tolleranza (${tolleranza}). Puoi anticiparlo in Impostazioni → Avvisi.`,
        'Ogni avviso si può disattivare dalle Impostazioni. Nessun avviso se la giornata è chiusa, da correggere o se l\'orario è già passato. Per riceverli tocca "Autorizza gli avvisi" in Impostazioni → Avvisi.',
        'Nell\'app per Android gli avvisi sono programmati sul telefono: non serve connessione e nessun dato esce dal dispositivo.',
        'Nella PWA (Chrome, Safari, Firefox) l\'orario di ogni avviso va a un server che invia la notifica al momento giusto: quando timbri serve internet e l\'avviso può arrivare con un minuto di ritardo. Su iPhone funziona solo con l\'app aggiunta alla schermata Home (iOS 16.4 o successivi); sul computer le notifiche arrivano solo con il browser aperto. Al server arrivano solo l\'orario e il tipo di ogni avviso e l\'indirizzo per le notifiche del browser: niente timbrature né testi.',
      ],
    },
    {
      id: 'avvisi-non-arrivano',
      sezione: 'Avvisi',
      domanda: 'Gli avvisi non arrivano o arrivano in ritardo',
      testo: [
        '• Controlla in Impostazioni → Avvisi che le notifiche siano autorizzate; se serve tocca "Autorizza gli avvisi".',
        '• Se hai attivato "Non disturbare" o una modalità Focus, le notifiche vengono silenziate.',
        'Nell\'app per Android:',
        '• Su Android 12 e successivi concedi anche "Sveglie e promemoria" all\'app: senza, gli avvisi possono ritardare di qualche minuto.',
        '• Nelle impostazioni di Android (App → Sbeggio) togli le limitazioni della batteria: alcune marche (Xiaomi, Huawei, Samsung in risparmio energetico) bloccano le notifiche delle app chiuse.',
        'Nella PWA:',
        '• Quando timbri serve internet: se manca, l\'avviso viene programmato appena torni online con l\'app aperta.',
        '• Le notifiche del sito devono essere permesse: in Chrome da ⋮ → Impostazioni → Privacy e sicurezza → Impostazioni sito → Notifiche; su iPhone da Impostazioni → Notifiche → Sbeggio.',
        '• Su iPhone apri l\'app dall\'icona sulla schermata Home, non da Safari.',
        '• Sul computer il browser deve restare aperto (anche ridotto a icona).',
      ],
    },

    // --- Installazione
    {
      id: 'installazione',
      sezione: 'Installazione',
      domanda: 'Come installo l\'app sull\'iPhone?',
      testo: [
        '• Apri il sito con Safari (le altre app non permettono l\'installazione).',
        '• Tocca Condividi (il quadrato con la freccia in su).',
        '• Scegli "Aggiungi alla schermata Home" e conferma.',
        'Apri sempre l\'app dall\'icona: funziona anche offline e i dati dell\'icona sono separati da quelli di Safari.',
      ],
    },
    {
      id: 'installazione-android',
      sezione: 'Installazione',
      domanda: 'Come installo l\'app su Android?',
      testo: [
        '• Apri il sito con Chrome.',
        '• Tocca il menu ⋮ in alto a destra.',
        '• Scegli "Installa app" (su alcune versioni "Aggiungi a schermata Home", poi "Installa") e conferma.',
        'Apri l\'app dall\'icona: parte a tutto schermo e funziona anche offline.',
        'Con Samsung Internet usa il menu ☰ → "Aggiungi pagina a" → "Schermata Home"; con Firefox ⋮ → "Installa". Se la voce non compare, ricarica la pagina e riprova.',
      ],
    },
    {
      id: 'installazione-app',
      sezione: 'Installazione',
      domanda: 'C\'è un\'app per Android con gli avvisi?',
      testo: [
        `• Dal telefono [clicca qui](${URL_APK}): il browser scarica l'app (sbeggio.apk).`,
        '• Aprilo: Android chiede di consentire l\'installazione da questa fonte. Conferma e installa.',
        '• Alla prima apertura autorizza le notifiche (Impostazioni → Avvisi → Autorizza gli avvisi).',
        'Rispetto alla PWA, nell\'app gli avvisi funzionano anche senza internet e senza passare da un server.',
        'L\'app ha dati separati dalla PWA: per portarli con te esporta il backup JSON dalla PWA e importalo nell\'app.',
        'Quando esce una nuova versione l\'app te lo dice con un riquadro in basso: scaricala e installala sopra, i dati restano.',
      ],
    },
    {
      id: 'aggiornamenti',
      sezione: 'Installazione',
      domanda: 'Come si aggiorna?',
      testo: [
        'Nella PWA (dal sito o dall\'icona sulla schermata Home) si aggiorna da sola: quando c\'è una nuova versione viene scaricata in background e usata dall\'apertura successiva.',
        'Nell\'app per Android l\'aggiornamento va installato a mano:',
        '• Quando esce una nuova versione compare un riquadro in basso: tocca "Scarica".',
        '• Apri il file scaricato (sbeggio.apk) e tocca "Aggiorna" o "Installa".',
        `Se hai chiuso il riquadro, l'ultima versione si scarica sempre [da qui](${URL_APK}). La versione installata è scritta in fondo alle Impostazioni.`,
        'In tutti e due i casi i dati non vengono toccati.',
      ],
    },
  ];
}

/** Ricerca senza distinzione tra maiuscole/minuscole e accenti. */
/** Pezzo di una riga dell'aiuto: testo semplice o link. */
export type PezzoRiga = string | { testo: string; url: string };

/** Divide una riga nei suoi pezzi: ogni "[testo](url)" diventa un link. */
export function pezziRiga(riga: string): PezzoRiga[] {
  const pezzi: PezzoRiga[] = [];
  let da = 0;
  for (const m of riga.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (m.index > da) pezzi.push(riga.slice(da, m.index));
    pezzi.push({ testo: m[1]!, url: m[2]! });
    da = m.index + m[0].length;
  }
  if (da < riga.length) pezzi.push(riga.slice(da));
  return pezzi;
}

/** Il testo che si legge: dei link conta l'etichetta, non l'indirizzo. */
function testoVisibile(riga: string): string {
  return pezziRiga(riga)
    .map((p) => (typeof p === 'string' ? p : p.testo))
    .join('');
}

export function filtraAiuto(voci: VoceAiuto[], query: string): VoceAiuto[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const parole = norm(query).split(/\s+/).filter(Boolean);
  if (parole.length === 0) return voci;
  return voci.filter((v) => {
    const t = norm(`${v.domanda} ${v.sezione} ${v.testo.map(testoVisibile).join(' ')}`);
    return parole.every((p) => t.includes(p));
  });
}

/** Voce di aiuto per un'azione (per i link contestuali). */
export function aiutoPerAzione(voci: VoceAiuto[], azione: Azione): VoceAiuto | undefined {
  return voci.find((v) => v.azione === azione);
}
