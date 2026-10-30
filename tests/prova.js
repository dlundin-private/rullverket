// node tests/prova.js bana.json '[delar]'  eller  node tests/prova.js bana.json grid typ x1 x2 y1 y2 [vinklar]
const fs=require('fs');const {kor}=require('./kor.js');
const bana=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const extra=bana.losningBas||[];
if(process.argv[3]==='grid'){
  let [typ,x1,x2,y1,y2]=[process.argv[4],...process.argv.slice(5,9).map(Number)];
  const vand=typ.endsWith('!'); typ=typ.replace('!','');
  const vs=(process.argv[9]||'-60,-45,-30,-15,0,15,30,45,60').split(',').map(Number);
  let ok=0,n=0,b=[];
  const st=+(process.env.STEG||20);for(let x=x1;x<=x2;x+=st)for(let y=y1;y<=y2;y+=st)for(const v of vs){n++;const L=[...extra,{typ,x,y,vinkel:v,vand}];if(kor(bana,L).status==='vann'){ok++;b.push([x,y,v]);}}
  console.log('ingen delar:',kor(bana,extra).status,'| grid',ok+'/'+n, JSON.stringify(b.slice(0,8)));
} else { const r=kor(bana,JSON.parse(process.argv[3]||'[]'),true); console.log(r.status,r.orsak||'',r.sek,r.spar.join(' ')); }
