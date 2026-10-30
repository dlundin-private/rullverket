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
        if (data.aktiv === s.id) { data.aktiv = null; sattTema('verkstad'); }
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

  /* ---------- Teman ---------- */
  const TEMAN = [
    { id: 'verkstad', namn: 'Verkstad', prov: '#2b5f8a' },
    { id: 'djungel', namn: 'Djungel', prov: '#3f7a3a' },
    { id: 'oken', namn: 'Öken', prov: '#e2ad68' },
    { id: 'lekplats', namn: 'Lekplats', prov: '#ef5b5b' }
  ];
  let tema = 'verkstad';
  function sattTema(id) {
    tema = TEMAN.some((t) => t.id === id) ? id : 'verkstad';
    if (tema === 'verkstad') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', tema);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    lasFarger();
  }
  function ritaTemaval() {
    const rad = $('#teman');
    rad.innerHTML = '';
    for (const t of TEMAN) {
      const k = document.createElement('button');
      k.className = 'tema';
      k.setAttribute('aria-pressed', String(t.id === tema));
      k.innerHTML = '<span class="prov"></span><span></span>';
      k.querySelector('.prov').style.background = t.prov;
      k.lastChild.textContent = t.namn;
      k.onclick = () => {
        const s = aktiv();
        if (s) { s.tema = t.id; spara(); }
        sattTema(t.id);
        ritaTemaval();
      };
      rad.append(k);
    }
  }

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
    sattTema(s.tema);
    ritaTemaval();
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
    delKroppar = placerade.map((p) => Motor.delKropp(p.typ, p.x, p.y, p.vinkel, p.vand));
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
      vikt: '<rect x="11" y="3" width="22" height="22" rx="3" fill="var(--vikt)"/><text x="22" y="18" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">kg</text>',
      band: '<rect x="2" y="10" width="40" height="10" rx="5" fill="var(--band)"/><path d="M12 12 l4 3 l-4 3 M21 12 l4 3 l-4 3 M30 12 l4 3 l-4 3" fill="none" stroke="var(--band-ljus)" stroke-width="1.8"/>',
      motor: '<circle cx="22" cy="15" r="12" fill="var(--motor)"/><path d="M22 4 V26 M11 15 H33" stroke="#fff" stroke-width="2.5" opacity=".8"/><circle cx="22" cy="15" r="3.5" fill="#fff"/>'
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
    delKroppar[drag.i] = Motor.delKropp(d.typ, d.x, d.y, d.vinkel, d.vand);
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
    const m = DELAR[d.typ];
    v.querySelector('[data-vand]').hidden = !m.vandbar;
    v.querySelectorAll('[data-vrid]').forEach((k) => { k.hidden = d.typ === 'motor'; });
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
    } else if (k.hasAttribute('data-vand')) {
      placerade[vald].vand = !placerade[vald].vand;
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
  let klocka = 0;
  const LEK_FARGER = ['#ef5b5b', '#3d7be8', '#2fb36d', '#8e6cd8'];
  function lasFarger() {
    const cs = getComputedStyle(document.documentElement);
    for (const n of ['papper', 'rutnat', 'sten', 'tra', 'tra-kant', 'fjader', 'vikt', 'boll', 'boll-kant', 'korg', 'gunga', 'fel', 'band', 'band-ljus', 'motor', 'knapp-farg', 'lucka', 'himmel', 'sten-2', 'dekor-1', 'dekor-2', 'dekor-3', 'boll-2'])
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
      ritaBoll(r, k.position.x / r);
      ctx.restore();
      return;
    }
    if (typ === 'band') {
      const v = k.vertices;
      const l = Math.hypot(v[1].x - v[0].x, v[1].y - v[0].y);
      const h = Motor.DELAR.band.h;
      const dir = k.rv.vand ? -1 : 1;
      ctx.save();
      ctx.translate(k.position.x, k.position.y); ctx.rotate(k.angle);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-l / 2, -h / 2, l, h, h / 2) : ctx.rect(-l / 2, -h / 2, l, h);
      ctx.fillStyle = farg.band; ctx.fill();
      ctx.save(); ctx.clip();
      const steg = 22, fas = ((klocka * Motor.DELAR.band.fart * 60 * dir) % steg + steg) % steg;
      ctx.beginPath();
      for (let x = -l / 2 - steg + fas; x < l / 2 + steg; x += steg) {
        ctx.moveTo(x - 4 * dir, -5); ctx.lineTo(x + 3 * dir, 0); ctx.lineTo(x - 4 * dir, 5);
      }
      ctx.strokeStyle = farg['band-ljus']; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      for (const x of [-l / 2 + h / 2, l / 2 - h / 2]) {
        ctx.beginPath(); ctx.arc(x, 0, h / 2 - 3, 0, Math.PI * 2); ctx.fillStyle = farg['band-ljus']; ctx.fill();
      }
      ctx.restore();
    } else if (typ === 'motor') {
      const r = k.circleRadius;
      const dir = k.rv.vand ? -1 : 1;
      const vinkel = klocka * (Motor.DELAR.motor.fart / r) * 60 * dir;
      ctx.save();
      ctx.translate(k.position.x, k.position.y);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = farg.motor; ctx.fill();
      ctx.rotate(vinkel);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); }
      ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.75; ctx.lineWidth = 6; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.rotate(-vinkel);
      // pil som visar åt vilket håll hjulet snurrar
      ctx.beginPath(); ctx.arc(0, 0, r + 9, -2.3, -0.8);
      ctx.strokeStyle = farg.motor; ctx.lineWidth = 3; ctx.stroke();
      const ax = dir > 0 ? Math.cos(-0.8) * (r + 9) : Math.cos(-2.3) * (r + 9);
      const ay = dir > 0 ? Math.sin(-0.8) * (r + 9) : Math.sin(-2.3) * (r + 9);
      ctx.beginPath(); ctx.arc(ax, ay, 4.5, 0, Math.PI * 2); ctx.fillStyle = farg.motor; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    } else if (typ === 'snurra') {
      for (const p of k.parts.slice(1)) { vagPath(p.vertices); ctx.fillStyle = farg.motor; ctx.fill(); }
      ctx.beginPath(); ctx.arc(k.position.x, k.position.y, 10, 0, Math.PI * 2); ctx.fillStyle = farg.sten; ctx.fill();
    } else if (typ === 'hiss') {
      vagPath(k.vertices); ctx.fillStyle = farg.gunga; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = farg.sten; ctx.stroke();
    } else if (typ === 'knapp') {
      ctx.save();
      ctx.translate(k.position.x, k.position.y);
      const b = k.bounds.max.x - k.bounds.min.x;
      ctx.fillStyle = farg.sten; ctx.fillRect(-b / 2 - 6, 2, b + 12, 4);
      ctx.fillStyle = k.rv.tryckt ? farg.korg : farg['knapp-farg'];
      const hh = k.rv.tryckt ? 4 : 10;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-b / 2, 3 - hh, b, hh, 3) : ctx.rect(-b / 2, 3 - hh, b, hh); ctx.fill();
      ctx.restore();
    } else if (typ === 'lucka') {
      vagPath(k.vertices); ctx.fillStyle = farg.lucka; ctx.fill();
      ctx.save(); vagPath(k.vertices); ctx.clip();
      ctx.beginPath();
      for (let x = k.bounds.min.x - 60; x < k.bounds.max.x + 60; x += 14) { ctx.moveTo(x, k.bounds.min.y - 60); ctx.lineTo(x + 120, k.bounds.max.y + 60); }
      ctx.strokeStyle = farg.sten; ctx.globalAlpha = 0.35; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (typ === 'fjader') {
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
      ritaVagg(k);
    }
    if (markering) {
      vagPath(k.parts.length > 1 ? k.parts[0].vertices : k.vertices);
      ctx.lineWidth = 4; ctx.strokeStyle = markering; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
    }
  }


  /* Väggar: samma form i alla teman men olika material */
  function ritaVagg(k) {
    const v = k.vertices;
    vagPath(v);
    if (tema === 'lekplats') {
      const nr = k.rv && k.rv.nr !== undefined ? k.rv.nr : 0;
      ctx.fillStyle = LEK_FARGER[nr % LEK_FARGER.length]; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
      return;
    }
    ctx.fillStyle = farg.sten; ctx.fill();
    if (v.length !== 4) return;
    // längsta sidan som ligger överst får mossa, sandränder eller ingenting
    const l01 = Math.hypot(v[1].x - v[0].x, v[1].y - v[0].y);
    const l12 = Math.hypot(v[2].x - v[1].x, v[2].y - v[1].y);
    const [a, b, c, d] = l01 >= l12 ? [v[0], v[1], v[2], v[3]] : [v[1], v[2], v[3], v[0]];
    // den sida som ligger högst upp (lägst y i mitten) är ovansidan
    let ovre = [v[0], v[1]];
    for (let i = 0; i < 4; i++) {
      const p = v[i], q = v[(i + 1) % 4];
      if ((p.y + q.y) / 2 < (ovre[0].y + ovre[1].y) / 2) ovre = [p, q];
    }
    if (tema === 'djungel') {
      ctx.beginPath(); ctx.moveTo(ovre[0].x, ovre[0].y); ctx.lineTo(ovre[1].x, ovre[1].y);
      ctx.strokeStyle = farg['sten-2']; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
      // små blad längs mossan
      const n = Math.floor(Math.hypot(ovre[1].x - ovre[0].x, ovre[1].y - ovre[0].y) / 40);
      ctx.fillStyle = farg['sten-2'];
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const x = ovre[0].x + (ovre[1].x - ovre[0].x) * t, y = ovre[0].y + (ovre[1].y - ovre[0].y) * t;
        ctx.beginPath(); ctx.ellipse(x, y + 5, 4, 8, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineCap = 'butt';
    } else if (tema === 'oken') {
      ctx.save(); vagPath(v); ctx.clip();
      const mx = (a.x + b.x + c.x + d.x) / 4, my = (a.y + b.y + c.y + d.y) / 4;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      ctx.beginPath();
      for (const f of [-0.22, 0.22]) {
        const nx = -dy / len * 40 * f, ny = dx / len * 40 * f;
        ctx.moveTo(mx - dx + nx, my - dy + ny); ctx.lineTo(mx + dx + nx, my + dy + ny);
      }
      ctx.strokeStyle = farg['sten-2']; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
  }

  /* Bollen: ser olika ut i varje tema */
  function ritaBoll(r, vrid) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = farg.boll; ctx.fill();
    ctx.save();
    ctx.rotate(vrid);
    if (tema === 'lekplats') {
      ctx.clip();
      for (const [a, f] of [[0, farg['boll-kant']], [2.094, farg['boll-2']], [4.189, '#ffd23f']]) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a, a + 1.047); ctx.closePath();
        ctx.fillStyle = f; ctx.fill();
      }
    } else if (tema === 'djungel') {
      ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(3, -r - 7);
      ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 3; ctx.stroke();
    } else if (tema === 'oken') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = farg['boll-kant']; ctx.lineWidth = 2.5; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-r + 4, 0); ctx.lineTo(r - 4, 0);
      ctx.strokeStyle = farg['boll-kant']; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = farg['boll-kant']; ctx.stroke();
  }

  /* Kulisser bakom banan. Svaga färger så att banans delar syns tydligt. */
  function kulle(y0, amp, vag, fas) {
    ctx.beginPath(); ctx.moveTo(0, VARLD.h);
    for (let x = 0; x <= VARLD.b; x += 20) ctx.lineTo(x, y0 + Math.sin(x / vag + fas) * amp);
    ctx.lineTo(VARLD.b, VARLD.h); ctx.closePath();
  }
  function ritaKulisser() {
    const g = ctx.createLinearGradient(0, 0, 0, VARLD.h);
    g.addColorStop(0, farg.himmel); g.addColorStop(1, farg.papper);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VARLD.b, VARLD.h);
    if (tema === 'verkstad') return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    if (tema === 'djungel') {
      ctx.fillStyle = farg['dekor-1']; kulle(470, 26, 70, 0.5); ctx.fill();
      ctx.fillStyle = farg['dekor-2']; kulle(530, 20, 55, 2); ctx.fill();
      // stora blad i hörnen
      ctx.fillStyle = farg['dekor-3'];
      for (const [x, y, rot, s] of [[20, 20, 0.6, 1], [90, -10, 1.2, 0.8], [980, 30, -0.7, 1], [910, -15, -1.3, 0.8]]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
        ctx.beginPath(); ctx.ellipse(0, 50, 26, 70, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // lianer
      ctx.strokeStyle = farg['dekor-3']; ctx.lineWidth = 3;
      for (const [x, l] of [[300, 150], [560, 100], [720, 180]]) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 30, l / 2, x - 5, l); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x - 5, l + 8, 6, 11, 0.3, 0, Math.PI * 2); ctx.fillStyle = farg['dekor-3']; ctx.fill();
      }
    } else if (tema === 'oken') {
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(930, 62, 34, 0, Math.PI * 2); ctx.fillStyle = farg['dekor-3']; ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = farg['dekor-1']; kulle(460, 30, 120, 1); ctx.fill();
      ctx.fillStyle = farg['dekor-2']; kulle(530, 22, 90, 3); ctx.fill();
      // kaktusar
      ctx.fillStyle = farg['dekor-2'];
      for (const [x, y, s] of [[140, 455, 1], [640, 470, 0.8], [900, 520, 0.7]]) {
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-9, -70, 18, 80, 9) : ctx.rect(-9, -70, 18, 80); ctx.fill();
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-30, -45, 12, 34, 6) : ctx.rect(-30, -45, 12, 34); ctx.fill();
        ctx.fillRect(-26, -18, 20, 10);
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(18, -55, 12, 30, 6) : ctx.rect(18, -55, 12, 30); ctx.fill();
        ctx.fillRect(6, -32, 20, 10);
        ctx.restore();
      }
    } else if (tema === 'lekplats') {
      // moln
      ctx.fillStyle = farg['dekor-2']; ctx.globalAlpha = 0.85;
      for (const [x, y, s] of [[180, 80, 1], [560, 50, 0.8], [830, 110, 1.1]]) {
        ctx.beginPath();
        ctx.arc(x, y, 26 * s, 0, Math.PI * 2); ctx.arc(x + 30 * s, y - 10 * s, 30 * s, 0, Math.PI * 2);
        ctx.arc(x + 62 * s, y, 24 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = farg['dekor-1']; kulle(560, 8, 90, 0); ctx.fill();
      // gungställning
      ctx.strokeStyle = farg['dekor-3']; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(700, 560); ctx.lineTo(730, 420); ctx.lineTo(760, 560);
      ctx.moveTo(860, 560); ctx.lineTo(890, 420); ctx.lineTo(920, 560);
      ctx.moveTo(730, 420); ctx.lineTo(890, 420);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(790, 420); ctx.lineTo(790, 510); ctx.moveTo(830, 420); ctx.lineTo(830, 510); ctx.stroke();
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(784, 512); ctx.lineTo(836, 512); ctx.stroke();
      // träd
      ctx.fillStyle = farg['dekor-3']; ctx.fillRect(92, 470, 14, 90);
      ctx.fillStyle = farg['dekor-1']; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(99, 450, 46, 0, Math.PI * 2); ctx.arc(70, 480, 30, 0, Math.PI * 2); ctx.arc(130, 478, 32, 0, Math.PI * 2); ctx.fill();
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }

  function rita() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, duk.width, duk.height);
    ctx.translate(ox, oy);
    ctx.scale(skala, skala);
    // papper med rutnät
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, VARLD.b, VARLD.h, 14) : ctx.rect(0, 0, VARLD.b, VARLD.h);
    ctx.save(); ctx.clip();
    ritaKulisser();
    ctx.strokeStyle = farg.rutnat; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 50; x < VARLD.b; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, VARLD.h); }
    for (let y = 50; y < VARLD.h; y += 50) { ctx.moveTo(0, y); ctx.lineTo(VARLD.b, y); }
    ctx.stroke();
    klocka = sim ? sim.ruta / 60 : performance.now() / 1000;
    // hissens spår
    for (const o of bana.foremal) if (o.typ === 'hiss') {
      ctx.beginPath(); ctx.moveTo(o.x, o.y + 8); ctx.lineTo(o.x, o.y + o.dy - 8);
      ctx.strokeStyle = farg.sten; ctx.globalAlpha = 0.35; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
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
    if (aktiv()) sattTema(aktiv().tema);
    if (aktiv()) visaKarta(); else visaProfiler();
    requestAnimationFrame(slinga);
  }).catch(() => {
    document.body.innerHTML = '<p style="padding:24px;font-size:18px">Banorna kunde inte laddas. Starta spelet via en webbserver, till exempel med npm run serve.</p>';
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !document.getElementById('banor-data')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
