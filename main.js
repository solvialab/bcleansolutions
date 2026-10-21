(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const body = document.body;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Zahmlené sklo: tmavý základ, ružový odlesk, opar a kvapky kondenzátu
  function paintFog(ctx, w, h, { glowImg = null, alpha = .94 } = {}) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(42, 27, 48, ${alpha})`;
    ctx.fillRect(0, 0, w, h);

    if (glowImg && 'filter' in ctx) {
      ctx.filter = 'blur(14px)';
      ctx.globalAlpha = .5;
      ctx.drawImage(glowImg, 0, 0, w, h);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    } else {
      const glow = ctx.createRadialGradient(w / 2, h * .42, 0, w / 2, h * .42, w * .6);
      glow.addColorStop(0, 'rgba(255, 79, 163, .28)');
      glow.addColorStop(1, 'rgba(255, 79, 163, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    const haze = ctx.createLinearGradient(0, 0, w, h);
    haze.addColorStop(0, 'rgba(236, 222, 231, .16)');
    haze.addColorStop(.5, 'rgba(236, 222, 231, .07)');
    haze.addColorStop(1, 'rgba(236, 222, 231, .13)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    const specks = Math.round((w * h) / 160);
    for (let i = 0; i < specks; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${rand(.03, .13)})`;
      ctx.beginPath();
      ctx.arc(rand(0, w), rand(0, h), rand(.4, 1.8), 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < specks / 40; i++) {
      const x = rand(0, w), y = rand(0, h), r = rand(2, 4.5);
      ctx.fillStyle = 'rgba(255, 255, 255, .10)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, .35)';
      ctx.beginPath(); ctx.arc(x - r * .35, y - r * .35, r * .3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function sizeCanvas(canvas) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* ---------- Loader ---------- */
  const loader = document.querySelector('.loader');
  const fog = loader.querySelector('.loader-fog');
  const blade = loader.querySelector('.squeegee');
  const spark = loader.querySelector('.loader-spark');
  const logo = loader.querySelector('.loader-logo');

  body.classList.add('is-intro');

  const pageLoaded = new Promise(res => {
    if (document.readyState === 'complete') res();
    else window.addEventListener('load', res, { once: true });
  });
  const logoReady = logo.complete ? Promise.resolve() : new Promise(res => { logo.onload = logo.onerror = res; });

  function finishLoader() {
    pageLoaded.then(() => {
      loader.classList.add('is-done');
      body.classList.remove('is-loading');
      requestAnimationFrame(() => body.classList.add('is-revealed'));
      setTimeout(() => loader.classList.add('is-gone'), 850);
      setTimeout(heroAutoWipe, 650);
    });
  }

  logoReady.then(() => {
    const { ctx, w, h } = sizeCanvas(fog);
    paintFog(ctx, w, h, { glowImg: logo, alpha: 1 });

    if (reduceMotion) {
      fog.classList.add('is-clear');
      setTimeout(finishLoader, 900);
      return;
    }

    // Tri ťahy stierkou: zľava doprava, sprava doľava, zľava doprava
    const passes = 3;
    const bandH = h / passes;
    const bladeH = bandH * 1.2;
    const START = 320, PASS = 540, GAP = 40;
    const END = START + passes * (PASS + GAP);
    blade.style.height = bladeH + 'px';
    let t0 = null;

    function frame(now) {
      if (t0 === null) t0 = now;
      const t = now - t0;
      let active = null;

      for (let i = 0; i < passes; i++) {
        const local = Math.min(1, Math.max(0, (t - START - i * (PASS + GAP)) / PASS));
        if (local <= 0) continue;
        const e = easeInOut(local);
        const ltr = i % 2 === 0;
        const x = ltr ? -24 + e * (w + 48) : w + 24 - e * (w + 48);
        const y = i * bandH - (bladeH - bandH) / 2;
        if (ltr) ctx.clearRect(0, y, Math.max(0, x), bladeH);
        else ctx.clearRect(x, y, w - x, bladeH);
        if (local < 1) active = { x, y, ltr };
      }

      if (active) {
        blade.style.opacity = 1;
        blade.classList.toggle('is-rtl', !active.ltr);
        blade.style.transform = `translate(${active.x - 6}px, ${active.y}px)`;
      } else {
        blade.style.opacity = 0;
      }

      if (t < END) requestAnimationFrame(frame);
      else {
        fog.classList.add('is-clear');
        spark.classList.add('is-on');
        setTimeout(finishLoader, 520);
      }
    }
    requestAnimationFrame(frame);
  });

  /* ---------- Hero: sklo, ktoré sa dá utrieť ---------- */
  const glassFrame = document.querySelector('.glass-frame');
  const glassFog = document.querySelector('.glass-fog');
  let glass = null;

  function setupGlass() {
    const { ctx, w, h } = sizeCanvas(glassFog);
    const tex = document.createElement('canvas');
    tex.width = glassFog.width; tex.height = glassFog.height;
    const tctx = tex.getContext('2d');
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFog(tctx, w, h);
    ctx.drawImage(tex, 0, 0, w, h);
    glass = { ctx, w, h, tex, last: null };
  }

  function wipe(x1, y1, x2, y2, width) {
    const { ctx } = glass;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function pointerPos(e) {
    const r = glassFog.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  glassFrame.addEventListener('pointermove', e => {
    if (!glass) return;
    const p = pointerPos(e);
    const from = glass.last || p;
    wipe(from.x, from.y, p.x, p.y, glass.w * .17);
    glass.last = p;
  });
  glassFrame.addEventListener('pointerleave', () => { if (glass) glass.last = null; });
  glassFrame.addEventListener('pointerdown', e => { if (glass) glass.last = pointerPos(e); });

  // Sklo sa pomaly znova zahmlí
  if (!reduceMotion) {
    setInterval(() => {
      if (!glass || document.hidden) return;
      const { ctx, w, h, tex } = glass;
      ctx.save();
      ctx.globalAlpha = .03;
      ctx.drawImage(tex, 0, 0, w, h);
      ctx.restore();
    }, 90);
  }

  function heroAutoWipe() {
    if (!glass) return;
    const { w, h } = glass;
    if (reduceMotion) {
      wipe(w * .08, h * .5, w * .92, h * .5, h * .2);
      return;
    }
    const dur = 1000;
    let t0 = null, prev = { x: -w * .1, y: h * .56 };
    function step(now) {
      if (t0 === null) t0 = now;
      const k = easeInOut(Math.min(1, (now - t0) / dur));
      const p = { x: -w * .1 + k * w * 1.2, y: h * .56 - k * h * .1 };
      wipe(prev.x, prev.y, p.x, p.y, h * .2);
      prev = p;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  setupGlass();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupGlass, 200);
  });

  /* ---------- Header ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobilné menu ---------- */
  const burger = document.querySelector('.burger');
  const menu = document.getElementById('mobile-menu');
  let menuTimer;

  function setMenu(open) {
    clearTimeout(menuTimer);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Zavrieť menu' : 'Otvoriť menu');
    body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    } else {
      menu.classList.remove('is-open');
      menuTimer = setTimeout(() => { menu.hidden = true; }, reduceMotion ? 0 : 500);
    }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* ---------- Kalkulačka ---------- */
  const MIN_ORDER = 50;
  const RATES = { basic: 1.2, deep: 2.4, paint: 3.0, window: 7, office: 1.0 };

  const eur = (n, decimals = 0) => new Intl.NumberFormat('sk-SK', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(n);
  const rate = n => eur(n, Number.isInteger(n) ? 0 : 2);
  const windowsWord = n => (n === 1 ? 'okno' : n >= 2 && n <= 4 ? 'okná' : 'okien');

  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const panels = [...document.querySelectorAll('.panel')];
  const receipt = {
    title: document.querySelector('[data-r="title"]'),
    lines: document.querySelector('[data-r="lines"]'),
    total: document.querySelector('[data-r="total"]'),
    note: document.querySelector('[data-r="note"]'),
    send: document.querySelector('[data-r="send"]')
  };
  let current = 'home';
  let lastQuote = null;

  const panel = key => panels.find(p => p.dataset.panel === key);
  const val = id => Number(document.getElementById(id).value);

  function flatExtras(p) {
    return [...p.querySelectorAll('input[data-extra]:checked')]
      .map(i => [i.dataset.extra, Number(i.dataset.price)]);
  }
  function stepperLines(p) {
    return [...p.querySelectorAll('.stepper')]
      .map(s => ({ s, n: Number(s.querySelector('output').value || s.querySelector('output').textContent) }))
      .filter(({ n }) => n > 0)
      .map(({ s, n }) => [`${s.dataset.name} × ${n}`, n * Number(s.dataset.price)]);
  }

  const quotes = {
    home() {
      const p = panel('home'), m2 = val('home-m2');
      const deep = p.querySelector('input[name="home-type"]:checked').value === 'deep';
      const r = deep ? RATES.deep : RATES.basic;
      return {
        title: deep ? 'Generálne upratovanie' : 'Upratovanie domácnosti',
        service: deep ? 'Generálne upratovanie' : 'Upratovanie domácnosti',
        lines: [[`${m2} m² × ${rate(r)}`, m2 * r], ...flatExtras(p)]
      };
    },
    paint() {
      const p = panel('paint'), m2 = val('paint-m2');
      const perM2 = [...p.querySelectorAll('input[data-extra-m2]:checked')]
        .map(i => [`${i.dataset.extraM2}, ${m2} m² × ${rate(Number(i.dataset.price))}`, m2 * Number(i.dataset.price)]);
      return {
        title: 'Upratovanie po maľovaní',
        service: 'Upratovanie po maľovaní',
        lines: [[`${m2} m² × ${rate(RATES.paint)}`, m2 * RATES.paint], ...perM2, ...flatExtras(p)]
      };
    },
    sofa() {
      const p = panel('sofa');
      const sofa = p.querySelector('input[name="sofa-type"]:checked');
      const lines = [];
      if (Number(sofa.value) > 0) lines.push([sofa.dataset.name, Number(sofa.value)]);
      return {
        title: 'Tepovanie sedačiek',
        service: 'Tepovanie sedačiek',
        lines: [...lines, ...stepperLines(p), ...flatExtras(p)]
      };
    },
    windows() {
      const p = panel('windows'), n = val('win-count');
      const per = [...p.querySelectorAll('input[data-extra-per]:checked')]
        .map(i => [`${i.dataset.extraPer}, ${n} × ${rate(Number(i.dataset.price))}`, n * Number(i.dataset.price)]);
      return {
        title: 'Umývanie okien',
        service: 'Umývanie okien',
        lines: [[`${n} ${windowsWord(n)} × ${rate(RATES.window)}`, n * RATES.window], ...stepperLines(p), ...per]
      };
    },
    office() {
      const p = panel('office'), m2 = val('office-m2');
      const weekly = p.querySelector('input[name="office-freq"]:checked').value === 'weekly';
      const base = m2 * RATES.office;
      const lines = [[`${m2} m² × ${rate(RATES.office)}`, base]];
      if (weekly) lines.push(['Zľava za pravidelnosť −10 %', -base * .1]);
      return {
        title: 'Upratovanie kancelárie',
        service: 'Upratovanie kancelárie',
        lines,
        note: weekly ? 'Cena za jedno upratanie. Rozpis dohodneme podľa vašej prevádzky.' : null
      };
    }
  };

  function render() {
    const q = quotes[current]();
    let sum = q.lines.reduce((a, [, v]) => a + v, 0);
    if (sum > 0 && sum < MIN_ORDER) {
      q.lines.push(['Doplnok do minimálnej objednávky', MIN_ORDER - sum]);
      sum = MIN_ORDER;
    }
    const total = Math.round(sum);

    receipt.title.textContent = q.title;
    receipt.lines.innerHTML = '';
    for (const [label, v] of q.lines) {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = label;
      const dots = document.createElement('i');
      const b = document.createElement('b'); b.textContent = eur(v, Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2);
      li.append(a, dots, b);
      receipt.lines.append(li);
    }
    if (!q.lines.length) {
      const li = document.createElement('li');
      li.textContent = 'Vyberte aspoň jednu položku.';
      receipt.lines.append(li);
    }
    receipt.total.textContent = eur(total);
    receipt.note.textContent = q.note || 'Doprava v rámci Bratislavy je v cene. Minimálna objednávka je 50 €.';
    receipt.send.disabled = total === 0;
    lastQuote = { ...q, total };
  }

  function updateRange(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--p', pct + '%');
    const out = document.querySelector(`[data-out="${input.id}"]`);
    if (out) out.textContent = input.value;
    const unit = document.querySelector(`[data-unit="${input.id}"]`);
    if (unit) unit.textContent = windowsWord(Number(input.value));
  }

  document.querySelectorAll('input[type="range"]').forEach(r => {
    updateRange(r);
    r.addEventListener('input', () => { updateRange(r); render(); });
  });
  document.querySelectorAll('.panel input:not([type="range"])').forEach(i => i.addEventListener('change', render));
  document.querySelectorAll('.stepper').forEach(s => {
    const [minus, plus] = s.querySelectorAll('button');
    const out = s.querySelector('output');
    const set = n => { out.value = out.textContent = String(Math.max(0, Math.min(20, n))); render(); };
    minus.addEventListener('click', () => set(Number(out.textContent) - 1));
    plus.addEventListener('click', () => set(Number(out.textContent) + 1));
  });

  function selectTab(btn) {
    current = btn.dataset.tab;
    tabs.forEach(t => {
      const on = t === btn;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(p => { p.hidden = p.dataset.panel !== current; });
    render();
  }
  tabs.forEach((t, i) => {
    t.tabIndex = i === 0 ? 0 : -1;
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });
  render();

  /* ---------- Formulár ---------- */
  const form = document.getElementById('form');
  const status = form.querySelector('.form-status');

  // Termín: od zajtra najviac rok dopredu
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const minDay = new Date(); minDay.setDate(minDay.getDate() + 1);
  const maxDay = new Date(); maxDay.setFullYear(maxDay.getFullYear() + 1);
  form.termin.min = isoDate(minDay);
  form.termin.max = isoDate(maxDay);
  const dateOk = v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= form.termin.min && v <= form.termin.max);
  // Telefón je nepovinný; ak je vyplnený, 9 až 15 číslic, voliteľne s + na začiatku
  const phoneOk = v => !v.trim() || /^\+?[\d\s\/-]{9,20}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 9 && v.replace(/\D/g, '').length <= 15;
  form.termin.addEventListener('change', () => form.termin.classList.toggle('is-invalid', !dateOk(form.termin.value)));

  receipt.send.addEventListener('click', () => {
    if (!lastQuote) return;
    const items = lastQuote.lines.map(([l, v]) => `- ${l}: ${eur(v, Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2)}`).join('\n');
    form.sluzba.value = lastQuote.service;
    form.sprava.value = `Dobrý deň, mám záujem o: ${lastQuote.title}\n${items}\nOrientačná cena z kalkulačky: ${eur(lastQuote.total)}\n\n`;
    document.getElementById('kontakt').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => form.meno.focus({ preventScroll: true }), 600);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'form-status';
    let firstBad = null;
    const check = (el, ok) => {
      el.classList.toggle('is-invalid', !ok);
      if (!ok && !firstBad) firstBad = el;
    };
    check(form.meno, form.meno.value.trim().length > 1);
    check(form.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()));
    const basicBad = firstBad;
    check(form.telefon, phoneOk(form.telefon.value));
    check(form.termin, dateOk(form.termin.value) && !form.termin.validity.badInput);
    check(form.sprava, form.sprava.value.trim().length > 3);
    const consent = form.suhlas;
    consent.closest('.consent').classList.toggle('is-invalid', !consent.checked);
    if (!consent.checked && !firstBad) firstBad = consent;

    if (firstBad) {
      const fmtDay = d => d.toLocaleDateString('sk-SK');
      status.textContent =
        !basicBad && firstBad === form.telefon ? 'Telefónne číslo zadajte v tvare +421 9xx xxx xxx alebo 09xx xxx xxx.' :
        !basicBad && firstBad === form.termin ? `Termín vyberte v rozmedzí ${fmtDay(minDay)} až ${fmtDay(maxDay)}.` :
        'Doplňte meno, platný e-mail, správu a súhlas so spracovaním údajov.';
      status.classList.add('is-err');
      firstBad.focus();
      return;
    }
    if (form._honey.value) { status.textContent = 'Dopyt odoslaný.'; return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Odosielam…';
    const data = Object.fromEntries(new FormData(form));
    delete data._honey;
    data.suhlas = 'áno';
    data._subject = `Nový dopyt z webu: ${data.sluzba}`;
    data._template = 'table';
    data._captcha = 'false';

    try {
      const res = await fetch('https://formsubmit.co/ajax/bclean.solutions.sk@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = 'Dopyt odoslaný. Ozveme sa vám do 24 hodín.';
      status.classList.add('is-ok');
    } catch {
      status.innerHTML = 'Dopyt sa nepodarilo odoslať. Napíšte nám priamo na <a href="mailto:bclean.solutions.sk@gmail.com">bclean.solutions.sk@gmail.com</a>.';
      status.classList.add('is-err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Odoslať dopyt';
    }
  });
  form.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', () => el.classList.remove('is-invalid')));

  document.getElementById('year').textContent = new Date().getFullYear();
})();
