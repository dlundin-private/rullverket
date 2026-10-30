// Kör en bana med en lösning i Node och skriver ut resultatet.
const Motor = require('../public/motor.js');
function kor(bana, delar, spar) {
  const s = Motor.bygg(bana, delar);
  let r, spar_ = [];
  do { r = s.steg(); if (spar && s.ruta % 15 === 0) spar_.push(s.bollar.map(b => `${b.position.x|0},${b.position.y|0}`).join(' ')); } while (r.status === 'kor');
  return { ...r, sek: (s.ruta/60).toFixed(1), spar: spar_ };
}
module.exports = { kor, Motor };
