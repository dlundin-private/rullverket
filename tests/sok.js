// Slumpsöker lösningar för en bana med en given uppsättning delar.
const {kor}=require('./kor.js');
const {svep}=require('./svep.js');
const Motor=require('../public/motor.js');
function sok(bana, typer, n=400, omrade={x1:40,x2:960,y1:40,y2:580}, seed=1) {
  let s=seed; const r=()=>{s=(s*16807)%2147483647;return s/2147483647;};
  const vinklar=[-60,-45,-30,-15,0,15,30,45,60];
  const hitt=[];
  for (let i=0;i<n;i++){
    const d=typer.map(t=>({typ:t,x:Math.round(omrade.x1+r()*(omrade.x2-omrade.x1)),y:Math.round(omrade.y1+r()*(omrade.y2-omrade.y1)),vinkel:vinklar[Math.floor(r()*vinklar.length)]}));
    if (Motor.iVagen(bana,d).length) continue;
    if (kor(bana,d).status==='vann') hitt.push(d);
  }
  return hitt;
}
module.exports={sok,svep,kor};
