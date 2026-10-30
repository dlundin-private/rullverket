/* Rullverket – gränssnitt: profiler, bankarta, byggläge, körning och ritning. */
(function () {
  'use strict';
  const { Vertices, Composite } = Matter;
  const { DELAR, VARLD } = Motor;
  const LAGRING = 'rullverket-v1';
  const FARGER = ['#f5c02e', '#4f8ef7', '#e5484d', '#2e9e6a', '#8e6cd8', '#f08a24'];
  const $ = (s) => document.querySelector(s);

  /* ---------- Sparade data ---------- */
  function ladda() {
    try {
      const d = JSON.parse(localStorage.getItem(LAGRING) || 'null');
      if (d && Array.isArray(d.spelare)) return d;
    } catch (e) { /* tom lagring */ }
    return { spelare: [], aktiv: null };
  }
  function spara() {
    try { localStorage.setItem(LAGRING, JSON.stringify(data)); } catch (e) { /* lagring saknas */ }
  }
  let data = ladda();
  const aktiv = () => data.spelare.find((s) => s.id === data.aktiv);

  /* ---------- Banor ---------- */
  let banor = [];
  async function laddaBanor() {
    const inbyggd = document.getElementById('banor-data');
    if (inbyggd) return JSON.parse(inbyggd.textContent).banor;
    const svar = await fetch('banor.json', { cache: 'no-cache' });
    return (await svar.json()).banor;
  }

  /* ---------- Skärmar ---------- */
  function visa(id) {
    document.querySelectorAll('.skarm').forEach((e) => { e.hidden = e.id !== id; });
    if (id === 'spel') storlek();
  }

  /* ---------- Profiler ---------- */
  function stjarnSumma(s) { return Object.values(s.stjarnor || {}).reduce((a, b) => a + b, 0); }

  function visaProfiler() {
    const lista = $('#spelarlista');
    lista.innerHTML = '';
    for (const s of data.spelare) {
      const rad = document.createElement('div');
      rad.className = 'spelare-rad';
      const k = document.createElement('button');
      k.className = 'spelare';
      k.innerHTML = '<span class="prick"></span><span class="namn"></span><span class="sum"></span>';
      k.querySelector('.prick').style.background = s.farg;
      k.querySelector('.namn').textContent = s.namn;
      k.querySelector('.sum').textContent = '★ ' + stjarnSumma(s);
      k.onclick = () => { data.aktiv = s.id; spara(); visaKarta(); };
      const bort = document.createElement('button');
      bort.className = 'ta-bort';
      bort.setAttribute('aria-label', 'Ta bort ' + s.namn);
      bort.textContent = '✕';
      bort.onclick = () => {
        if (!confirm('Ta bort ' + s.namn + ' och alla stjärnor?')) return;
        data.spelare = data.spelare.filter((x) => x !== s);
        if (data.aktiv === s.id) data.aktiv = null;
        spara(); visaProfiler();
      };
      rad.append(k, bort);
      lista.append(rad);
    }
    $('#nytt-namn').placeholder = data.spelare.length ? 'Skriv ett namn' : 'Skriv ditt namn';
    visa('profiler');
  }

  function laggTill() {
    const namn = $('#nytt-namn').value.trim();
    if (!namn) { $('#nytt-namn').focus(); return; }
    const s = { id: 's' + Date.now(), namn, farg: FARGER[data.spelare.length % FARGER.length], stjarnor: {}, layout: {} };
    data.spelare.push(s);
    data.aktiv = s.id;
    $('#nytt-namn').value = '';
    spara();
    visaKarta();
  }
  $('#lagg-till').onclick = laggTill;
  $('#nytt-namn').addEventListener('keydown', (e) => { if (e.key === 'Enter') laggTill(); });

  /* ---------- Bankarta ---------- */
  function upplast(i) {
    if (i === 0) return true;
    const s = aktiv();
    return !!(s && s.stjarnor[banor[i - 1].id]);
  }
  function stjarnHtml(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'full' : ''}">★</span>`).join('');
  }
  function visaKarta() {
    const s = aktiv();
    if (!s) return visaProfiler();
    $('#halsning').textContent = 'Hej ' + s.namn + '!';
    $('#total').textContent = '★ ' + stjarnSumma(s) + ' av ' + banor.length * 3;
    const grid = $('#bangrid');
    grid.innerHTML = '';
    banor.forEach((b, i) => {
      const k = document.createElement('button');
      const oppen = upplast(i);
      k.className = 'banruta' + (oppen ? '' : ' last');
      k.innerHTML = `<span class="nr">${oppen ? i + 1 : '🔒'}</span><span class="namn"></span><span class="stjarnor">${stjarnHtml(s.stjarnor[b.id] || 0)}</span>`;
      k.querySelector('.namn').textContent = b.namn;
      k.setAttribute('aria-label', `Bana ${i + 1}, ${b.namn}${oppen ? '' : ', låst'}`);
      if (oppen) k.onclick = () => startaBana(i);
      else k.disabled = true;
      grid.append(k);
    });
    visa('karta');
  }
  $('#byt-spelare').onclick = visaProfiler;

  /* ---------- Spelläge ---------- */
  const duk = $('#duk');
  const ctx = duk.getContext('2d');
  let banIndex = 0, bana = null, statiska = [], placerade = [], delKroppar = [];
  let vald = -1, lage = 'bygg', sim = null, snabb = false, drag = null, fel = [];
  let skala = 1, ox = 0, oy = 0, dpr = 1;

  function startaBana(i) {
    banIndex = i;
    bana = banor[i];
    statiska = Motor.banKroppar(bana).kroppar;
    const s = aktiv();
    const sparad = (s.layout && s.layout[bana.id]) || [];
    placerade = [];
    for (const p of sparad) if (kvar(p.typ) > 0) placerade.push({ ...p });
    vald = -1; lage = 'bygg'; sim = null;
    $('#bannamn').textContent = `${i + 1}. ${bana.namn}`;
    $('#bantips').textContent = bana.tips;
    const [tre, tva] = bana.stjarnor;
    $('#stjarnmal').innerHTML = `<b>★★★</b> ${delText(tre)}` + (tva > tre ? `<br><b>★★</b> ${delText(tva)}` : '');
    $('#resultat').hidden = true;
    $('#meddelande').hidden = true;
    byggOm();
    visa('spel');
  }
  const delText = (n) => (n === 1 ? 'med 1 del' : `med ${n} delar`);

  function kvar(typ) {
    return (bana.delar[typ] || 0) - placerade.filter((p) => p.typ === typ).length;
  }

  function byggOm() {
    delKroppar = placerade.map((p) => Motor.delKropp(p.typ, p.x, p.y, p.vinkel));
    fel = Motor.iVagen(bana, placerade);
    ritaLada();
    uppdateraKnappar();
    placeraVerktyg();
  }

  /* Verktygslådan */
  function delIkon(typ) {
    const f = {
      planka: '<rect x="2" y="12" width="40" height="7" rx="2" fill="var(--tra)" stroke="var(--tra-kant)" stroke-width="1.5"/>',
      kort: '<rect x="10" y="12" width="24" height="7" rx="2" fill="var(--tra)" stroke="var(--tra-kant)" stroke-width="1.5"/>',
      ramp: '<path d="M4 26 L40 26 L40 6 Z" fill="var(--tra)" stroke="var(--tra-kant)" stroke-width="1.5" stroke-linejoin="round"/>',
      fjader: '<rect x="6" y="6" width="32" height="6" rx="2" fill="var(--fjader)"/><path d="M10 13 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6" fill="none" stroke="var(--fjader)" stroke-width="2"/>',
      vikt: '<rect x="11" y="3" width="22" height="22" rx="3" fill="var(--vikt)"/><text x="22" y="18" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">kg</text>'
    }[typ];
    return `<svg viewBox="0 0 44 30" aria-hidden="true">${f}</svg>`;
  }
  function ritaLada() {
    const lada = $('#lada');
    lada.innerHTML = '';
    for (const typ of Object.keys(bana.delar)) {
      const n = kvar(typ);
      const k = document.createElement('button');
      k.className = 'del';
      k.disabled = n <= 0 || lage === 'kor' || lage === 'klar';
      k.innerHTML = `${delIkon(typ)}<span class="antal">×${n}</span>`;
      k.setAttribute('aria-label', `${DELAR[typ].namn}, ${n} kvar`);
      k.addEventListener('pointerdown', (e) => nyDel(e, typ));
      lada.append(k);
    }
  }

  function uppdateraKnappar() {
    const starta = $('#starta');
    starta.textContent = lage === 'kor' ? 'Stoppa' : 'Starta';
    $('#snabb').hidden = lage !== 'kor';
    $('#snabb').setAttribute('aria-pressed', String(snabb));
    $('#snabb').style.opacity = snabb ? '1' : '.7';
  }

  /* Koordinater */
  function storlek() {
    const r = duk.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    duk.width = Math.round(r.width * dpr);
    duk.height = Math.round(r.height * dpr);
    skala = Math.min(r.width / VARLD.b, r.height / VARLD.h);
    ox = (r.width - VARLD.b * skala) / 2;
    oy = (r.height - VARLD.h * skala) / 2;
    $('#vand').hidden = !(r.height > r.width * 1.1 && skala < 0.5);
    placeraVerktyg();
  }
  window.addEventListener('resize', () => { if (!$('#spel').hidden) storlek(); });

  function tillVarld(cx, cy) {
    const r = duk.getBoundingClientRect();
    return { x: (cx - r.left - ox) / skala, y: (cy - r.top - oy) / skala };
  }
  const klamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function traff(p) {
    for (let i = placerade.length - 1; i >= 0; i--) {
      const d = placerade[i], m = DELAR[d.typ];
      const a = -d.vinkel * Math.PI / 180;
      const dx = p.x - d.x, dy = p.y - d.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) < m.b / 2 + 12 && Math.abs(ly) < m.h / 2 + 16) return i;
    }
    return -1;
  }

  /* Dra och släpp */
  function nyDel(e, typ) {
    if (lage === 'miste') tillBygg();
    if (lage !== 'bygg' || kvar(typ) <= 0) return;
    e.preventDefault();
    const p = tillVarld(e.clientX, e.clientY);
    placerade.push({ typ, x: Math.round(klamp(p.x, 40, 960)), y: Math.round(klamp(p.y, 40, 560)), vinkel: 0 });
    vald = placerade.length - 1;
    drag = { i: vald, dx: 0, dy: 0, sx: e.clientX, sy: e.clientY, flyttad: false, ny: true };
    $('#delverktyg').hidden = true;
    byggOm();
  }

  duk.addEventListener('pointerdown', (e) => {
    if (lage === 'miste') tillBygg();
    if (lage !== 'bygg') return;
    const p = tillVarld(e.clientX, e.clientY);
    const i = traff(p);
    if (i < 0) { vald = -1; placeraVerktyg(); return; }
    vald = i;
    drag = { i, dx: placerade[i].x - p.x, dy: placerade[i].y - p.y, sx: e.clientX, sy: e.clientY, flyttad: false, ny: false };
    $('#delverktyg').hidden = true;
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.flyttad && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.flyttad = true;
    const p = tillVarld(e.clientX, e.clientY);
    const d = placerade[drag.i];
    d.x = Math.round(klamp(p.x + drag.dx, 0, VARLD.b));
    d.y = Math.round(klamp(p.y + drag.dy, 0, VARLD.h));
    delKroppar[drag.i] = Motor.delKropp(d.typ, d.x, d.y, d.vinkel);
  });

  function slapp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.ny) {
      const r = duk.getBoundingClientRect();
      const inne = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!d.flyttad) {
        // Bara ett tryck i lådan: lägg delen mitt på banan
        Object.assign(placerade[d.i], { x: 500, y: 260 });
      } else if (!inne) {
        placerade.splice(d.i, 1);
        vald = -1;
      }
    }
    byggOm();
  }
  window.addEventListener('pointerup', slapp);
  window.addEventListener('pointercancel', slapp);

  /* Vrid och ta bort */
  function placeraVerktyg() {
    const v = $('#delverktyg');
    if (vald < 0 || lage !== 'bygg' || drag || !placerade[vald]) { v.hidden = true; return; }
    const d = placerade[vald];
    const scen = $('#scen').getBoundingClientRect();
    let x = ox + d.x * skala;
    let y = oy + (d.y - Math.max(DELAR[d.typ].b, DELAR[d.typ].h) / 2 - 14) * skala;
    v.hidden = false;
    const w = v.offsetWidth, h = v.offsetHeight;
    x = klamp(x, w / 2 + 4, scen.width - w / 2 - 4);
    if (y - h < 4) y = oy + (d.y + Math.max(DELAR[d.typ].b, DELAR[d.typ].h) / 2 + 14) * skala + h;
    v.style.left = x + 'px';
    v.style.top = y + 'px';
  }
  $('#delverktyg').addEventListener('click', (e) => {
    const k = e.target.closest('button');
    if (!k || vald < 0) return;
    if (k.hasAttribute('data-ta-bort')) {
      placerade.splice(vald, 1);
      vald = -1;
    } else {
      const d = placerade[vald];
      d.vinkel = ((d.vinkel + Number(k.dataset.vrid) + 180) % 360 + 360) % 360 - 180;
    }
    byggOm();
  });

  /* Körning */
  $('#starta').onclick = () => {
    if (lage === 'kor') return tillBygg();
    if (lage === 'miste') tillBygg();
    if (lage !== 'bygg') return;
    fel = Motor.iVagen(bana, placerade);
    if (fel.length) {
      visaMeddelande('Röda delar ligger i vägen. Flytta dem.', false);
      return;
    }
    const s = aktiv();
    s.layout = s.layout || {};
    s.layout[bana.id] = placerade.map((p) => ({ ...p }));
    spara();
    sim = Motor.bygg(bana, placerade);
    lage = 'kor';
    vald = -1;
    $('#meddelande').hidden = true;
    ritaLada();
    uppdateraKnappar();
    placeraVerktyg();
  };
  $('#snabb').onclick = () => { snabb = !snabb; uppdateraKnappar(); };

  function tillBygg() {
    lage = 'bygg';
    sim = null;
    $('#meddelande').hidden = true;
    $('#resultat').hidden = true;
    byggOm();
  }
  $('#forsok-igen').onclick = tillBygg;

  function visaMeddelande(text, medKnapp) {
    $('#meddelande-text').textContent = text;
    $('#forsok-igen').hidden = !medKnapp;
    $('#meddelande').hidden = false;
    if (!medKnapp) {
      clearTimeout(visaMeddelande.t);
      visaMeddelande.t = setTimeout(() => { if (lage === 'bygg') $('#meddelande').hidden = true; }, 2600);
    }
  }

  function steg(antal) {
    for (let i = 0; i < antal && lage === 'kor'; i++) {
      const r = sim.steg();
      if (r.status === 'vann') return vinst();
      if (r.status === 'miste') {
        lage = 'miste';
        ritaLada();
        uppdateraKnappar();
        $('#snabb').hidden = true;
        $('#starta').textContent = 'Starta';
        visaMeddelande(r.orsak === 'ute' ? 'Bollen ramlade ut. Ändra och försök igen.' : 'Bollen fastnade. Ändra och försök igen.', true);
        return;
      }
    }
  }

  function vinst() {
    lage = 'klar';
    const n = Motor.stjarnor(bana, placerade.length);
    const s = aktiv();
    const fore = s.stjarnor[bana.id] || 0;
    s.stjarnor[bana.id] = Math.max(fore, n);
    spara();
    $('#res-stjarnor').innerHTML = stjarnHtml(n);
    $('#res-stjarnor').setAttribute('aria-label', `${n} av 3 stjärnor`);
    $('#res-rubrik').textContent = n === 3 ? 'Perfekt!' : n > fore && fore ? 'Nytt rekord!' : 'Klart!';
    const [tre, tva] = bana.stjarnor;
    const anvant = `Du använde ${placerade.length === 1 ? '1 del' : placerade.length + ' delar'}.`;
    $('#res-text').textContent = n === 3 ? anvant : `${anvant} Klarar du det ${n === 2 ? delText(tre) : delText(tva)}?`;
    $('#res-farre').hidden = n === 3;
    const sist = banIndex >= banor.length - 1;
    $('#res-nasta').textContent = sist ? 'Alla banor' : 'Nästa bana';
    $('#resultat').hidden = false;
    $('#res-nasta').focus();
    uppdateraKnappar();
  }
  $('#res-nasta').onclick = () => (banIndex >= banor.length - 1 ? visaKarta() : startaBana(banIndex + 1));
  $('#res-farre').onclick = tillBygg;
  $('#res-karta').onclick = visaKarta;
  $('#till-karta').onclick = () => { lage = 'bygg'; sim = null; drag = null; visaKarta(); };

  /* ---------- Ritning ---------- */
  let farg = {};
  function lasFarger() {
    const cs = getComputedStyle(document.documentElement);
    for (const n of ['papper', 'rutnat', 'sten', 'tra', 'tra-kant', 'fjader', 'vikt', 'boll', 'boll-kant', 'korg', 'gunga', 'fel'])
      farg[n] = cs.getPropertyValue('--' + n).trim();
  }
  lasFarger();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', lasFarger);

  function vagPath(verts) {
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
  }

  function ritaKropp(k, markering) {
    const roll = k.rv ? k.rv.roll : '';
    const typ = k.rv ? k.rv.typ : '';
    ctx.lineJoin = 'round';
    if (roll === 'boll') {
      const r = k.circleRadius;
      ctx.save();
      ctx.translate(k.position.x, k.position.y);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = farg.boll; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = farg['boll-kant']; ctx.stroke();
      ctx.rotate(k.position.x / r);
      ctx.beginPath(); ctx.moveTo(-r + 4, 0); ctx.lineTo(r - 4, 0);
      ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      return;
    }
    if (typ === 'fjader') {
      ctx.save();
      ctx.translate(k.position.x, k.position.y);
      ctx.rotate(k.angle);
      ctx.beginPath();
      ctx.moveTo(-30, 8);
      for (let i = 0; i < 6; i++) ctx.lineTo(-30 + i * 12 + 6, i % 2 ? 8 : 24);
      ctx.lineTo(30, 8);
      ctx.strokeStyle = farg.fjader; ctx.lineWidth = 3; ctx.globalAlpha = 0.7; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
      vagPath(k.vertices);
      ctx.fillStyle = farg.fjader; ctx.fill();
    } else if (typ === 'vikt') {
      vagPath(k.vertices);
      ctx.fillStyle = farg.vikt; ctx.fill();
      ctx.save();
      ctx.translate(k.position.x, k.position.y); ctx.rotate(k.angle);
      ctx.fillStyle = '#fff'; ctx.font = '800 18px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('kg', 0, 1);
      ctx.restore();
    } else if (roll === 'del') {
      const delar = k.parts.length > 1 ? k.parts.slice(1) : [k];
      for (const p of delar) {
        vagPath(p.vertices);
        ctx.fillStyle = farg.tra; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = farg['tra-kant']; ctx.stroke();
      }
    } else if (roll === 'gunga') {
      vagPath(k.vertices);
      ctx.fillStyle = farg.gunga; ctx.fill();
      ctx.beginPath(); ctx.arc(k.position.x, k.position.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = farg.papper; ctx.fill();
    } else if (roll === 'lada') {
      vagPath(k.vertices);
      ctx.fillStyle = farg.sten; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 3; ctx.strokeStyle = farg.sten; ctx.stroke();
      ctx.save();
      ctx.translate(k.position.x, k.position.y); ctx.rotate(k.angle);
      ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(20, 20); ctx.moveTo(20, -20); ctx.lineTo(-20, 20);
      ctx.strokeStyle = farg.papper; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (roll === 'korg') {
      vagPath(k.vertices);
      ctx.fillStyle = farg.korg; ctx.fill();
    } else {
      vagPath(k.vertices);
      ctx.fillStyle = farg.sten; ctx.fill();
    }
    if (markering) {
      vagPath(k.parts.length > 1 ? k.parts[0].vertices : k.vertices);
      ctx.lineWidth = 4; ctx.strokeStyle = markering; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function rita() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, duk.width, duk.height);
    ctx.translate(ox, oy);
    ctx.scale(skala, skala);
    // papper med rutnät
    ctx.fillStyle = farg.papper;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, VARLD.b, VARLD.h, 14) : ctx.rect(0, 0, VARLD.b, VARLD.h); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = farg.rutnat; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 50; x < VARLD.b; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, VARLD.h); }
    for (let y = 50; y < VARLD.h; y += 50) { ctx.moveTo(0, y); ctx.lineTo(VARLD.b, y); }
    ctx.stroke();
    // korgens insida
    for (const o of bana.foremal) if (o.typ === 'korg') {
      ctx.fillStyle = farg.korg; ctx.globalAlpha = 0.16;
      ctx.fillRect(o.x - o.b / 2, o.y - o.h, o.b, o.h);
      ctx.globalAlpha = 1;
    }
    let kroppar;
    if (sim) kroppar = Composite.allBodies(sim.world);
    else kroppar = statiska.concat(delKroppar);
    const sist = [];
    for (const k of kroppar) {
      if (k.rv && k.rv.roll === 'boll') { sist.push(k); continue; }
      let m = null;
      if (!sim) {
        const i = delKroppar.indexOf(k);
        if (i >= 0 && fel.includes(i)) m = farg.fel;
        else if (i >= 0 && i === vald) m = farg.boll;
      }
      ritaKropp(k, m);
    }
    for (const k of sist) ritaKropp(k, null);
    ctx.restore();
  }

  /* ---------- Huvudslinga med fast tidssteg ---------- */
  let senast = performance.now(), ack = 0;
  function slinga(t) {
    const dt = Math.min(100, t - senast);
    senast = t;
    if (!$('#spel').hidden && bana) {
      if (lage === 'kor' && sim) {
        ack += dt * (snabb ? 3 : 1);
        const n = Math.min(12, Math.floor(ack / (1000 / 60)));
        ack -= n * (1000 / 60);
        steg(n);
      } else ack = 0;
      if (drag && drag.flyttad) fel = Motor.iVagen(bana, placerade);
      rita();
    }
    requestAnimationFrame(slinga);
  }

  /* ---------- Start ---------- */
  laddaBanor().then((b) => {
    banor = b;
    if (aktiv()) visaKarta(); else visaProfiler();
    requestAnimationFrame(slinga);
  }).catch(() => {
    document.body.innerHTML = '<p style="padding:24px;font-size:18px">Banorna kunde inte laddas. Starta spelet via en webbserver, till exempel med npm run serve.</p>';
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !document.getElementById('banor-data')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
