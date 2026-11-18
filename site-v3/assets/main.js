// Homepage: fills the current week in the 52 Skills section.
// 52-weeks.html: the full page (current week, journal, previous weeks, vote).
// Data comes from data/weeks.json. ?date=YYYY-MM-DD previews another day.
(async function () {
  const DAY = 86400000;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const parse = s => new Date(s + "T00:00:00");

  const q = new URLSearchParams(location.search).get("date");
  const n = new Date();
  const today = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? parse(q) : new Date(n.getFullYear(), n.getMonth(), n.getDate());

  let data;
  try { data = await (await fetch("data/weeks.json", { cache: "no-cache" })).json(); } catch (e) { return; }
  const weeks = data.weeks;
  let cur = -1;
  weeks.forEach((w, i) => { if (today >= parse(w.starts)) cur = i; });
  const finished = today >= new Date(parse(weeks[51].starts).getTime() + 7 * DAY);
  if (finished) cur = 52;
  const before = cur === -1;
  const w = before ? weeks[0] : finished ? weeks[51] : weeks[cur];

  const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  set("wk-now-num", "Week " + w.week);
  set("wk-now-skill", w.skill);
  // homepage link keeps ?date= so previews line up
  if (location.search) document.querySelectorAll("[data-weeks-link]").forEach(a => { a.href = "52-weeks.html" + location.search; });

  // everything below is the 52 Weeks page (52-weeks.html)
  const page = $("weeks-page");
  if (!page) return;

  // ---- 52 Weeks page (Lane's sketch) ----
  const sunday = wk => new Date(parse(wk.starts).getTime() + 6 * DAY);
  const nice = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const past = weeks.slice(0, Math.max(Math.min(cur, 52), 0));
  let shown = w;

  // ---- Media player: our own controls on top of a YouTube embed ----
  let yt = null, ytTimer = null, ytReady = false, ytQueue = null;
  const mmss = t => { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + pad(t % 60); };
  const playBtn = $("wk-ctl-play"), track = $("wk-track"), fill = $("wk-track-fill"), timeEl = $("wk-time");
  function setPlaying(on) { playBtn.classList.toggle("is-playing", on); playBtn.setAttribute("aria-label", on ? "Pause" : "Play"); }
  function resetPlayer(hasVideo) {
    clearInterval(ytTimer); yt = null; setPlaying(false);
    fill.style.width = "0"; timeEl.textContent = "0:00 / 0:00";
    $("wk-player").classList.toggle("no-video", !hasVideo);
  }
  function tick() {
    if (!yt || !yt.getDuration) return;
    const d = yt.getDuration(), t = yt.getCurrentTime();
    fill.style.width = d ? (t / d * 100) + "%" : "0";
    timeEl.textContent = mmss(t) + " / " + mmss(d);
  }
  function mountPlayer(id) {
    const make = () => {
      yt = new YT.Player("wk-iframe", { events: {
        onStateChange: e => { setPlaying(e.data === 1); },
        onReady: () => { tick(); }
      } });
      ytTimer = setInterval(tick, 300);
    };
    if (window.YT && YT.Player) make();
    else {
      window.onYouTubeIframeAPIReady = make;
      if (!document.getElementById("yt-api")) { const s = document.createElement("script"); s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s); }
    }
  }
  playBtn.addEventListener("click", () => {
    if (!yt || !yt.getPlayerState) return;
    yt.getPlayerState() === 1 ? yt.pauseVideo() : yt.playVideo();
  });
  track.addEventListener("click", e => {
    if (!yt || !yt.getDuration) return;
    const r = track.getBoundingClientRect();
    yt.seekTo(yt.getDuration() * ((e.clientX - r.left) / r.width), true); tick();
  });
  $("wk-ctl-full").addEventListener("click", () => {
    const el = $("wk-video");
    if (el.requestFullscreen) el.requestFullscreen();
  });

  function play() { return '<span class="wk-play" aria-hidden="true"></span>'; }

  function renderTop() {
    const wk = shown;
    $("wk-head").textContent = "Week " + wk.week + ": " + wk.skill;
    resetPlayer(!!wk.videoId);
    $("wk-video").innerHTML = wk.videoId
      ? '<iframe id="wk-iframe" src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(wk.videoId) + '?enablejsapi=1&controls=0&rel=0&modestbranding=1&playsinline=1" title="Week ' + wk.week + ": " + esc(wk.skill) + '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'
      : play();
    if (wk.videoId) mountPlayer(wk.videoId);
    $("wk-goal").innerHTML = '<span class="when">Goal</span>' + esc(wk.doneWhen);
    const body = wk.journal
      ? wk.journal.split(/\n\s*\n/).map(p => "<p>" + esc(p) + "</p>").join("")
      : "";
    $("wk-journal").innerHTML =
      '<div class="wk-journal-head"><span>' + esc(wk.skill) + "</span><span>" +
      nice(wk.completedOn ? parse(wk.completedOn) : sunday(wk)) + "</span></div>" +
      '<div class="wk-journal-body">' + body + "</div>" +
      '<p class="wk-sign">Lane</p>';
    document.querySelectorAll(".wk-card").forEach(c => c.classList.toggle("is-shown", +c.dataset.week === wk.week));
  }

  function renderPrev() {
    $("wk-prev").innerHTML = past.length
      ? past.slice().reverse().map(x =>
          '<button type="button" class="wk-card" data-week="' + x.week + '"><span>' +
          '<span class="wk-card-meta"><span>Wk ' + x.week + "</span><span>" + nice(parse(x.starts)) + "</span></span>" +
          '<span class="wk-card-name">' + esc(x.skill) + "</span></span>" +
          '<span class="wk-thumb">' + (x.videoId ? '<img alt="" loading="lazy" src="https://i.ytimg.com/vi/' + encodeURIComponent(x.videoId) + '/hqdefault.jpg">' : "") + play() + "</span></button>").join("")
      : '<p class="wk-empty">No previous weeks, you\'re here early! :)</p>';
  }

  // Votes are remembered in this browser only until there's a backend to count them.
  const VOTE_KEY = "lane52-vote";
  const getVote = () => { try { return localStorage.getItem(VOTE_KEY) || ""; } catch (e) { return ""; } };
  const setVote = v => { try { localStorage.setItem(VOTE_KEY, v); } catch (e) {} };
  const options = weeks.slice(Math.max(cur, 0) + 1);
  let fullList = false;

  // Fake counts that follow the planned order: next week's skill leads, then each
  // later week gets fewer. Seeded by the week so the numbers don't jump on reload.
  let seed = (Math.max(cur, 0) + 7) * 9301;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const fakeVotes = options.map((x, r) => Math.round(400 / Math.pow(r + 1.6, 1.35) * (0.92 + rand() * 0.08)) + 1);
  for (let r = 1; r < fakeVotes.length; r++) if (fakeVotes[r] > fakeVotes[r - 1]) fakeVotes[r] = fakeVotes[r - 1];
  const pct = x => {
    const mine = getVote();
    const total = fakeVotes.reduce((a, b) => a + b, 0) + (mine ? 1 : 0);
    const n = fakeVotes[options.indexOf(x)] + (mine === x.skill ? 1 : 0);
    return Math.round(n / total * 100) + "%";
  };

  function voteRow(x) {
    const on = getVote() === x.skill;
    return "<li><span>" + esc(x.skill) + '</span><span class="wk-pct">' + pct(x) + '</span><button type="button" class="wk-vote-btn' + (on ? " is-voted" : "") +
      '" data-vote="' + esc(x.skill) + '">' + (on ? "Voted" : "Vote") + "</button></li>";
  }
  function renderVote() {
    const box = $("wk-vote");
    if (!options.length) { box.innerHTML = ""; return; }
    box.classList.toggle("wk-vote-full", fullList);
    box.innerHTML = fullList
      ? '<button type="button" class="wk-vote-back" data-vote-back>&lt; back</button><ul>' + options.map(voteRow).join("") + "</ul>"
      : '<ul>' + options.slice(0, 4).map(voteRow).join("") + "</ul>" +
        '<button type="button" class="wk-link" data-full-list>see full list &rarr;</button>';
  }

  renderTop(); renderPrev(); renderVote();

  $("wk-prev").addEventListener("click", e => {
    const c = e.target.closest(".wk-card"); if (!c) return;
    shown = weeks.find(x => x.week === +c.dataset.week); renderTop();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("wk-vote").addEventListener("click", e => {
    const b = e.target.closest("[data-vote]");
    if (b) { setVote(getVote() === b.dataset.vote ? "" : b.dataset.vote); renderVote(); return; }
    if (e.target.closest("[data-vote-back]")) { fullList = false; renderVote(); }
  });

  document.addEventListener("click", e => {
    if (!e.target.closest("[data-full-list]")) return;
    e.preventDefault(); fullList = true; renderVote();
    $("wk-vote").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Back goes to where you came from on the homepage, or to its 52 Skills section
  $("weeks-back").addEventListener("click", e => {
    const r = document.referrer;
    if (r && new URL(r).origin === location.origin && /\/(index\.html)?$/.test(new URL(r).pathname)) { e.preventDefault(); history.back(); }
  });

  // reveal like the homepage sections, and the same smooth scroll
  requestAnimationFrame(() => requestAnimationFrame(() => page.classList.add("in")));
  if (window.Lenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const lenis = new Lenis({ lerp: 0.1 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
})();
