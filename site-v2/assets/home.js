// Fills the 52 WEEKS column from data/weeks.json and opens the full view on click.
// ?date=YYYY-MM-DD previews another day.
(async function () {
  const DAY = 86400000;
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const NAVY = "#0b5d3b", GOLD = "#d9bd7e", LINE = "#cddcd1";
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const parse = s => new Date(s + "T00:00:00");
  const fmt = (d, o) => d.toLocaleDateString("en-US", o || { month: "short", day: "numeric" }).toLowerCase();
  const svg = s => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);

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
  const start = parse(w.starts);
  const dayIdx = before || finished ? -1 : Math.floor((today - start) / DAY);

  // "This week" image: navy card with the week number and skill.
  function weekArt(wk) {
    const words = wk.skill.split(" "), lines = [""];
    words.forEach(x => { if ((lines[lines.length - 1] + " " + x).trim().length > 20) lines.push(x); else lines[lines.length - 1] = (lines[lines.length - 1] + " " + x).trim(); });
    return svg('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="' + NAVY + '"/>' +
      '<text x="26" y="44" font-family="Roboto, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="3" fill="' + GOLD + '">WEEK ' + pad(wk.week) + ' OF 52</text>' +
      '<text x="20" y="160" font-family="Roboto, Arial, sans-serif" font-size="110" fill="' + GOLD + '">' + pad(wk.week) + "</text>" +
      lines.map((l, i) => '<text x="26" y="' + (266 - (lines.length - 1 - i) * 32) + '" font-family="Roboto, Arial, sans-serif" font-size="26" fill="#ffffff">' + esc(l) + "</text>").join("") +
      "</svg>");
  }
  // "Full year" image: 52 squares, done / this week / ahead.
  function yearArt() {
    let cells = "";
    for (let i = 0; i < 52; i++) {
      const x = 29 + (i % 7) * 50, y = 54 + Math.floor(i / 7) * 50;
      const fill = i < cur ? NAVY : i === cur ? "#b8913f" : "#ffffff";
      cells += '<rect x="' + x + '" y="' + y + '" width="42" height="42" fill="' + fill + '" stroke="' + (i < cur || i === cur ? "none" : LINE) + '"/>';
    }
    return svg('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#eaf2ec"/>' + cells + "</svg>");
  }

  $("wk-now-img").src = weekArt(w);
  $("wk-now-img").alt = "Week " + w.week + ": " + w.skill;
  $("wk-now-cap").textContent = before ? "UP FIRST" : finished ? "FINISHED" : "THIS WEEK";
  const days = Math.ceil((start - today) / DAY);
  $("wk-now-sub").textContent = before
    ? w.skill.toLowerCase() + " . starts " + fmt(start) + " (" + days + (days === 1 ? " day" : " days") + ")"
    : w.skill.toLowerCase() + " . " + fmt(start) + " to " + fmt(new Date(start.getTime() + 6 * DAY));
  $("wk-year-img").src = yearArt();
  $("wk-year-sub").textContent = Math.max(Math.min(cur, 52), 0) + " of 52 done . click to see all →";

  const last = weeks.slice(0, Math.max(cur, 0)).reverse()[0];
  if (last && last.videoId) {
    $("wk-last-img").src = "https://i.ytimg.com/vi/" + encodeURIComponent(last.videoId) + "/hqdefault.jpg";
    $("wk-last-sub").textContent = "week " + pad(last.week) + " . " + last.skill.toLowerCase();
  } else {
    $("wk-last-sub").textContent = last ? "week " + pad(last.week) + " video coming" : "first video drops " + fmt(new Date(parse(weeks[0].starts).getTime() + 6 * DAY));
  }

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
    $("wk-goal").innerHTML = "<b>Goal:</b> " + esc(wk.doneWhen);
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
      : '<div class="wk-card is-template"><span><span class="wk-card-meta"><span>Wk 0</span><span>Dec 99</span></span>' +
        '<span class="wk-card-name">Skill name</span></span><span class="wk-thumb">' + play() + "</span></div>";
  }

  // Votes are remembered in this browser only until there's a backend to count them.
  const VOTE_KEY = "lane52-vote";
  const getVote = () => { try { return localStorage.getItem(VOTE_KEY) || ""; } catch (e) { return ""; } };
  const setVote = v => { try { localStorage.setItem(VOTE_KEY, v); } catch (e) {} };
  const options = weeks.slice(Math.max(cur, 0) + 1);
  let fullList = false;

  function voteRow(x) {
    const on = getVote() === x.skill;
    return "<li><span>" + esc(x.skill) + '</span><button type="button" class="wk-vote-btn' + (on ? " is-voted" : "") +
      '" data-vote="' + esc(x.skill) + '">' + (on ? "Voted" : "Vote") + "</button></li>";
  }
  function renderVote() {
    const box = $("wk-vote");
    if (!options.length) { box.innerHTML = ""; return; }
    box.classList.toggle("wk-vote-full", fullList);
    box.innerHTML = fullList
      ? '<button type="button" class="wk-vote-back" data-vote-back>&lt; back</button><ul>' + options.map(voteRow).join("") + "</ul>"
      : '<p class="wk-vote-label">Vote:</p><ul>' + options.slice(0, 4).map(voteRow).join("") + "</ul>" +
        '<button type="button" class="wk-link" data-full-list>see full list &rarr;</button>';
  }

  renderTop(); renderPrev(); renderVote();

  $("wk-prev").addEventListener("click", e => {
    const c = e.target.closest(".wk-card"); if (!c) return;
    shown = weeks.find(x => x.week === +c.dataset.week); renderTop();
    $("weeks-overlay").scrollTo({ top: 0, behavior: "smooth" });
  });
  $("wk-vote").addEventListener("click", e => {
    const b = e.target.closest("[data-vote]");
    if (b) { setVote(getVote() === b.dataset.vote ? "" : b.dataset.vote); renderVote(); return; }
    if (e.target.closest("[data-vote-back]")) { fullList = false; renderVote(); }
  });

  const ov = $("weeks-overlay");
  const open = () => { shown = w; renderTop(); ov.hidden = false; ov.scrollTop = 0; document.body.style.overflow = "hidden"; $("weeks-close").focus(); };
  const close = () => { ov.hidden = true; document.body.style.overflow = ""; };
  document.addEventListener("click", e => {
    if (e.target.closest("[data-full-list]")) {
      e.preventDefault(); fullList = true; renderVote();
      $("wk-vote").scrollIntoView({ behavior: "smooth", block: "center" }); return;
    }
    if (e.target.closest("[data-open-weeks]")) { e.preventDefault(); open(); }
  });
  $("weeks-close").addEventListener("click", close);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !ov.hidden) close(); });
})();
