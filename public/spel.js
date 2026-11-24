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
    data.andrad = Date.now();
    try { localStorage.setItem(LAGRING, JSON.stringify(data)); } catch (e) { /* lagring saknas */ }
    sparaMoln();
  }
  let data = ladda();

  /* ---------- Molnsparning ----------
     När spelet körs som delad länk i claude.ai sparas profilerna också på kontot
     (privat för varje inloggad person), eftersom appen inte alltid behåller
     webbläsarens lagring. I git-versionen finns ingen window.claude och då
     används bara localStorage. */
  let molnDok = null, molnTimer = null, molnSkriver = Promise.resolve();
  async function startaMoln() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      molnDok = db.collection('data/users/' + id).doc('rullverket');
      const snap = await molnDok.get();
      const moln = snap.exists && snap.data() && typeof snap.data().json === 'string' ? JSON.parse(snap.data().json) : null;
      if (moln && Array.isArray(moln.spelare) && (moln.andrad || 0) >= (data.andrad || 0)) {
        data = moln;
        try { localStorage.setItem(LAGRING, JSON.stringify(data)); } catch (e) { /* lagring saknas */ }
        efterMolnladdning();
      } else if (data.spelare.length) {
        sparaMoln(true);
      }
    } catch (e) { molnDok = null; }
  }
  function sparaMoln(direkt) {
    if (!molnDok) return;
    clearTimeout(molnTimer);
    const skriv = () => {
      const json = JSON.stringify(data);
      molnSkriver = molnSkriver.then(() => molnDok.set({ json })).catch(() => {});
    };
    if (direkt) skriv(); else molnTimer = setTimeout(skriv, 700);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && molnTimer) { clearTimeout(molnTimer); molnTimer = null; sparaMoln(true); }
  });
  function efterMolnladdning() {
    if (!banor.length) return;
    if (!$('#spel').hidden) return;           // stör inte en pågående bana
    if (aktiv()) { sattTema(aktiv().tema); visaKarta(); } else visaProfiler();
  }
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

  /* ---------- Samlingen ----------
     Kosmetiska saker som låses upp av stjärnorna. krav är antal stjärnor totalt;
     inget förbrukas, så en upplåst sak förblir upplåst. Valen sparas per spelare i
     s.utseende, och s.sedda håller reda på vilka upplåsta saker spelaren har sett. */
  const SAMLING = [
    { typ: 'boll', rubrik: 'Bollar', saker: [
      { id: 'tema', namn: 'Temabollen', krav: 0 },
      { id: 'fotboll', namn: 'Fotboll', krav: 3 },
      { id: 'nyckelpiga', namn: 'Nyckelpiga', krav: 10 },
      { id: 'planet', namn: 'Planet', krav: 20 },
      { id: 'melon', namn: 'Vattenmelon', krav: 30 },
      { id: 'jorden', namn: 'Jordglob', krav: 45 },
      { id: 'glad', namn: 'Glad gubbe', krav: 60 },
      { id: 'regnbage', namn: 'Regnbåge', krav: 80 },
      { id: 'guld', namn: 'Guldboll', krav: 105 },
      { id: 'disco', namn: 'Discokula', krav: 125 }
    ] },
    { typ: 'hatt', rubrik: 'Hattar', saker: [
      { id: 'ingen', namn: 'Ingen hatt', krav: 0 },
      { id: 'keps', namn: 'Keps', krav: 6 },
      { id: 'party', namn: 'Partyhatt', krav: 15 },
      { id: 'krona', namn: 'Krona', krav: 40 },
      { id: 'propeller', namn: 'Propellermössa', krav: 70 },
      { id: 'trollkarl', namn: 'Trollkarlshatt', krav: 95 }
    ] },
    { typ: 'spar', rubrik: 'Spår', saker: [
      { id: 'inget', namn: 'Inget spår', krav: 0 },
      { id: 'prickar', namn: 'Prickar', krav: 8 },
      { id: 'bubblor', namn: 'Bubblor', krav: 25 },
      { id: 'stjarnor', namn: 'Stjärnstoft', krav: 50 },
      { id: 'regnbage', namn: 'Regnbågsspår', krav: 85 }
    ] },
    { typ: 'firande', rubrik: 'Firande', saker: [
      { id: 'konfetti', namn: 'Konfetti', krav: 0 },
      { id: 'ballonger', namn: 'Ballonger', krav: 35 },
      { id: 'fyrverkeri', namn: 'Fyrverkeri', krav: 65 },
      { id: 'stjarnregn', namn: 'Stjärnregn', krav: 115 }
    ] }
  ];
  function utseende(s) {
    const u = (s && s.utseende) || {};
    const ut = {};
    for (const k of SAMLING) ut[k.typ] = k.saker.some((x) => x.id === u[k.typ]) ? u[k.typ] : k.saker[0].id;
    return ut;
  }
  function upplasta(s) {
    const n = stjarnSumma(s);
    return SAMLING.flatMap((k) => k.saker.filter((x) => x.krav > 0 && x.krav <= n).map((x) => k.typ + ':' + x.id));
  }
  const nyaSaker = (s) => upplasta(s).filter((x) => !(s.sedda || []).includes(x));
  function sakNamn(nyckel) {
    const [typ, id] = nyckel.split(':');
    return SAMLING.find((k) => k.typ === typ).saker.find((x) => x.id === id).namn;
  }

  function ritaMiniatyr(duk2, typ, id, u) {
    const d = window.devicePixelRatio || 1;
    duk2.width = duk2.height = 64 * d;
    const c = duk2.getContext('2d');
    c.scale(d, d);
    c.translate(32, 32);
    if (typ === 'boll') {
      ritaSkal(c, 19, -0.4, id);
    } else if (typ === 'hatt') {
      c.translate(0, 12);
      ritaSkal(c, 15, 0, u.boll); ritaHatt(c, 15, id);
    } else if (typ === 'spar') {
      const pts = [];
      for (let i = 0; i < 16; i++) { const t = i / 15; pts.push({ x: -26 + t * 40, y: 12 - Math.sin(t * Math.PI * 0.8) * 26 }); }
      ritaSpar(c, pts, 12, id);
      const p = pts[pts.length - 1];
      c.translate(p.x, p.y); ritaSkal(c, 10, 0, u.boll);
    } else {
      // stillbild av firandet med fast slump så att den ser likadan ut varje gång
      let fro = 3;
      const R = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
      c.translate(-32, -32);
      for (let i = 0; i < (id === 'ballonger' ? 3 : id === 'fyrverkeri' ? 2 : 12); i++) {
        if (id === 'ballonger') ritaPartikel(c, { form: 'ballong', x: 14 + i * 18, y: 22 + (i % 2) * 10, s: 10, farg: FEST_FARGER[i] }, 1);
        else if (id === 'stjarnregn') ritaPartikel(c, { form: 'stjarna', x: 6 + R() * 52, y: 6 + R() * 52, s: 4 + R() * 4, rot: R() * 6, farg: i % 3 ? '#f5b301' : '#ffd23f' }, 1);
        else if (id === 'fyrverkeri') {
          const cx = 22 + i * 22, cy = 24 + i * 14;
          for (let j = 0; j < 14; j++) { const a = j / 14 * Math.PI * 2; ritaPartikel(c, { form: 'gnista', x: cx + Math.cos(a) * 14, y: cy + Math.sin(a) * 14, s: 2, farg: FEST_FARGER[i * 2 + 1] }, 1); }
        } else ritaPartikel(c, { form: 'bit', x: 6 + R() * 52, y: 6 + R() * 52, s: 7, rot: R() * 6, farg: FEST_FARGER[i % FEST_FARGER.length] }, 1);
      }
    }
  }

  function visaSamling() {
    const s = aktiv();
    if (!s) return visaProfiler();
    const n = stjarnSumma(s);
    const u = utseende(s);
    const nya = nyaSaker(s);
    $('#samling-total').textContent = '★ ' + n;
    const yta = $('#samlingar');
    yta.innerHTML = '';
    for (const k of SAMLING) {
      const h = document.createElement('h3');
      h.textContent = k.rubrik;
      const grid = document.createElement('div');
      grid.className = 'saker';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', k.rubrik);
      for (const x of k.saker) {
        const oppen = x.krav <= n;
        const b = document.createElement('button');
        b.className = 'sak' + (oppen ? '' : ' last');
        b.setAttribute('aria-pressed', String(u[k.typ] === x.id));
        b.innerHTML = '<canvas aria-hidden="true"></canvas><span class="namn"></span><span class="krav"></span>';
        b.querySelector('.namn').textContent = x.namn;
        b.querySelector('.krav').textContent = oppen ? '' : '🔒 ★ ' + x.krav;
        if (nya.includes(k.typ + ':' + x.id)) b.insertAdjacentHTML('beforeend', '<span class="ny">Ny!</span>');
        b.setAttribute('aria-label', oppen ? x.namn : `${x.namn}, låst, behöver ${x.krav} stjärnor`);
        if (oppen) b.onclick = () => { s.utseende = { ...utseende(s), [k.typ]: x.id }; spara(); visaSamling(); };
        else b.disabled = true;
        ritaMiniatyr(b.querySelector('canvas'), k.typ, x.id, u);
        grid.append(b);
      }
      yta.append(h, grid);
    }
    if (nya.length) { s.sedda = upplasta(s); spara(); }
    visa('samling');
  }
  $('#till-samling').onclick = visaSamling;
  $('#fran-samling').onclick = () => visaKarta();

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
    const nya = nyaSaker(s).length;
    $('#till-samling .bricka').hidden = !nya;
    $('#till-samling .bricka').textContent = nya;
    $('#till-samling').setAttribute('aria-label', 'Samlingen' + (nya ? `, ${nya} nya saker` : ''));
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
    vald = -1; lage = 'bygg'; sim = null; fest = [];
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
    sparPunkter.clear();
    fest = [];
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
    fest = [];
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

  // Bollarnas senaste lägen, för spåret. Var annan bildruta, ungefär en sekund bakåt.
  const sparPunkter = new Map();
  function steg(antal) {
    for (let i = 0; i < antal && lage === 'kor'; i++) {
      const r = sim.steg();
      if (sim.ruta % 2 === 0) for (const b of sim.bollar) {
        const p = sparPunkter.get(b.id) || [];
        p.push({ x: b.position.x, y: b.position.y });
        if (p.length > 30) p.shift();
        sparPunkter.set(b.id, p);
      }
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
    const hadeForut = upplasta(s);
    s.stjarnor[bana.id] = Math.max(fore, n);
    spara();
    startaFest(utseende(s).firande);
    const nytt = upplasta(s).filter((x) => !hadeForut.includes(x)).map(sakNamn);
    $('#res-nytt').hidden = !nytt.length;
    $('#res-nytt').textContent = nytt.length ? '🎁 Nytt i samlingen: ' + nytt.join(', ').replace(/, ([^,]*)$/, ' och $1') + '!' : '';
    $('#res-stjarnor').innerHTML = stjarnHtml(n);
    $('#res-stjarnor').setAttribute('aria-label', `${n} av 3 stjärnor`);
    $('#res-rubrik').textContent = n === 3 ? 'Perfekt!' : n > fore && fore ? 'Nytt rekord!' : 'Klart!';
    const [tre, tva] = bana.stjarnor;
    const anvant = `Du använde ${placerade.length === 1 ? '1 del' : placerade.length + ' delar'}.`;
    $('#res-text').textContent = n === 3 ? anvant : `${anvant} Klarar du det ${n === 2 ? delText(tre) : delText(tva)}?`;
    $('#res-farre').hidden = n === 3;
    const sist = banIndex >= banor.length - 1;
    $('#res-nasta').textContent = sist ? 'Alla banor' : 'Nästa bana';
    $('#res-karta').hidden = sist;
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
      const u = utseende(aktiv());
      ctx.save();
      ctx.translate(k.position.x, k.position.y);
      ritaSkal(ctx, r, k.position.x / r, u.boll);
      ritaHatt(ctx, r, u.hatt);
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

  /* Temabollen: ser olika ut i varje tema. c är ritytan, origo i bollens mitt. */
  function ritaTemaboll(c, r, vrid) {
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = farg.boll; c.fill();
    c.save();
    c.rotate(vrid);
    if (tema === 'lekplats') {
      c.clip();
      for (const [a, f] of [[0, farg['boll-kant']], [2.094, farg['boll-2']], [4.189, '#ffd23f']]) {
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, a, a + 1.047); c.closePath();
        c.fillStyle = f; c.fill();
      }
    } else if (tema === 'djungel') {
      c.beginPath(); c.ellipse(0, -r * 0.35, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
      c.beginPath(); c.moveTo(0, -r); c.lineTo(3, -r - 7);
      c.strokeStyle = '#3f7a3a'; c.lineWidth = 3; c.stroke();
    } else if (tema === 'oken') {
      c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      c.strokeStyle = farg['boll-kant']; c.lineWidth = 2.5; c.stroke();
    } else {
      c.beginPath(); c.moveTo(-r + 4, 0); c.lineTo(r - 4, 0);
      c.strokeStyle = farg['boll-kant']; c.lineWidth = 3; c.stroke();
    }
    c.restore();
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
    c.lineWidth = 3; c.strokeStyle = farg['boll-kant']; c.stroke();
  }

  /* ---------- Saker ur samlingen: bollar, hattar, spår och firanden ----------
     Bara utseende. Allt ritas med origo i bollens mitt och skalas efter radien. */
  const nu = () => performance.now() / 1000;
  function cirkel(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
  function stjarnform(c, x, y, R, rot, uddar = 5, inre = 0.45) {
    c.beginPath();
    for (let i = 0; i < uddar * 2; i++) {
      const a = rot - Math.PI / 2 + i * Math.PI / uddar, rr = i % 2 ? R * inre : R;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }
  function glimt(c, x, y, R) {
    const s = R * (0.6 + 0.4 * Math.sin(nu() * 5));
    stjarnform(c, x, y, s, 0, 4, 0.25); c.fillStyle = '#fff'; c.fill();
  }

  // Varje boll: fyll, klipp, mönster som rullar med vrid, kant.
  const SKAL = {
    fotboll(c, r, v) {
      cirkel(c, 0, 0, r); c.fillStyle = '#fff'; c.fill();
      c.save(); c.clip(); c.rotate(v); c.fillStyle = '#222';
      stjarnform(c, 0, 0, r * 0.34, 0, 5, 0.81); c.fill();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        stjarnform(c, Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.3, a + Math.PI / 2, 5, 0.81); c.fill();
      }
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.12; c.strokeStyle = '#222'; c.stroke();
    },
    nyckelpiga(c, r, v) {
      cirkel(c, 0, 0, r); c.fillStyle = '#e5322d'; c.fill();
      c.save(); c.clip(); c.rotate(v); c.fillStyle = '#1a1a1a';
      cirkel(c, 0, -r, r * 0.55); c.fill();
      c.fillRect(-r * 0.05, -r, r * 0.1, r * 2);
      for (const [x, y, s] of [[-0.48, -0.15, 0.17], [0.48, -0.15, 0.17], [-0.45, 0.45, 0.15], [0.45, 0.45, 0.15], [-0.2, 0.75, 0.1], [0.2, 0.75, 0.1]]) {
        cirkel(c, x * r, y * r, s * r); c.fill();
      }
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.12; c.strokeStyle = '#7a1210'; c.stroke();
    },
    planet(c, r, v) {
      const ring = (a, b) => {
        c.save(); c.rotate(-0.35); c.beginPath(); c.ellipse(0, 0, r * 1.65, r * 0.42, 0, a, b);
        c.strokeStyle = '#e9cf94'; c.lineWidth = r * 0.2; c.stroke(); c.restore();
      };
      ring(Math.PI, Math.PI * 2);                    // bakre halvan, bollen täcker mitten
      cirkel(c, 0, 0, r); c.fillStyle = '#e0a35c'; c.fill();
      c.save(); c.clip(); c.rotate(v);
      for (const [y, h, f] of [[-0.6, 0.22, '#c47f3c'], [-0.1, 0.18, '#f0c27f'], [0.35, 0.24, '#c47f3c']]) { c.fillStyle = f; c.fillRect(-r, y * r, r * 2, h * r); }
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.1; c.strokeStyle = '#a8692e'; c.stroke();
      ring(0, Math.PI);
    },
    melon(c, r, v) {
      cirkel(c, 0, 0, r); c.fillStyle = '#3aa94f'; c.fill();
      c.save(); c.clip(); c.rotate(v); c.fillStyle = '#1d6b2c';
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(i * r * 0.45, 0, r * 0.11, r * 1.1, 0, 0, Math.PI * 2); c.fill(); }
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.12; c.strokeStyle = '#155224'; c.stroke();
    },
    jorden(c, r, v) {
      cirkel(c, 0, 0, r); c.fillStyle = '#3f8fe0'; c.fill();
      c.save(); c.clip(); c.rotate(v); c.fillStyle = '#4caf50';
      for (const [x, y, a, b, w] of [[-0.4, -0.3, 0.42, 0.28, 0.4], [0.38, 0.25, 0.36, 0.3, -0.3], [0.15, -0.72, 0.28, 0.14, 0], [-0.2, 0.65, 0.3, 0.16, 0.2]]) {
        c.beginPath(); c.ellipse(x * r, y * r, a * r, b * r, w, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.12; c.strokeStyle = '#1f5fa8'; c.stroke();
    },
    glad(c, r, v) {
      cirkel(c, 0, 0, r); c.fillStyle = '#ffd23f'; c.fill();
      c.save(); c.rotate(v); c.fillStyle = '#3a2a00';
      cirkel(c, -r * 0.35, -r * 0.25, r * 0.13); c.fill();
      cirkel(c, r * 0.35, -r * 0.25, r * 0.13); c.fill();
      c.beginPath(); c.arc(0, r * 0.02, r * 0.5, Math.PI * 0.2, Math.PI * 0.8);
      c.strokeStyle = '#3a2a00'; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.12; c.strokeStyle = '#c99a00'; c.stroke();
    },
    regnbage(c, r, v) {
      const f = ['#e5484d', '#f08a24', '#ffd23f', '#2fb36d', '#3d7be8', '#8e6cd8'];
      c.save(); c.rotate(v);
      f.forEach((x, i) => { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * Math.PI / 3, (i + 1) * Math.PI / 3); c.closePath(); c.fillStyle = x; c.fill(); });
      c.restore();
      cirkel(c, 0, 0, r * 0.3); c.fillStyle = '#fff'; c.fill();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.1; c.strokeStyle = '#fff'; c.stroke();
    },
    guld(c, r, v) {
      const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#fff6c2'); g.addColorStop(0.5, '#f5c02e'); g.addColorStop(1, '#b8860b');
      cirkel(c, 0, 0, r); c.fillStyle = g; c.fill();
      c.save(); c.rotate(v); c.beginPath(); c.moveTo(-r * 0.6, 0); c.lineTo(r * 0.6, 0);
      c.strokeStyle = 'rgba(154,111,0,.5)'; c.lineWidth = r * 0.1; c.stroke(); c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.1; c.strokeStyle = '#9a6f00'; c.stroke();
      glimt(c, -r * 0.4, -r * 0.42, r * 0.38);
    },
    disco(c, r, v) {
      const ton = ['#dfe7ef', '#b9c6d3', '#8796a6', '#f5f8fb', '#a9b7c5'];
      cirkel(c, 0, 0, r); c.fillStyle = '#5d6b79'; c.fill();
      c.save(); c.clip(); c.rotate(v);
      const s = r * 0.4;
      for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) {
        c.fillStyle = ton[Math.abs(i * 7 + j * 13) % ton.length];
        c.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
      }
      c.restore();
      cirkel(c, 0, 0, r); c.lineWidth = r * 0.1; c.strokeStyle = '#5d6b79'; c.stroke();
      glimt(c, r * 0.35, -r * 0.45, r * 0.4);
    }
  };
  function ritaSkal(c, r, vrid, id) {
    if (!SKAL[id]) return ritaTemaboll(c, r, vrid);
    c.save(); SKAL[id](c, r, vrid); c.restore();
  }

  // Hattar vrids inte med bollen utan sitter alltid på toppen.
  const HATTAR = {
    keps(c, r) {
      c.beginPath(); c.arc(0, -r * 0.55, r * 0.78, Math.PI, Math.PI * 2); c.closePath();
      c.fillStyle = '#3d7be8'; c.fill();
      c.beginPath(); c.ellipse(r * 0.6, -r * 0.57, r * 0.62, r * 0.14, 0, 0, Math.PI * 2);
      c.fillStyle = '#2a5bb8'; c.fill();
      cirkel(c, 0, -r * 1.33, r * 0.12); c.fill();
    },
    party(c, r) {
      c.rotate(0.18);
      c.beginPath(); c.moveTo(-r * 0.5, -r * 0.78); c.lineTo(r * 0.5, -r * 0.78); c.lineTo(0, -r * 2.05); c.closePath();
      c.fillStyle = '#e5484d'; c.fill();
      c.save(); c.clip(); c.strokeStyle = '#ffd23f'; c.lineWidth = r * 0.16;
      for (let y = -0.85; y > -2.1; y -= 0.38) { c.beginPath(); c.moveTo(-r, y * r + r * 0.25); c.lineTo(r, y * r - r * 0.25); c.stroke(); }
      c.restore();
      cirkel(c, 0, -r * 2.05, r * 0.2); c.fillStyle = '#ffd23f'; c.fill();
    },
    krona(c, r) {
      c.beginPath();
      for (const [x, y] of [[-0.62, -0.72], [-0.62, -1.28], [-0.31, -0.98], [0, -1.48], [0.31, -0.98], [0.62, -1.28], [0.62, -0.72]]) c.lineTo(x * r, y * r);
      c.closePath(); c.fillStyle = '#f5c02e'; c.fill();
      c.lineWidth = r * 0.08; c.lineJoin = 'round'; c.strokeStyle = '#b8860b'; c.stroke();
      for (const [x, f] of [[-0.36, '#3d7be8'], [0, '#e5484d'], [0.36, '#2fb36d']]) { cirkel(c, x * r, -r * 0.88, r * 0.1); c.fillStyle = f; c.fill(); }
    },
    propeller(c, r) {
      ['#e5484d', '#ffd23f', '#2fb36d', '#3d7be8'].forEach((f, i) => {
        c.beginPath(); c.moveTo(0, -r * 0.55); c.arc(0, -r * 0.55, r * 0.8, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); c.closePath();
        c.fillStyle = f; c.fill();
      });
      c.beginPath(); c.moveTo(0, -r * 1.35); c.lineTo(0, -r * 1.68); c.strokeStyle = '#555'; c.lineWidth = r * 0.09; c.stroke();
      c.save(); c.translate(0, -r * 1.7); c.scale(Math.cos(nu() * 14), 1);
      c.fillStyle = '#e5484d';
      c.beginPath(); c.ellipse(-r * 0.45, 0, r * 0.45, r * 0.12, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3d7be8';
      c.beginPath(); c.ellipse(r * 0.45, 0, r * 0.45, r * 0.12, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      cirkel(c, 0, -r * 1.7, r * 0.1); c.fillStyle = '#555'; c.fill();
    },
    trollkarl(c, r) {
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.8);
      c.quadraticCurveTo(-r * 0.25, -r * 1.75, r * 0.5, -r * 2.2);
      c.quadraticCurveTo(r * 0.15, -r * 1.5, r * 0.6, -r * 0.8); c.closePath();
      c.fillStyle = '#6d4fc2'; c.fill();
      c.beginPath(); c.ellipse(0, -r * 0.8, r * 1.05, r * 0.22, 0, 0, Math.PI * 2); c.fillStyle = '#5b3fa8'; c.fill();
      c.fillStyle = '#ffd23f';
      stjarnform(c, -r * 0.08, -r * 1.2, r * 0.17, 0.2); c.fill();
      stjarnform(c, r * 0.18, -r * 1.65, r * 0.11, -0.3); c.fill();
    }
  };
  function ritaHatt(c, r, id) {
    if (!HATTAR[id]) return;
    c.save(); HATTAR[id](c, r); c.restore();
  }

  // Spår: punkter från äldst till nyast, i världskoordinater.
  function ritaSpar(c, pts, r, id) {
    if (pts.length < 2 || id === 'inget') return;
    const n = pts.length;
    c.save();
    if (id === 'regnbage') {
      c.lineCap = 'round';
      for (let i = 1; i < n; i++) {
        const a = i / n;
        c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y);
        c.strokeStyle = `hsl(${(i * 18 + nu() * 200) % 360} 85% 60%)`; c.globalAlpha = 0.25 + a * 0.6;
        c.lineWidth = r * (0.3 + a * 0.9); c.stroke();
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = (i + 1) / n, p = pts[i];
        if (id === 'prickar') {
          c.globalAlpha = a * 0.7; cirkel(c, p.x, p.y, r * 0.28 * (0.4 + a * 0.6)); c.fillStyle = farg['boll-kant']; c.fill();
        } else if (id === 'bubblor' && i % 2 === 0) {
          c.globalAlpha = a * 0.85; cirkel(c, p.x + Math.sin(i * 1.7) * r * 0.3, p.y - (1 - a) * r * 0.9, r * (0.12 + 0.28 * (1 - a)));
          c.strokeStyle = '#4fb3e8'; c.lineWidth = 2; c.stroke();
        } else if (id === 'stjarnor' && i % 2 === 0) {
          c.globalAlpha = a; stjarnform(c, p.x + Math.sin(i * 12.9) * r * 0.5, p.y + Math.cos(i * 7.3) * r * 0.5, r * 0.15 + r * 0.25 * a, i);
          c.fillStyle = i % 4 ? '#f5b301' : '#ffe680'; c.fill();
        }
      }
    }
    c.restore();
  }

  /* Firande när banan är klarad. Partiklar i världskoordinater; t räknas i sekunder. */
  let fest = [];
  const FEST_FARGER = ['#e5484d', '#f5c02e', '#2fb36d', '#3d7be8', '#8e6cd8', '#f08a24'];
  const valj = (a) => a[Math.floor(Math.random() * a.length)];
  function startaFest(id) {
    fest = [];
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const R = Math.random;
    const korgar = bana.foremal.filter((o) => o.typ === 'korg');
    if (id === 'ballonger') {
      for (let i = 0; i < 14; i++) fest.push({ form: 'ballong', x: 60 + R() * 880, y: 640 + R() * 160, vx: 0, vy: -2.2 - R() * 1.6, g: 0, svaj: R() * 6, farg: valj(FEST_FARGER), s: 20 + R() * 10, liv: 6, t: 0, vanta: 0 });
    } else if (id === 'fyrverkeri') {
      for (let b = 0; b < 6; b++) {
        const cx = 150 + R() * 700, cy = 70 + R() * 220, f = valj(FEST_FARGER);
        for (let j = 0; j < 44; j++) {
          const a = j / 44 * Math.PI * 2, v = 2 + R() * 4;
          fest.push({ form: 'gnista', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.05, drag: 0.97, farg: j % 5 ? f : '#fff', s: 3, liv: 1.6, t: 0, vanta: b * 0.35 });
        }
      }
    } else if (id === 'stjarnregn') {
      for (let i = 0; i < 45; i++) fest.push({ form: 'stjarna', x: R() * 1000, y: -30 - R() * 40, vx: (R() - 0.5), vy: 2 + R() * 3, g: 0.03, rot: R() * 6, vrot: (R() - 0.5) * 0.2, farg: valj(['#f5b301', '#ffd23f', '#fff3b0']), s: 8 + R() * 8, liv: 4.5, t: 0, vanta: R() * 2 });
    } else {
      for (const o of korgar) for (let i = 0; i < 60; i++) {
        fest.push({ form: 'bit', x: o.x, y: o.y - o.h, vx: (R() - 0.5) * 10, vy: -6 - R() * 9, g: 0.3, drag: 0.99, rot: R() * 6, vrot: (R() - 0.5) * 0.4, farg: valj(FEST_FARGER), s: 6 + R() * 5, liv: 2.8, t: 0, vanta: 0 });
      }
    }
  }
  function ritaPartikel(c, p, alfa) {
    c.globalAlpha = alfa;
    c.fillStyle = p.farg;
    if (p.form === 'bit') {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore();
    } else if (p.form === 'gnista') {
      cirkel(c, p.x, p.y, p.s); c.fill();
    } else if (p.form === 'stjarna') {
      stjarnform(c, p.x, p.y, p.s, p.rot); c.fill();
    } else if (p.form === 'ballong') {
      c.beginPath(); c.moveTo(p.x, p.y + p.s); c.quadraticCurveTo(p.x + 8, p.y + p.s * 1.6, p.x - 2, p.y + p.s * 2.4);
      c.strokeStyle = farg.sten; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.ellipse(p.x, p.y, p.s * 0.78, p.s, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(p.x, p.y + p.s - 2); c.lineTo(p.x - 4, p.y + p.s + 5); c.lineTo(p.x + 4, p.y + p.s + 5); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(p.x - p.s * 0.3, p.y - p.s * 0.35, p.s * 0.15, p.s * 0.25, 0.5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
    }
  }
  function ritaFest(c, dt) {
    if (!fest.length) return;
    const f = dt / (1000 / 60);
    c.save();
    fest = fest.filter((p) => {
      p.t += dt / 1000;
      const alder = p.t - p.vanta;
      if (alder < 0) return true;
      if (alder > p.liv) return false;
      if (p.drag) { p.vx *= Math.pow(p.drag, f); p.vy *= Math.pow(p.drag, f); }
      p.vy += p.g * f;
      p.x += p.vx * f + (p.form === 'ballong' ? Math.sin(p.t * 2 + p.svaj) * 0.6 * f : 0);
      p.y += p.vy * f;
      if (p.vrot) p.rot += p.vrot * f;
      ritaPartikel(c, p, 1 - Math.pow(alder / p.liv, 3));
      return true;
    });
    c.restore();
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

  function rita(dt) {
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
    if (sim) {
      const typ = utseende(aktiv()).spar;
      for (const b of sim.bollar) ritaSpar(ctx, sparPunkter.get(b.id) || [], b.circleRadius, typ);
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
    ritaFest(ctx, dt);
    ctx.restore();
  }

  /* Förhandsvisning i samlingen: bollen studsar fram och tillbaka med hatt och spår. */
  const visningsSpar = [];
  function ritaForhands() {
    const duk2 = $('#forhands');
    const box = duk2.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    if (duk2.width !== Math.round(box.width * d) || duk2.height !== Math.round(box.height * d)) {
      duk2.width = Math.round(box.width * d); duk2.height = Math.round(box.height * d);
    }
    const c = duk2.getContext('2d');
    const W = box.width, H = box.height, r = 22, golv = H - 14, t = nu();
    c.setTransform(d, 0, 0, d, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, farg.himmel); g.addColorStop(1, farg.papper);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = farg.sten; c.fillRect(0, golv, W, H - golv);
    const x = W / 2 + Math.sin(t * 1.1) * (W / 2 - 50);
    const y = golv - r - Math.abs(Math.sin(t * 3)) * (H - r * 2 - 54);
    visningsSpar.push({ x, y });
    if (visningsSpar.length > 30) visningsSpar.shift();
    const u = utseende(aktiv());
    ritaSpar(c, visningsSpar, r, u.spar);
    c.save(); c.translate(x, y); ritaSkal(c, r, x / r, u.boll); ritaHatt(c, r, u.hatt); c.restore();
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
      rita(dt);
    }
    if (!$('#samling').hidden) ritaForhands();
    requestAnimationFrame(slinga);
  }

  /* ---------- Start ---------- */
  laddaBanor().then((b) => {
    banor = b;
    if (aktiv()) sattTema(aktiv().tema);
    if (aktiv()) visaKarta(); else visaProfiler();
    requestAnimationFrame(slinga);
    startaMoln();
  }).catch(() => {
    document.body.innerHTML = '<p style="padding:24px;font-size:18px">Banorna kunde inte laddas. Starta spelet via en webbserver, till exempel med npm run serve.</p>';
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !document.getElementById('banor-data')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
