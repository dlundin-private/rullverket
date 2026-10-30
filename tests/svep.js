// Tålighetstest: flyttar lösningens delar lite och räknar hur ofta det fortfarande går.
const {kor}=require('./kor.js');
function svep(bana, losning, dx=20, dv=8) {
  let ok=0, n=0;
  for (const ox of [-dx,0,dx]) for (const oy of [-dx,0,dx]) for (const ov of [-dv,0,dv]) {
    const d = losning.map(p=>({...p,x:p.x+ox,y:p.y+oy,vinkel:(p.vinkel||0)+ov}));
    n++; if (kor(bana,d).status==='vann') ok++;
  }
  return `${ok}/${n}`;
}
module.exports={svep};
