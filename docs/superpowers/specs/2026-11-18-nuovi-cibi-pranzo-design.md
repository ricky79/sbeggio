# Nuovi cibi della pausa pranzo — design

## Perché

La schermata della pausa pranzo mostra a caso uno di quattro cibi (ramen, pizza, panino, mela) che si consuma
fino alla pausa minima. Riccardo vuole più varietà: spaghetti, gelato, insalata e sushi.

## Obiettivi

- Quattro cibi nuovi in `src/ui/pranzoDisegni.ts`, stesso stile (viewBox 300 × 180, cibo attorno a x = 118,
  `cibo-porzione` nascosta e `cibo-resti` mostrati con `.pranzo.finito`), ognuno col suo modo di consumarsi.
- `CIBI` in `src/core/pranzo.ts` passa a otto: la scelta resta a caso per pausa e stabile nella stessa pausa.

## Non obiettivi

- Nessun cambio a cronometro, pausa minima, riepilogo, cibi esistenti.

## Approcci considerati

Un solo modo sensato: seguire lo schema dei cibi attuali (SVG statico + `aggiorna(mangiato)` guidato da
funzioni pure testate). Disegni da file esterni o immagini non c'entrano con il resto del codice.

## I cibi (decisi con Riccardo)

- **Spaghetti al pomodoro**: nido di spaghetti con sugo e basilico nel piatto, forchetta che arrotola
  (animata come le bacchette). Il nido si rimpicciolisce. Resti: macchia di sugo e un paio di spaghetti.
  Gli spaghetti c'erano già e furono sostituiti dal ramen il 2026-10-16 (motivo non annotato): tornano
  accanto al ramen.
- **Gelato**: coppetta con tre palline (fragola, pistacchio, cioccolato) e cucchiaino. **Si mangia una
  cucchiata alla volta: ogni cucchiata toglie un arco dal bordo del cerchio della pallina** (un cerchio
  nero in una maschera, come i morsi della mela), si comincia dalla pallina in cima; all'ultima cucchiata
  la pallina sparisce e si passa alla successiva. Resti: gelato sciolto sul fondo della coppetta.
- **Insalata**: ciotola con foglie, pomodorini, carote, mais; gli ingredienti spariscono uno alla volta, le
  foglie per ultime. Resti: gocce d'olio e una foglia.
- **Sushi**: tagliere con sei pezzi (maki e nigiri al salmone), ciotolina di soia, bacchette; i pezzi
  spariscono uno alla volta da sinistra. Resti: soia, wasabi, qualche chicco di riso.

## Come (decisioni)

- Funzioni pure esportate e testate in `tests/pranzo.test.ts`, come quelle esistenti: quanto è grande il
  nido, quante cucchiate di gelato sono state prese, quali ingredienti dell'insalata restano, quanti pezzi
  di sushi restano. Agli estremi: tutto intero a 0, niente a 1.
- Classi CSS di animazione e di "finito" in `src/style.css` accanto a quelle esistenti.
- Una pausa in corso durante l'aggiornamento dell'app può cambiare piatto (cambia il numero di cibi):
  accettato.
- Novità: una voce nella 2.16.0 (non rilasciata).
- Verifica: screenshot di ogni cibo a 0, 0,5 e fine pausa, 390 px, tema chiaro e scuro (la schermata pranzo
  è sempre scura: verificare comunque i due temi).

## Lasciato a chi costruisce

Forme, colori e numero esatto di cucchiate per pallina e di ingredienti, purché leggibili a 390 px e
coerenti con i disegni esistenti.
