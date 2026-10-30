// Slumpsöker lösningar för en bana: node tests/autosok.js bana.json [antal] [maxDelar]
// Provar alla kombinationer av delar ur banans verktygslåda och visar hur ofta de lyckas.
const fs = require('fs');
const Motor = require('../public/motor.js');
const { kor } = require('./kor.js');
const { svep } = require('./svep.js');
const bana = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const N = +(process.argv[3] || 800), MAX = +(process.argv[4] || 2);
const omr = bana.sokomrade || { x1: 30, x2: 970, y1: 30, y2: 570 };
let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const vinklar = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
const typer = Object.entries(bana.delar).flatMap(([t, n]) => Array(n).fill(t));
const kombos = new Set();
(function val(start, akt) {
  if (akt.length) kombos.add(akt.join('+'));
  if (akt.length >= MAX) return;
  for (let i = start; i < typer.length; i++) val(i + 1, [...akt, typer[i]]);
})(0, []);
console.log('utan delar:', kor(bana, []).status);
for (const k of kombos) {
  const t = k.split('+');
  const hitt = [];
  for (let i = 0; i < N; i++) {
    const d = t.map((typ) => ({ typ, x: Math.round(omr.x1 + r() * (omr.x2 - omr.x1)), y: Math.round(omr.y1 + r() * (omr.y2 - omr.y1)),
      vinkel: typ === 'motor' ? 0 : vinklar[Math.floor(r() * vinklar.length)], ...(Motor.DELAR[typ].vandbar && r() < 0.5 ? { vand: true } : {}) }));
    if (Motor.iVagen(bana, d).length) continue;
    if (kor(bana, d).status === 'vann') hitt.push(d);
  }
  let bast = null, bp = -1;
  for (const h of hitt.slice(0, 6)) { const v = svep(bana, h, 10, 5); const p = +v.split('/')[0]; if (p > bp) { bp = p; bast = h; } }
  console.log(`${k.padEnd(28)} ${String(hitt.length).padStart(4)}/${N}` + (bast ? `  bäst ${bp}/27 ${JSON.stringify(bast)}` : ''));
}
