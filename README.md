# Rullverket

Ett fysikpussel för barn. Lägg ut plankor, ramper, fjädrar och vikter så att bollen hamnar i korgen. Färre delar ger fler stjärnor.

## Köra lokalt
```
npm install
npm run serve
```
Öppna http://localhost:8080. Spelet måste köras via en webbserver eftersom banorna läses från `banor.json`.

## Testa banorna
```
npm test            # alla banor: misslyckas utan delar, lyckas med lösningen
npm run test:svep   # visar också hur tåliga lösningarna är
```

## Installera på mobil eller surfplatta
Lägg upp mappen `public/` på valfri statisk webbhost, till exempel GitHub Pages. Öppna sidan och välj Lägg till på hemskärmen. Spelet fungerar sedan offline.

## Dela som en enda fil
`npm run bygg:enfil` skapar `dist/rullverket.html` med allt inbakat. Matter.js hämtas då från cdnjs.

Se `CLAUDE.md` för hur spelet är uppbyggt och hur man lägger till banor.
