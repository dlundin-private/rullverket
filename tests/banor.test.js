// Kontrollerar alla banor: utan delar ska de misslyckas, med lösningen ska de lyckas,
// och lösningen får bara använda delar som finns i banans verktygslåda.
const fs = require('fs');
const path = require('path');
const { kor, Motor } = require('./kor.js');
const { svep } = require('./svep.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/banor.json'), 'utf8'));
let fel = 0;
for (const b of data.banor) {
  const utan = kor(b, []).status;
  const med = kor(b, b.losning);
  const antal = {};
  for (const d of b.losning) antal[d.typ] = (antal[d.typ] || 0) + 1;
  const forMånga = Object.entries(antal).filter(([t, n]) => (b.delar[t] || 0) < n);
  const iVagen = Motor.iVagen(b, b.losning);
  const ok = utan !== 'vann' && med.status === 'vann' && !forMånga.length && !iVagen.length;
  if (!ok) fel++;
  const tal = process.argv.includes('--svep') ? '  tålighet ' + svep(b, b.losning, 10, 5) : '';
  console.log(`${ok ? 'OK ' : 'FEL'} ${b.id.padEnd(14)} utan delar: ${utan.padEnd(5)} lösning: ${med.status} (${med.sek} s)${tal}`);
}
process.exit(fel ? 1 : 0);
