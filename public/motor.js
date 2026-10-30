/* Rullverket – spelmotor.
   Bygger en Matter.js-värld av en bana (bandata) och spelarens placerade delar.
   Ingen DOM här: samma fil körs i webbläsaren och i tester med Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('matter-js'));
  else root.Motor = factory(root.Matter);
})(typeof self !== 'undefined' ? self : this, function (Matter) {
  const { Engine, Bodies, Body, Composite, Constraint, Events, Query, Vector } = Matter;

  const VARLD = { b: 1000, h: 600 };
  const SUBSTEG = 2;               // två fysiksteg per bildruta mot tunnling
  const DT = 1000 / 60 / SUBSTEG;
  const MAX_SEK = 20;              // efter så lång tid räknas bollen som fast
  const I_KORG_RUTOR = 30;         // så länge måste bollarna ligga i korgen

  // Delar som spelaren kan placera. Mått i världsenheter.
  const DELAR = {
    planka: { namn: 'Planka', b: 160, h: 16 },
    kort:   { namn: 'Kort planka', b: 90, h: 16 },
    ramp:   { namn: 'Ramp', b: 120, h: 60 },
    fjader: { namn: 'Fjäder', b: 80, h: 16, kraft: 15 },
    vikt:   { namn: 'Vikt', b: 50, h: 50 }
  };

  const rad = (g) => (g || 0) * Math.PI / 180;

  function rampHorn(b, h) {
    // Rätvinklig kil: lodrät sida till höger, sluttar ned åt vänster.
    return [{ x: -b / 2, y: h / 2 }, { x: b / 2, y: h / 2 }, { x: b / 2, y: -h / 2 }];
  }

  // Skapar kroppen för en placerad del. x,y är delens mittpunkt.
  function delKropp(typ, x, y, vinkel) {
    const d = DELAR[typ];
    let k;
    if (typ === 'ramp') {
      k = Bodies.fromVertices(0, 0, [rampHorn(d.b, d.h)], { isStatic: true, friction: 0.05 });
      // fromVertices flyttar till tyngdpunkten; lägg tillbaka mitten på x,y
      const c = { x: (k.bounds.min.x + k.bounds.max.x) / 2, y: (k.bounds.min.y + k.bounds.max.y) / 2 };
      Body.setPosition(k, { x: x + (k.position.x - c.x), y: y + (k.position.y - c.y) });
      Body.rotate(k, rad(vinkel), { x, y });
    } else if (typ === 'vikt') {
      k = Bodies.rectangle(x, y, d.b, d.h, { density: 0.02, friction: 0.4, angle: rad(vinkel) });
    } else {
      k = Bodies.rectangle(x, y, d.b, d.h, { isStatic: true, friction: 0.05, frictionStatic: 0.05, angle: rad(vinkel) });
    }
    k.rv = { roll: 'del', typ };
    return k;
  }

  // Skapar banans fasta och rörliga föremål.
  function banKroppar(bana) {
    const ut = [];
    const leder = [];
    for (const o of bana.foremal) {
      if (o.typ === 'vagg') {
        const k = Bodies.rectangle(o.x, o.y, o.b, o.h, { isStatic: true, friction: 0.05, frictionStatic: 0.05, angle: rad(o.vinkel) });
        k.rv = { roll: 'vagg' };
        ut.push(k);
      } else if (o.typ === 'boll') {
        const k = Bodies.circle(o.x, o.y, o.r || 18, { restitution: 0.25, friction: 0, frictionStatic: 0, frictionAir: 0.002, density: 0.004 });
        k.rv = { roll: 'boll' };
        ut.push(k);
      } else if (o.typ === 'lada') {
        const k = Bodies.rectangle(o.x, o.y, o.b || 50, o.h || 50, { density: o.tung ? 0.02 : 0.004, friction: 0.3, angle: rad(o.vinkel) });
        k.rv = { roll: 'lada' };
        ut.push(k);
      } else if (o.typ === 'fjader') {
        const d = DELAR.fjader;
        const k = Bodies.rectangle(o.x, o.y, d.b, d.h, { isStatic: true, friction: 0.05, frictionStatic: 0.05, angle: rad(o.vinkel) });
        k.rv = { roll: 'fjader', typ: 'fjader' };
        ut.push(k);
      } else if (o.typ === 'korg') {
        const t = 12, b = o.b, h = o.h;
        const opt = { isStatic: true, friction: 0.3, frictionStatic: 0.5 };
        const golv = Bodies.rectangle(o.x, o.y + t / 2, b + 2 * t, t, opt);
        const v = Bodies.rectangle(o.x - b / 2 - t / 2, o.y - h / 2, t, h, opt);
        const hg = Bodies.rectangle(o.x + b / 2 + t / 2, o.y - h / 2, t, h, opt);
        for (const k of [golv, v, hg]) { k.rv = { roll: 'korg' }; ut.push(k); }
      } else if (o.typ === 'gunga') {
        const l = o.b || 220;
        const k = Bodies.rectangle(o.x, o.y, l, 14, { density: 0.004, friction: 0.3, angle: rad(o.vinkel) });
        k.rv = { roll: 'gunga' };
        const fot = Bodies.polygon(o.x, o.y + 22, 3, 20, { isStatic: true, angle: -Math.PI / 2 });
        fot.rv = { roll: 'vagg', fot: true };
        fot.collisionFilter.group = -1;
        k.collisionFilter.group = -1;
        ut.push(fot, k);
        leder.push(Constraint.create({ pointA: { x: o.x, y: o.y }, bodyB: k, pointB: { x: 0, y: 0 }, stiffness: 1, length: 0 }));
      }
    }
    return { kroppar: ut, leder };
  }

  function korgInre(bana) {
    return bana.foremal.filter((o) => o.typ === 'korg').map((o) => ({
      x1: o.x - o.b / 2, x2: o.x + o.b / 2, y1: o.y - o.h, y2: o.y
    }));
  }

  // Bygger hela simuleringen. placerade = [{typ, x, y, vinkel}]
  function bygg(bana, placerade) {
    const engine = Engine.create({ positionIterations: 8, velocityIterations: 6 });
    engine.gravity.y = 1;
    const { kroppar, leder } = banKroppar(bana);
    const delar = placerade.map((p) => delKropp(p.typ, p.x, p.y, p.vinkel));
    Composite.add(engine.world, [...kroppar, ...delar, ...leder]);

    const bollar = kroppar.filter((k) => k.rv.roll === 'boll');
    const korgar = korgInre(bana);
    let ruta = 0, iKorg = 0;

    Events.on(engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        for (const [a, b] of [[p.bodyA, p.bodyB], [p.bodyB, p.bodyA]]) {
          if (a.rv && a.rv.typ === 'fjader' && !b.isStatic) {
            const n = { x: Math.sin(a.angle), y: -Math.cos(a.angle) };      // fjäderns uppåtriktning
            const sida = Vector.dot(Vector.sub(b.position, a.position), n) >= 0 ? 1 : -1;
            const nn = Vector.mult(n, sida);
            const v = b.velocity;
            const tang = Vector.sub(v, Vector.mult(nn, Vector.dot(v, nn)));
            Body.setVelocity(b, Vector.add(Vector.mult(tang, 0.9), Vector.mult(nn, DELAR.fjader.kraft)));
            b.rv.studs = (b.rv.studs || 0) + 1;
          }
        }
      }
    });

    function iNagonKorg(k) {
      return korgar.some((r) => k.position.x > r.x1 && k.position.x < r.x2 && k.position.y > r.y1 && k.position.y < r.y2);
    }

    function steg() {
      for (let i = 0; i < SUBSTEG; i++) Engine.update(engine, DT);
      ruta++;
      for (const b of bollar) {
        const p = b.position;
        if (p.y > VARLD.h + 80 || p.x < -80 || p.x > VARLD.b + 80) return { status: 'miste', orsak: 'ute' };
      }
      if (bollar.every(iNagonKorg)) iKorg++; else iKorg = 0;
      if (iKorg >= I_KORG_RUTOR) return { status: 'vann' };
      if (ruta > MAX_SEK * 60) return { status: 'miste', orsak: 'fast' };
      return { status: 'kor' };
    }

    return { engine, world: engine.world, bollar, delar, steg, korgar, get ruta() { return ruta; } };
  }

  // Index på placerade delar som ligger i vägen (överlappar bollar/lådor, eller en vikt i en vägg).
  function iVagen(bana, placerade) {
    const { kroppar } = banKroppar(bana);
    const rorliga = kroppar.filter((k) => !k.isStatic);
    const fasta = kroppar.filter((k) => k.isStatic);
    const delar = placerade.map((p) => delKropp(p.typ, p.x, p.y, p.vinkel));
    const fel = [];
    delar.forEach((d, i) => {
      let mot = rorliga.concat(delar.filter((x, j) => j !== i && !x.isStatic));
      if (!d.isStatic) mot = mot.concat(fasta, delar.filter((x, j) => j !== i));
      if (Query.collides(d, mot).length) fel.push(i);
      const bb = d.bounds;
      if (bb.max.x < 0 || bb.min.x > VARLD.b || bb.max.y < 0 || bb.min.y > VARLD.h) fel.push(i);
    });
    return [...new Set(fel)];
  }

  function stjarnor(bana, antalDelar) {
    const [tre, tva] = bana.stjarnor;
    if (antalDelar <= tre) return 3;
    if (antalDelar <= tva) return 2;
    return 1;
  }

  return { VARLD, DELAR, bygg, delKropp, banKroppar, iVagen, stjarnor, rampHorn };
});
