// Candle intro -> the name block focuses in the middle, glides into place, lights come on.
// One scroll hook drives the hero candles drifting and the lead sentence filling in
// word by word. Words only ever fill in; scrolling back up never un-fills them.
(function () {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const head = $("hero-head"), introCv = $("candles"), heroCv = $("hero-candles"), skipBtn = $("skip");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const UP = "#1a9e5c", DOWN = "#d64545";
  const SMOOTH = "cubic-bezier(.65,.05,.25,1)"; // eases in and out, no lurch

  // ---- hero lead: wrap each word (rises line by line, then fills in on scroll) ----
  const lead = document.querySelector(".lead");
  let words = [];
  if (lead) {
    const walker = document.createTreeWalker(lead, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement("span"); w.className = "w";
        const i = document.createElement("span"); i.textContent = part;
        w.appendChild(i); frag.appendChild(w);
      });
      n.parentNode.replaceChild(frag, n);
    });
    words = [...lead.querySelectorAll(".w")];
    const setLines = () => {
      let top = null, line = -1;
      words.forEach(w => { const t = w.offsetTop; if (top === null || Math.abs(t - top) > 4) { top = t; line++; } w.style.setProperty("--l", line); });
    };
    setLines();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setLines);
  }

  // ---- candles: a new random chart every load, always trending up ----
  // Mixed shapes: dojis, big green runs, long wicks, short red pullbacks.
  const N = 46, R = Math.random;
  function makeChart() {
    const out = []; let price = 0.15, pull = 0, vol = 1;
    for (let i = 0; i < N; i++) {
      vol = Math.min(2.4, Math.max(0.5, vol + (R() - 0.5) * 0.7));     // calm and wild stretches
      const open = price, t = R();
      let move;
      if (pull > 0) { move = -(0.03 + R() * 0.1) * vol; pull--; }         // pullback
      else if (R() < 0.24) { pull = Math.floor(R() * 4); move = -(0.03 + R() * 0.11) * vol; }
      else if (t < 0.12) move = (R() - 0.5) * 0.015;                       // doji
      else if (t < 0.34) move = (0.1 + R() * 0.14) * vol;                  // big green
      else move = (0.02 + R() * 0.08) * vol;                               // normal green
      const close = Math.max(0.03, open + move);
      let up = Math.pow(R(), 2) * 0.08 * vol, dn = Math.pow(R(), 2) * 0.08 * vol;
      const w = R();
      if (w < 0.12) dn += (0.07 + R() * 0.1) * vol;       // hammer: long lower wick
      else if (w < 0.22) up += (0.07 + R() * 0.1) * vol;  // shooting star: long upper wick
      out.push({ open, close, hi: Math.max(open, close) + up, lo: Math.max(0.005, Math.min(open, close) - dn) });
      price = close;
    }
    return out;
  }
  let candles = makeChart();
  // keep it clearly up and to the right
  for (let k = 0; k < 40 && candles[N - 1].close < 1.4; k++) candles = makeChart();
  const top = Math.max(...candles.map(c => c.hi));

  // ---- EMA lines on the closes: fast 9 and slow 21 ----
  function ema(len) {
    const k = 2 / (len + 1), out = []; let e = candles[0].close;
    candles.forEach(c => { e = c.close * k + e * (1 - k); out.push(e); });
    return out;
  }
  const EMAS = [
    { len: 9, vals: ema(9), color: "#e6b400", width: 1.75 },
    { len: 21, vals: ema(21), color: "#2f6fdb", width: 1.75 }
  ];

  function fit(cv, W, H) {
    const DPR = window.devicePixelRatio || 1, ctx = cv.getContext("2d");
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return ctx;
  }
  function drawCandles(ctx, W, H, shown, alpha) {
    ctx.clearRect(0, 0, W, H);
    const left = W * 0.06, right = W * 0.94, bottom = H * 0.9, ceil = H * 0.1;
    const step = (right - left) / N, bw = step * 0.56;
    const y = v => bottom - (v / top) * (bottom - ceil);
    const xAt = i => left + i * step + step / 2;
    const done = Math.min(N, Math.floor(shown));
    const a = i => alpha ? alpha(i) : 1;
    // EMA lines first so the candles sit on top. Each piece fades in with the candle it reaches.
    if (done > 1) {
      let solid = 0; while (solid + 1 < done && a(solid + 1) >= 1) solid++;
      ctx.lineJoin = "round";
      EMAS.forEach(m => {
        ctx.strokeStyle = m.color; ctx.lineWidth = m.width;
        if (solid > 0) {
          ctx.globalAlpha = 1; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(xAt(0), y(m.vals[0]));
          for (let i = 1; i <= solid; i++) ctx.lineTo(xAt(i), y(m.vals[i]));
          ctx.stroke();
        }
        ctx.lineCap = "butt";
        for (let i = solid + 1; i < done; i++) {
          ctx.globalAlpha = a(i);
          ctx.beginPath(); ctx.moveTo(xAt(i - 1), y(m.vals[i - 1])); ctx.lineTo(xAt(i), y(m.vals[i])); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < done; i++) {
      const c = candles[i], col = c.close >= c.open ? UP : DOWN, x = xAt(i), o = y(c.open), cl = y(c.close);
      ctx.globalAlpha = a(i); // wick and body fade together
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y(c.hi)); ctx.lineTo(x, y(c.lo)); ctx.stroke();
      ctx.fillRect(x - bw / 2, Math.min(o, cl), bw, Math.max(2, Math.abs(cl - o)));
    }
    ctx.globalAlpha = 1;
  }

  // hero background: the finished chart, faint, same size as the screen
  function paintHero() {
    if (!heroCv) return;
    const W = innerWidth, H = innerHeight;
    heroCv.style.height = H + "px";
    drawCandles(fit(heroCv, W, H), W, H, N);
  }
  paintHero();

  // ---- one scroll hook ----
  let ticking = false;
  function update() {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    if (words.length) {
      const r = lead.getBoundingClientRect();
      const p = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.45)));
      const n = Math.round(p * words.length);
      for (let i = 0; i < n; i++) words[i].classList.add("on");
    }
    if (heroCv) {
      heroCv.style.transform = "translate3d(" + (-y * 0.06).toFixed(1) + "px," + (y * 0.4).toFixed(1) + "px,0)";
      heroCv.style.opacity = (0.14 * Math.max(0, 1 - y / (vh * 0.4))).toFixed(3);
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { paintHero(); update(); });
  update();

  // ---- smooth scroll (fleerackers.com uses Lenis too) ----
  let lenis = null;
  function startScroll() {
    if (lenis || !window.Lenis || reduce) return;
    lenis = new Lenis({ lerp: 0.1 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute("href"); const el = id === "#top" ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === "#top" ? 0 : el, { offset: -70, duration: 1.4 });
    else window.scrollTo({ top: id === "#top" ? 0 : el.getBoundingClientRect().top + scrollY - 70, behavior: "smooth" });
  });

  // ---- reveals: each section plays line, title, line, then its items ----
  let revealed = false;
  function startReveals() {
    if (revealed) return; revealed = true;
    window.scrollTo(0, 0);
    document.querySelector(".hero").classList.add("in");
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".sec, .foot").forEach(el => io.observe(el));
    startScroll();
    update();
    // arriving from another page at index.html#section: jump to it
    const target = location.hash && document.querySelector(location.hash);
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + scrollY - 70);
  }

  if (!root.classList.contains("has-intro")) { startReveals(); return; }

  // ================= intro =================
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  let done = false, lit = false, raf = 0;
  const anims = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function lightsOn() {
    if (lit) return; lit = true;
    root.classList.remove("has-intro");
    try { sessionStorage.setItem("lane-intro", "1"); } catch (e) {}
    startReveals();
  }
  function land() {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    anims.forEach(a => a.cancel());
    head.style.willChange = "";
    introCv.style.display = "none";
    lightsOn();
  }
  skipBtn.addEventListener("click", land);

  const W = innerWidth, H = innerHeight;
  const ictx = fit(introCv, W, H);
  const DRAW = 3300, HOLD = 300, FADE = 280, t0 = performance.now();
  const born = []; // when each candle first showed up, so it can fade in from there
  function draw(now) {
    if (done) return;
    const t = now - t0, p = Math.min(1, t / DRAW);
    // candles fade in whole: crawls at the start, rips through the middle, crawls again at the end
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const shown = Math.floor(1 + e * (N - 1));
    for (let i = 0; i < shown; i++) if (born[i] === undefined) born[i] = now;
    drawCandles(ictx, W, H, shown, i => Math.min(1, (now - born[i]) / FADE));
    if (t < DRAW + HOLD) { raf = requestAnimationFrame(draw); return; }
    sequence();
  }
  raf = requestAnimationFrame(draw);

  async function sequence() {
    // the bright chart fades down into the faint hero chart underneath it
    anims.push(introCv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: "ease", fill: "forwards" }));

    // the name block comes into focus in the middle of the screen
    const r = head.getBoundingClientRect();
    const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2);
    const at = s => "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + s + ")";
    head.style.transformOrigin = "50% 50%";
    const appear = head.animate([
      { opacity: 0, transform: at(1.22), filter: "blur(10px)" },
      { opacity: 1, transform: at(1.3), filter: "blur(0px)" }
    ], { duration: 700, delay: 100, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    anims.push(appear);
    await appear.finished.catch(() => {});
    if (done) return;
    await wait(350);
    if (done) return;

    // then it glides into its place; the page lights up while it settles
    head.style.willChange = "transform";
    const glide = head.animate([
      { opacity: 1, transform: at(1.3) },
      { opacity: 1, transform: "translate(0px,0px) scale(1)" }
    ], { duration: 1100, easing: SMOOTH, fill: "forwards" });
    anims.push(glide);
    setTimeout(() => { if (!done) lightsOn(); }, 700);
    await glide.finished.catch(() => {});
    land();
  }
})();
