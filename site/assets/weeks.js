// Renders the 52 Weeks page and the "this week" teaser on the Lane page
// from data/weeks.json. Add ?date=YYYY-MM-DD to any URL to preview another day.
(async function () {
  const DAY = 86400000;
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const TONE = {
    Tech: "ink", Body: "ink", "Party Trick": "ink", Outdoors: "ink",
    Money: "gold", Creative: "gold", Games: "gold",
    Engineering: "wash", Faith: "wash", Social: "wash", "Life Skill": "wash",
    Mind: "paper", Music: "paper", Lifestyle: "paper",
  };

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const parse = s => new Date(s + "T00:00:00");
  const fmt = (d, o) => d.toLocaleDateString("en-US", o || { month: "short", day: "numeric" });
  const range = w => fmt(parse(w.starts)) + " to " + fmt(new Date(parse(w.starts).getTime() + 6 * DAY));

  const q = new URLSearchParams(location.search).get("date");
  const now = new Date();
  const today = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? parse(q) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let data;
  try {
    data = await (await fetch("data/weeks.json", { cache: "no-cache" })).json();
  } catch (e) {
    return;
  }
  const weeks = data.weeks;
  const first = parse(weeks[0].starts);
  const end = new Date(parse(weeks[weeks.length - 1].starts).getTime() + 7 * DAY);

  let cur = -1;
  weeks.forEach((w, i) => { if (today >= parse(w.starts)) cur = i; });
  const finished = today >= end;
  if (finished) cur = weeks.length;
  const before = cur === -1;
  const thisWeek = before ? weeks[0] : finished ? null : weeks[cur];
  const past = weeks.slice(0, Math.max(cur, 0));
  const ahead = weeks.slice(cur + 1);

  // ---------- pieces ----------
  function cover(w, note) {
    return '<div class="cover tone-' + (TONE[w.category] || "paper") + '">' +
      '<span class="cover-cat">' + esc(w.category) + "</span>" +
      '<span class="cover-title">' + esc(w.skill) + "</span>" +
      (note ? '<span class="cover-note">' + esc(note) + "</span>" : "") +
      '<span class="cover-num" aria-hidden="true">' + pad(w.week) + "</span></div>";
  }
  function thumb(w) {
    if (!w.videoId) return cover(w, "Video coming");
    return '<div class="thumb"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' +
      encodeURIComponent(w.videoId) + '/hqdefault.jpg"><span class="play">Watch</span></div>';
  }
  function video(w) {
    return '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(w.videoId) + '" title="Week ' + w.week + ": " + esc(w.skill) +
      '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
  }
  function daysIn(label) {
    if (/daily/i.test(label)) return [0, 1, 2, 3, 4, 5, 6];
    if (/before/i.test(label)) return [];
    const out = new Set();
    const rest = label.replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*-\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g, (m, a, b) => {
      for (let i = DAYS.indexOf(a); i <= DAYS.indexOf(b); i++) out.add(i);
      return "";
    });
    (rest.match(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/g) || []).forEach(d => out.add(DAYS.indexOf(d)));
    return [...out];
  }
  function planList(w, dayIdx) {
    return '<ol class="plan">' + w.plan.map(line => {
      const m = line.match(/^([^:]{2,22}):\s*(.+)$/);
      const isDay = m && /(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily)/.test(m[1]);
      if (!isDay) return '<li class="nolabel"><span>' + esc(line) + "</span></li>";
      const hit = dayIdx >= 0 && daysIn(m[1]).includes(dayIdx);
      return "<li" + (hit ? ' class="today"' : "") + '><span class="d">' + esc(m[1]) +
        "</span><span>" + esc(m[2]) + (hit ? ' <span class="sr">(today)</span>' : "") + "</span></li>";
    }).join("") + "</ol>";
  }
  function strip(el) {
    if (!el) return;
    el.innerHTML = weeks.map((w, i) => {
      const cls = i < cur ? "is-done" : i === cur ? "is-now" : "";
      return '<i class="' + cls + '" style="--i:' + i + '" title="Week ' + w.week + ": " + esc(w.skill) + '"></i>';
    }).join("");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", Math.max(cur, 0) + " of 52 weeks finished");
  }

  // ---------- Lane page teaser ----------
  const teaser = $("teaser");
  if (teaser && thisWeek) {
    const label = before
      ? "Starts Monday, " + fmt(first, { month: "long", day: "numeric" })
      : "This week · " + range(thisWeek);
    teaser.innerHTML =
      '<a class="teaser-link" href="52-weeks.html">' +
      '<span class="teaser-num">' + pad(thisWeek.week) + "</span>" +
      '<span><span class="teaser-meta">' + esc(label) + "</span>" +
      '<span class="teaser-skill">' + esc(thisWeek.skill) + "</span>" +
      '<span class="teaser-done">Done when: ' + esc(thisWeek.doneWhen) + "</span></span>" +
      '<span class="teaser-go">All 52 weeks <span aria-hidden="true">→</span></span></a>' +
      '<div class="strip" id="teaser-strip"></div>';
    teaser.hidden = false;
    strip($("teaser-strip"));
  }

  // ---------- 52 Weeks page ----------
  if (!$("now")) { window.reveal && window.reveal(); return; }

  strip($("strip"));

  const nowEl = $("now");
  if (finished) {
    nowEl.innerHTML = '<div class="now-body"><p class="now-meta">Finished</p><h2 class="now-title">All 52 weeks done.</h2></div>';
  } else {
    const w = thisWeek;
    const start = parse(w.starts);
    const sunday = new Date(start.getTime() + 6 * DAY);
    const dayIdx = before ? -1 : Math.floor((today - start) / DAY);
    let meta, foot;
    if (before) {
      const d = Math.ceil((first - today) / DAY);
      meta = "Up first · Week 01 · " + range(w);
      foot = "Starts Monday, " + fmt(start, { month: "long", day: "numeric" }) + " · " + d + (d === 1 ? " day" : " days") + " away";
    } else {
      const left = 6 - dayIdx;
      meta = "This week · Week " + pad(w.week) + " · " + range(w);
      foot = left === 0 ? "Video goes up today"
        : "Video goes up Sunday, " + fmt(sunday) + " · " + left + (left === 1 ? " day" : " days") + " left";
    }
    const media = w.videoId ? video(w) : cover(w, w.week === 1 ? "No video this week. The site is the proof." : "Video goes up Sunday");
    nowEl.innerHTML =
      '<div class="now-media reveal">' + media + "</div>" +
      '<div class="now-body reveal">' +
      '<p class="now-meta">' + esc(meta) + "</p>" +
      '<h2 class="now-title">' + esc(w.skill) + "</h2>" +
      '<p class="done-when"><b>Done when</b>' + esc(w.doneWhen) + "</p>" +
      planList(w, dayIdx) +
      '<p class="small-print"><b>Resources</b> ' + esc(w.resources) + "</p>" +
      '<p class="small-print"><b>Cost</b> ' + esc(w.cost) + "</p>" +
      '<p class="countdown">' + esc(foot) + "</p></div>";
  }

  const pastEl = $("past");
  if (!past.length) {
    pastEl.innerHTML = '<p class="empty">Nothing finished yet. Week 1 wraps up Sunday, ' + fmt(new Date(first.getTime() + 6 * DAY), { month: "long", day: "numeric" }) + ".</p>";
    pastEl.classList.remove("cards");
  } else {
    pastEl.innerHTML = past.slice().reverse().map(w =>
      '<button class="card zoom reveal" type="button" data-week="' + w.week + '">' + thumb(w) +
      '<p class="meta">Week ' + pad(w.week) + " · " + range(w) + "</p>" +
      "<h3>" + esc(w.skill) + "</h3></button>").join("");
  }
  $("past-count").textContent = past.length + " of 52";

  const aheadEl = $("ahead");
  if (!ahead.length) {
    aheadEl.innerHTML = '<p class="empty">Nothing left on the list.</p>';
  } else {
    const groups = [];
    ahead.forEach(w => {
      const label = fmt(parse(w.starts), { month: "long", year: "numeric" });
      if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
      groups[groups.length - 1].items.push(w);
    });
    aheadEl.innerHTML = groups.map(g =>
      '<div class="month reveal"><h3>' + esc(g.label) + '</h3><ul class="rows">' +
      g.items.map(w => '<li><span class="n">' + pad(w.week) + '</span><span class="s">' + esc(w.skill) +
        '</span><span class="c">' + esc(w.category) + '</span><span class="dt">' + fmt(parse(w.starts)) + "</span></li>").join("") +
      "</ul></div>").join("");
  }
  $("ahead-count").textContent = ahead.length + " to go";

  $("habits").innerHTML = data.habits.map(h =>
    '<li class="reveal"><b>' + esc(h.skill) + "</b><span>" + esc(h.doneWhen) + "</span></li>").join("");

  // ---------- dialog for finished weeks ----------
  const dlg = $("wk-dialog");
  const body = $("dlg-body");
  pastEl.addEventListener("click", e => {
    const btn = e.target.closest(".card");
    if (!btn) return;
    const w = weeks.find(x => x.week === +btn.dataset.week);
    const journal = w.journal
      ? w.journal.split(/\n\s*\n/).map(p => "<p>" + esc(p) + "</p>").join("")
      : "<p>Journal goes up with the video.</p>";
    body.innerHTML = (w.videoId ? video(w) : cover(w, "Video coming")) +
      '<p class="now-meta">Week ' + pad(w.week) + " · " + range(w) +
      (w.completedOn ? " · Finished " + fmt(parse(w.completedOn)) : "") + "</p>" +
      "<h2>" + esc(w.skill) + "</h2>" +
      '<p class="done-when"><b>Done when</b>' + esc(w.doneWhen) + "</p>" +
      '<div class="journal">' + journal + "</div>";
    dlg.showModal();
  });
  const close = () => dlg.close();
  $("dlg-x").addEventListener("click", close);
  dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
  dlg.addEventListener("close", () => { body.innerHTML = ""; });

  window.reveal && window.reveal();
})();
