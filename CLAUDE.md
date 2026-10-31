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
- `public/spel.js`: gränssnittet: profiler, bankarta, dra-och-släpp, körning, ritning på canvas, sparning i localStorage (`rullverket-v1`). När spelet körs som publicerad länk i claude.ai sparas samma data också i artefaktens databas under `data/users/<id>/rullverket` (fältet `json`), eftersom Claude-appen inte alltid behåller localStorage. Den nyaste versionen vinner (fältet `andrad`). Utan `window.claude` används bara localStorage.
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
- `band`: fast transportband. `b` är längd, valfri `vinkel`, `"vand": true` kör åt vänster (standard är åt höger längs bandet).
- `motor`: fast motorhjul (radie 45). `"vand": true` snurrar moturs (standard medurs).
- `snurra`: väderkvarn med armar som slår. `langd`, `armar` (2 eller 4), `fart` (radianer per bildruta), `vinkel`, `vand`. Den är kaotisk: utfallet beror på var armarna står när bollen kommer.
- `hiss`: plattform som åker fram och tillbaka mellan `y` och `y + dy` på `tid` sekunder. `"vantar": "id"` gör att den står still tills en knapp med samma id trycks.
- `knapp`: `y` är knappens underkant. `"oppnar": "id"` öppnar luckor och startar hissar med det id:t första gången något rörligt nuddar knappen.
- `lucka`: fast block med `id` som försvinner när knappen trycks. `b`, `h`, valfri `vinkel`.

Delar i verktygslådan: `planka` (160), `kort` (90), `ramp` (kil 120 × 60), `fjader` (studsar bollen åt det håll den pekar), `vikt` (tung låda som faller), `band` (transportband 160, vändbart med ⇄), `motor` (motorhjul som kastar, vändbart med ⇄). En placerad del kan ha `"vand": true`.

Om band och motorhjul: de drar bollens fart mot ytans fart vid kontakt (se `band()` i `motor.js`). Hjulet är en fast cirkel som bara snurrar för syns skull. En snurra med armar som kroppar blev för slumpartad som del, därför finns den bara som banföremål.

## Lägga till en bana
1. Skriv banan i `banor.json` med en lösning i `losning`.
2. Kör `npm test`. Banan måste misslyckas utan delar och lyckas med lösningen.
3. Kör `npm run test:svep` för att se hur tålig lösningen är. Tidiga banor bör klara minst hälften av de små förskjutningarna, sena banor får vara knepigare.
4. `node tests/autosok.js fil.json [antal] [maxDelar]` slumpsöker lösningar för alla kombinationer av banans delar och visar hur ofta de lyckas. Banfilen behöver `delar` och `foremal`.
5. `node tests/prova.js fil.json grid planka x1 x2 y1 y2 [vinklar]` visar hur stor del av ett område som fungerar.
6. Lärdom från de första banorna: gör målen generösa. En korg nedsänkt i marken med en vägg bakom fångar mycket fler bollar än en korg som står på marken.
7. Höj `VERSION` i `public/sw.js`.

## Lägga till en ny del
1. Lägg till måtten i `DELAR` i `motor.js` och skapa kroppen i `delKropp`.
2. Rita den i `ritaKropp` och ge den en ikon i `delIkon` i `spel.js`.
3. Om den har en riktning: sätt `vandbar: true` i `DELAR`, så visas ⇄ i verktygsraden.
4. Lägg till den i en banas `delar` och skriv ett test.

## Teman
Spelaren väljer tema på bankartan: Verkstad (standard), Djungel, Öken eller Lekplats. Valet sparas per spelare (`tema` i profilen) och gäller alla banor. Teman ändrar bara utseendet, aldrig fysiken.
- Färgerna är CSS-variabler under `:root[data-tema="..."]` i `style.css`, med nattvarianter för mörkt läge. `--himmel` och `--papper` är bakgrundens övre och nedre färg, `--dekor-1..3` är kulissernas färger och `--sten-2` är väggarnas detaljfärg (mossa eller sandränder).
- I `spel.js` ritar `ritaKulisser()` bakgrunden, `ritaVagg()` väggarnas material och `ritaBoll()` bollen för varje tema. Lekplatsens väggar får färg efter `rv.nr`, väggens ordning i banan, så att färgen är densamma före och under körning.
- Kulisserna ska vara svaga (låg opacitet) så att banans delar alltid syns tydligt.
- Nytt tema: lägg till ett block i `style.css`, en rad i `TEMAN` i `spel.js` och vid behov en gren i de tre ritfunktionerna.

## Publicering
GitHub Actions (`.github/workflows/pages.yml`) kör `npm test` vid varje push till `main` och publicerar sedan mappen `public/` på GitHub Pages. Misslyckas en bana publiceras ingenting. Adressen är https://rullverket.chandler.se (filen `public/CNAME`, DNS-posten pekar på `dlundin-private.github.io`). I repots inställningar ska Pages ha källan "GitHub Actions".

Sparningen i `localStorage` hör ihop med domänen. Byt inte domän, då börjar alla spelare om från noll.
