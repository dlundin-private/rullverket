# Rullverket

Ett fysikpussel för barn 6–13 år. Varje bana har en eller flera bollar och en korg. Spelaren placerar ett begränsat antal delar och trycker på Starta. Bollarna ska ligga stilla i korgen en halv sekund för att banan ska vara klarad.

## Principer (ändra inte utan att fråga)
- All text i spelet är på svenska. Kod, variabler och kommentarer får gärna vara svenska också.
- Inga annonser, inga köp, inget pay-to-win. Allt går att låsa upp genom att spela.
- Spelet är originellt. Nämn aldrig andra spel i kod, texter eller dokumentation, och efterlikna inte deras utseende.
- Allt ligger i git. Ingen Cloudflare och ingen backend. Spelet ska fungera helt offline.
- Touch och mus ska båda fungera. Testa alltid liggande mobil (cirka 844×390).

## Filer
- `public/index.html`, `style.css`: skal och utseende. Färger är CSS-variabler på `:root` med mörkt läge.
- `public/motor.js`: spelmotorn. Bygger en Matter.js-värld av en bana plus placerade delar. Ingen DOM här, så samma fil körs i Node-testerna.
- `public/spel.js`: gränssnittet: profiler, bankarta, dra-och-släpp, körning, ritning på canvas, sparning i localStorage (`rullverket-v1`).
- `public/banor.json`: alla banor. Det enda som behöver ändras för att lägga till en bana.
- `public/vendor/matter.min.js`: Matter.js 0.19.0, låst version. Uppgradera inte utan att köra testerna.
- `public/sw.js`: offline-cache. **Höj `VERSION` vid varje ändring**, annars visar installerade kopior den gamla versionen.
- `tests/`: kör banor i Node. `banor.test.js` kontrollerar alla banor, `prova.js` och `sok.js` hjälper till att designa nya.
- `verktyg/bygg-enfil.js`: bygger `dist/rullverket.html`, hela spelet i en fil för att dela som länk.

## Världen
- Koordinater 1000 × 600, y växer nedåt. Vinklar i grader, positiva vrider medurs.
- Fast tidssteg: 60 bildrutor per sekund med två fysiksteg per bildruta. Samma lösning ger därför alltid samma resultat, i webbläsaren och i testerna.
- Bollen är friktionsfri med flit. Med friktion fastnar Matter.js-bollar på svaga lutningar.
- Bollen räknas som ute om den lämnar världen, och som fast efter 20 sekunder.

## Banformat (`banor.json`)
```json
{
  "id": "bron",                     // unikt, används för sparade stjärnor
  "namn": "Bron",
  "tips": "En kort mening till barnet.",
  "delar": { "planka": 1 },         // verktygslådan
  "stjarnor": [1, 2],               // 3 stjärnor med högst 1 del, 2 med högst 2, annars 1
  "foremal": [ ... ],
  "losning": [ { "typ": "planka", "x": 300, "y": 280, "vinkel": 10 } ]
}
```
Föremål i `foremal` (x, y är mittpunkt om inget annat sägs):
- `vagg`: fast block. `b`, `h`, valfri `vinkel`.
- `boll`: startläge. Valfri `r` (standard 18). Flera bollar betyder att alla ska i korgen.
- `korg`: målet. `x` är mitten, `y` är korgens **botten**, `b` är innerbredd, `h` är vägghöjd.
- `lada`: rörlig låda. `b`, `h`, `"tung": true` gör den svår att knuffa.
- `gunga`: gungbräda med led i `x, y`. `b` är längd, `vinkel` är startvinkel. Behöver stöd under ändarna.
- `fjader`: fast fjäder som är en del av banan.

Delar i verktygslådan: `planka` (160), `kort` (90), `ramp` (kil 120 × 60), `fjader` (studsar bollen åt det håll den pekar), `vikt` (tung låda som faller).

## Lägga till en bana
1. Skriv banan i `banor.json` med en lösning i `losning`.
2. Kör `npm test`. Banan måste misslyckas utan delar och lyckas med lösningen.
3. Kör `npm run test:svep` för att se hur tålig lösningen är. Tidiga banor bör klara minst hälften av de små förskjutningarna, sena banor får vara knepigare.
4. `node tests/prova.js fil.json grid planka x1 x2 y1 y2 [vinklar]` visar hur stor del av ett område som fungerar.
5. Lärdom från de första banorna: gör målen generösa. En korg nedsänkt i marken med en vägg bakom fångar mycket fler bollar än en korg som står på marken.
6. Höj `VERSION` i `public/sw.js`.

## Lägga till en ny del
1. Lägg till måtten i `DELAR` i `motor.js` och skapa kroppen i `delKropp`.
2. Rita den i `ritaKropp` och ge den en ikon i `delIkon` i `spel.js`.
3. Lägg till den i en banas `delar` och skriv ett test.
