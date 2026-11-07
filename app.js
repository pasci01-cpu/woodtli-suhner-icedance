(() => {
  "use strict";

  const FLAGS = { SUI:"CH", LAT:"LV", POL:"PL", EST:"EE", THA:"TH", ITA:"IT", GER:"DE", AUT:"AT", FRA:"FR", CRO:"HR", HUN:"HU", CZE:"CZ", SVK:"SK", SLO:"SI", NED:"NL", BEL:"BE", ESP:"ES", AND:"AD", GBR:"GB", FIN:"FI", SWE:"SE", NOR:"NO", DEN:"DK", BUL:"BG", ROU:"RO", TUR:"TR", LTU:"LT", UKR:"UA", USA:"US", CAN:"CA", JPN:"JP", KOR:"KR", CHN:"CN", AZE:"AZ", GEO:"GE", ARM:"AM", SRB:"RS", BIH:"BA", ISL:"IS", LUX:"LU", MON:"MC", IRL:"IE", POR:"PT", GRE:"GR", ISR:"IL", AUS:"AU", NZL:"NZ", MEX:"MX", BRA:"BR", ARG:"AR", TPE:"TW", HKG:"HK", PHI:"PH", MAS:"MY", SGP:"SG", INA:"ID", KAZ:"KZ", UZB:"UZ" };
  const flag = (c) => { const a = FLAGS[c]; return a ? String.fromCodePoint(...[...a].map(ch => 127397 + ch.charCodeAt(0))) : ""; };
  const SERIES = [
    { key: "total", label: "Total",        css: "--series-1" },
    { key: "fd",    label: "Free Dance",   css: "--series-2" },
    { key: "rd",    label: "Rhythm Dance", css: "--series-3" },
  ];
  const TYPES = ["All", "ISU", "International", "National"];
  const typeGroup = (t) => (t === "JGP" || t === "ISU Championship") ? "ISU" : t;
  const fmt = (n) => (n == null || isNaN(n)) ? "–" : Number(n).toFixed(2);
  const ord = (n) => { if (n == null) return "–"; const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const dfmt = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const range = (a, b) => {
    if (!a) return ""; if (!b || a === b) return dfmt(a);
    const A = new Date(a + "T12:00:00"), B = new Date(b + "T12:00:00");
    const sameM = A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear();
    return sameM ? `${A.getDate()}–${dfmt(b)}` : `${A.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – ${dfmt(b)}`;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const $ = (id) => document.getElementById(id);

  const state = { season: "All", type: "All", level: "All", view: "cards", hidden: new Set(), sort: { key: "start", dir: 1 } };
  let DATA = null;
  const SCALE = { rd: 75, fd: 110, pd: 40 }; // bar length scale, adjusted to the data in init()

  function seg(c, name) {
    const s = (c.segments || []).find(x => x.name && x.name.toLowerCase().startsWith(name));
    return s || null;
  }
  function norm(c) {
    const rd = seg(c, "rhythm"), fd = seg(c, "free");
    const rdOnly = !!rd && !fd && c.total != null; // didn't qualify for the free dance
    return { ...c, rd, fd, rdOnly, rdScore: rd?.score ?? null, fdScore: fd?.score ?? null, fullTotal: rdOnly ? null : c.total };
  }

  const multiLevel = () => DATA.levels.length > 1;
  // ISU personal best: the official value from the ISU bio (includes Challenger Series events), else computed from ISU events
  function isuBest(list) {
    const off = DATA.athletes?.isu_personal_bests?.total;
    if (off && off.score != null) {
      const c = list.find(x => x.fullTotal != null && Math.abs(x.fullTotal - off.score) < 0.005);
      if (c) return { v: off.score, c };
      if (list === DATA.competitions) return null;
    }
    return bestOf(list.filter(c => typeGroup(c.type) === "ISU"), c => c.fullTotal);
  }

  function filtered() {
    return DATA.competitions.filter(c =>
      (state.season === "All" || c.season === state.season) &&
      (state.type === "All" || typeGroup(c.type) === state.type) &&
      (state.level === "All" || c.level === state.level));
  }

  function bestOf(list, getter) {
    let best = null;
    for (const c of list) { const v = getter(c); if (v != null && (!best || v > best.v)) best = { v, c }; }
    return best;
  }

  /* ---------- Hero stats ---------- */
  function renderStats() {
    const all = DATA.competitions;
    const isu = all.filter(c => typeGroup(c.type) === "ISU");
    const podiums = all.filter(c => c.place && c.place <= 3).length;
    const wins = all.filter(c => c.place === 1).length;
    const pb = bestOf(all, c => c.fullTotal);
    const isuPb = isuBest(all);
    const champs = all.filter(c => c.type === "National" && /championship/i.test(c.short || c.name) && c.place === 1);
    const titles = champs.length;
    const lv = [...new Set(champs.map(c => (c.level || "").toLowerCase()).filter(Boolean))];
    const titleSub = lv.length === 1 ? `${lv[0]} champions` : "national champions";
    $("stats").innerHTML = [
      { l: "Competitions", v: all.length, s: `${DATA.seasons.length} seasons` },
      { l: "Podiums", v: podiums, s: `${wins} win${wins === 1 ? "" : "s"}` },
      { l: "Best total", v: pb ? fmt(pb.v) : "–", s: pb ? pb.c.short || pb.c.name : "" },
      { l: "ISU best", v: isuPb ? fmt(isuPb.v) : "–", s: isuPb ? isuPb.c.short || isuPb.c.name : "" },
      { l: "Swiss titles", v: titles, s: titleSub },
    ].map(x => `<div class="stat"><div class="l">${x.l}</div><div class="v">${x.v}</div><div class="s" data-full="${esc(x.s)}">${esc(x.s)}</div></div>`).join("");
  }

  /* ---------- Filters ---------- */
  function renderFilters() {
    const mk = (el, items, cur, onPick) => {
      el.innerHTML = items.map(i => `<button role="tab" aria-selected="${i === cur}" class="${i === cur ? "on" : ""}" data-v="${esc(i)}">${esc(i === "All" && el.id === "seasonFilter" ? "All seasons" : i === "All" && el.id === "levelFilter" ? "All levels" : i === "All" ? "All types" : i)}</button>`).join("");
      el.onclick = (e) => { const b = e.target.closest("button"); if (b) { onPick(b.dataset.v); render(); } };
    };
    mk($("seasonFilter"), ["All", ...DATA.seasons], state.season, v => state.season = v);
    mk($("typeFilter"), TYPES, state.type, v => state.type = v);
    const lf = $("levelFilter");
    if (DATA.levels.length > 1) { lf.hidden = false; mk(lf, ["All", ...DATA.levels], state.level, v => state.level = v); }
  }

  /* ---------- Chart ---------- */
  function renderLegend() {
    $("legend").innerHTML = SERIES.map(s =>
      `<button data-k="${s.key}" class="${state.hidden.has(s.key) ? "off" : ""}" aria-pressed="${!state.hidden.has(s.key)}"><span class="sw" style="background:var(${s.css})"></span>${s.label}</button>`).join("");
    $("legend").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const k = b.dataset.k;
      if (state.hidden.has(k)) state.hidden.delete(k); else if (state.hidden.size < SERIES.length - 1) state.hidden.add(k);
      renderLegend(); renderChart();
    };
  }

  function renderChart() {
    const list = filtered().filter(c => c.total != null || c.rdScore != null || c.fdScore != null);
    const el = $("chart");
    if (!list.length) { el.innerHTML = `<div class="empty">No scored competitions for this filter.</div>`; return; }
    const n0 = list.length, cw = el.clientWidth || 900, narrow = cw < 640;
    // On phones the chart keeps readable text and scrolls sideways instead of shrinking
    const W = narrow ? Math.max(cw, 150 + n0 * 46) : Math.max(640, cw), H = n0 > 8 ? 370 : 320;
    const m = { t: 34, r: 92, b: n0 > 8 ? 96 : 54, l: n0 > 8 ? 112 : 44 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const series = SERIES.filter(s => !state.hidden.has(s.key));
    const val = (c, k) => k === "total" ? c.fullTotal : k === "rd" ? c.rdScore : c.fdScore;
    const vals = list.flatMap(c => series.map(s => val(c, s.key))).filter(v => v != null);
    let lo = Math.floor((Math.min(...vals) - 6) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
    lo = Math.max(0, lo);
    const n = list.length;
    const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const step = (hi - lo) > 80 ? 20 : 10;

    let g = "", ax = "";
    // season bands
    const seasons = [];
    list.forEach((c, i) => { const last = seasons[seasons.length - 1]; if (!last || last.s !== c.season) seasons.push({ s: c.season, a: i, b: i }); else last.b = i; });
    const half = n > 1 ? iw / (n - 1) / 2 : iw / 2;
    seasons.forEach((s, k) => {
      const x0 = Math.max(m.l - 12, x(s.a) - half), x1 = Math.min(m.l + iw + 12, x(s.b) + half);
      if (k % 2 === 0) g += `<rect class="season-band" x="${x0}" y="${m.t - 22}" width="${x1 - x0}" height="${ih + 22}" rx="8"/>`;
      g += `<text class="season-lbl" x="${(x0 + x1) / 2}" y="${m.t - 8}" text-anchor="middle">${esc(s.s)}</text>`;
    });
    for (let v = lo; v <= hi; v += step) {
      g += `<line class="grid" x1="${m.l}" x2="${m.l + iw}" y1="${y(v)}" y2="${y(v)}"/>`;
      ax += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    list.forEach((c, i) => {
      const lbl = (c.short || c.name).replace(/\s+20\d\d$/, "").replace(/Swiss Junior Championships/, "Swiss Champs");
      const cut = lbl.length > 18, t = esc(cut ? lbl.slice(0, 17) + "…" : lbl), pl = c.place ? ord(c.place) : "";
      const full = cut ? ` data-full="${esc(c.name)}" class="cut"` : "";
      if (n > 8) g += `<text${full} transform="translate(${x(i) + 4},${H - m.b + 16}) rotate(-35)" text-anchor="end">${t}<tspan class="lbl" dx="5" style="font-size:11px">${pl}</tspan></text>`;
      else g += `<text${full} x="${x(i)}" y="${H - m.b + 20}" text-anchor="middle">${t}</text><text x="${x(i)}" y="${H - m.b + 36}" text-anchor="middle" style="font-size:11px">${pl}</text>`;
    });
    const surface = cssVar("--surface-1");
    for (const s of series) {
      const color = cssVar(s.css);
      let d = "", pen = false;
      list.forEach((c, i) => { const v = val(c, s.key); if (v == null) { if (!c.rdOnly) pen = false; return; } d += `${pen ? "L" : "M"}${x(i)},${y(v)}`; pen = true; });
      g += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      list.forEach((c, i) => { const v = val(c, s.key); if (v == null) return;
        const lv = multiLevel() ? (c.level || "") : "";
        g += /novice/i.test(lv) ? `<rect x="${x(i) - 4}" y="${y(v) - 4}" width="8" height="8" rx="1.5" fill="${surface}" stroke="${color}" stroke-width="2.5"/>`
           : lv === "Junior" && DATA.levels.includes("Senior") ? `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="${surface}" stroke="${color}" stroke-width="2.5"/>`
           : `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="${color}" stroke="${surface}" stroke-width="2"/>`; });
      // direct label at last point
      for (let i = n - 1; i >= 0; i--) { const v = val(list[i], s.key); if (v != null) { g += `<text class="lbl" x="${x(i) + 10}" y="${y(v) + 4}">${s.label}</text>`; break; } }
      // PB marker
      const b = bestOf(list, c => val(c, s.key));
      if (b) { const i = list.indexOf(b.c); g += `<text class="lbl" x="${x(i)}" y="${y(b.v) - 10}" text-anchor="middle">${fmt(b.v)}</text>`; }
    }
    g += `<line id="cross" class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
    list.forEach((c, i) => {
      const w = n === 1 ? iw : iw / (n - 1);
      g += `<rect data-i="${i}" x="${x(i) - w / 2}" y="${m.t}" width="${w}" height="${ih}" fill="transparent"/>`;
    });
    // On phones the y-axis stays fixed while the plot scrolls
    if (!narrow) g = ax + g;
    el.innerHTML = `<div class="chart-scroll"><svg viewBox="0 0 ${W} ${H}" ${narrow ? `width="${W}" height="${H}"` : ""} role="img" aria-label="Score progression chart">${g}</svg></div>${narrow ? `<svg class="yaxis" width="${m.l}" height="${H}" style="width:${m.l}px;height:${H}px" aria-hidden="true">${ax}</svg>` : ""}${narrow && W > cw ? `<p class="swipe-hint">← swipe for earlier events</p>` : ""}`;
    if (narrow) { const sc = el.querySelector(".chart-scroll"); sc.scrollLeft = sc.scrollWidth; }
    const notes = [];
    if (multiLevel()) notes.push(DATA.levels.map(l => (/novice/i.test(l) ? "□ " : l === "Junior" && DATA.levels.includes("Senior") ? "○ " : "● ") + l.toLowerCase()).join(" · "));
    if (list.some(c => c.rdOnly)) notes.push("Events where they skated only the rhythm dance have no total or free dance point");
    $("chartCaption").textContent = "Total, free dance and rhythm dance scores per competition" + (notes.length ? ". " + notes.join(". ") + "." : "");

    const svg = el.querySelector(".chart-scroll svg"), cross = svg.querySelector("#cross"), tip = $("tooltip");
    svg.addEventListener("mousemove", (e) => {
      const r = e.target.closest("rect[data-i]"); if (!r) return;
      const i = +r.dataset.i, c = list[i];
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      tip.innerHTML = `<div class="t">${flag(c.country)} ${esc(c.name)}</div><div class="d">${range(c.start, c.end)} · ${c.place ? ord(c.place) + " place" : "place n/a"}${multiLevel() ? " · " + esc(c.level) : ""}${c.rdOnly ? "<br>Rhythm dance only: not in the top 20 for the free dance" : ""}</div>` +
        SERIES.map(s => `<div class="r"><span><i class="sw" style="background:var(${s.css})"></i>${s.label}</span><b>${fmt(val(c, s.key))}</b></div>`).join("");
      tip.hidden = false;
      const tx = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 16));
      const ty = e.clientY - tip.offsetHeight - 12;
      tip.style.left = tx + "px"; tip.style.top = (ty < 8 ? e.clientY + 16 : ty) + "px";
    });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
    let lastTap = -1;
    const coarse = matchMedia("(pointer: coarse)").matches;
    svg.addEventListener("click", (e) => {
      const r = e.target.closest("rect[data-i]"); if (!r) return;
      if (coarse && lastTap !== +r.dataset.i) { lastTap = +r.dataset.i; return; } // first tap: tooltip only
      lastTap = -1; tip.hidden = true;
      const card = document.querySelector(`[data-id="${CSS.escape(list[+r.dataset.i].id)}"]`);
      if (card) { card.classList.add("open"); card.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  /* ---------- Personal bests ---------- */
  function renderBests() {
    const list = filtered();
    const isu = list.filter(c => typeGroup(c.type) === "ISU");
    const card = (k, css, b, note) => `<div class="card best"><div class="k">${css ? `<span class="sw" style="background:var(${css})"></span>` : ""}${k}</div>
      <div class="v">${b ? fmt(b.v) : "–"}</div><div class="w">${b ? `${flag(b.c.country)} ${esc(b.c.name)}` : "No data"}</div><div class="i">${b ? dfmt(b.c.start) : ""}${note ? " · " + note : ""}</div></div>`;
    $("bests").innerHTML =
      card("Best total", "--series-1", bestOf(list, c => c.fullTotal), "any event") +
      card("Best free dance", "--series-2", bestOf(list, c => c.fdScore), "") +
      card("Best rhythm dance", "--series-3", bestOf(list, c => c.rdScore), "") +
      card("ISU personal best", null, isuBest(list), "ISU-recognised events");
  }

  /* ---------- List ---------- */
  function pbIds() { const b = isuBest(DATA.competitions); return new Set(b ? [b.c.id] : []); }

  const ytId = (u) => (u || "").match(/[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/)?.slice(1).find(Boolean);
  const playBtn = (s, c, label, cls = "play") => s && s.video
    ? `<button class="${cls}" data-video="${esc(s.video)}" data-title="${esc(label + " · " + c.name)}" aria-label="Watch ${esc(label)} on video" title="Watch ${esc(label)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.8v10.4L13 8z" fill="currentColor"/></svg>${cls === "play" ? "Watch" : esc(label)}</button>` : "";

  const IG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>`;
  const igLink = (c, cls = "ig") => (c.instagram || []).length
    ? `<a class="${cls}" href="${esc(c.instagram[0].url)}" target="_blank" rel="noopener" title="Instagram post${c.instagram.length > 1 ? "s" : ""} about ${esc(c.name)}">${IG_ICON}${cls === "ig" ? `Instagram${c.instagram.length > 1 ? ` · ${c.instagram.length}` : ""}` : ""}</a>` : "";
  const igList = (c) => (c.instagram || []).length ? `<div class="iglist"><div class="k">On Instagram</div>${c.instagram.map(p => `
      <a class="igpost" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="igav">${IG_ICON}</span><span><b>@${esc(p.account)}</b> <span class="muted">· ${dfmt(p.date)}</span><br>${esc(p.caption)}</span><span class="go">↗</span></a>`).join("")}</div>` : "";

  function segBar(label, s, css, max, c) {
    if (!s) return "";
    const pct = s.score ? Math.min(100, (s.score / max) * 100) : 0;
    const tes = s.tes != null && s.score ? (s.tes / s.score) * pct : null;
    const track = tes != null
      ? `<i style="width:${tes}%;background:var(${css})"></i><i style="width:${pct - tes}%;background:var(${css});opacity:.55"></i>`
      : `<i style="width:${pct}%;background:var(${css})"></i>`;
    return `<div class="segbar"><div class="top"><span>${label}${s.place ? ` · ${ord(s.place)}` : ""}${playBtn(s, c, label)}</span><b>${fmt(s.score)}</b></div><div class="track" title="${s.tes != null ? `TES ${fmt(s.tes)} · PCS ${fmt(s.pcs)}` : ""}">${track}</div></div>`;
  }

  function renderCards(list) {
    const pbs = pbIds();
    const bySeason = [];
    list.forEach(c => { const l = bySeason[bySeason.length - 1]; if (!l || l.s !== c.season) bySeason.push({ s: c.season, items: [c] }); else l.items.push(c); });
    return bySeason.reverse().map(g => `
      <div class="season-h"><h3>Season ${esc(g.s)}</h3><div class="line"></div><span class="cnt">${g.items.length} event${g.items.length === 1 ? "" : "s"}</span></div>
      ${g.items.slice().reverse().map(c => {
        const p = c.place;
        const segRows = (c.segments || []).map(s => `<tr><td>${esc(s.name)}</td><td>${s.place ? ord(s.place) : "–"}</td><td>${fmt(s.score)}</td><td>${fmt(s.tes)}</td><td>${fmt(s.pcs)}</td><td>${s.deductions ? "-" + fmt(Math.abs(s.deductions)) : "0.00"}</td><td>${s.video ? `<a href="${esc(s.video)}" target="_blank" rel="noopener">YouTube ↗</a>` : ""}</td></tr>`).join("");
        return `<article class="comp" data-id="${esc(c.id)}" tabindex="0">
          <div class="place ${p && p <= 3 ? "p" + p : ""}">${p ? `<div>${p}<small>${c.participants ? "of " + c.participants : ord(p).replace(/\d+/, "")}</small></div>` : (c.total == null && /withdr/i.test(c.notes || "") ? `<div style="font-size:1rem">WD<small>withdrew</small></div>` : "–")}</div>
          <div>
            <div class="title">${flag(c.country)} ${esc(c.name)}</div>
            <div class="meta"><span>${range(c.start, c.end)}</span>${c.city ? `<span>${esc(c.city)}${c.country ? ", " + esc(c.country) : ""}</span>` : ""}<span class="pill">${esc(c.type)}</span>${multiLevel() && c.level ? `<span class="pill lvl lvl-${esc(c.level.toLowerCase())}">${esc(c.level)}</span>` : ""}${pbs.has(c.id) ? `<span class="pill pb">ISU PB</span>` : ""}${c.verified === false ? `<span class="pill warn">unverified</span>` : ""}${(c.segments || []).some(x => x.video) ? `<span class="pill vid">▶ Video</span>` : ""}${igLink(c)}</div>
            <div class="segs">${(c.segments || []).filter(x => /pattern/i.test(x.name || "")).map(x => segBar(x.name, x, "--text-muted", SCALE.pd, c)).join("")}${segBar("Rhythm Dance", c.rd, "--series-3", SCALE.rd, c)}${segBar("Free Dance", c.fd, "--series-2", SCALE.fd, c)}</div>
          </div>
          <div class="total"><div class="l">${c.rdOnly ? "RD score" : "Total"}</div><div class="v">${fmt(c.total)}</div>${c.rdOnly ? `<div class="rdonly">No free dance: top 20 only</div>` : ""}</div>
          <div class="details">
            ${segRows ? `<table><tr><th>Segment</th><th>Place</th><th>Score</th><th>TES</th><th>PCS</th><th>Ded.</th><th>Video</th></tr>${segRows}</table>` : ""}
            ${igList(c)}
            ${c.notes ? `<p>${esc(c.notes)}</p>` : ""}
            ${(c.sources || []).length ? `<div class="src">Sources: ${c.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname.replace(/^www\./, ""))}</a>`).join("")}</div>` : ""}
          </div>
        </article>`;
      }).join("")}`).join("");
  }

  function renderTable(list) {
    const cols = [
      { k: "start", l: "Date", f: c => dfmt(c.start), v: c => c.start },
      { k: "name", l: "Competition", f: c => `${flag(c.country)} ${esc(c.name)}`, v: c => c.name },
      { k: "type", l: "Type", f: c => esc(c.type), v: c => c.type },
      ...(multiLevel() ? [{ k: "level", l: "Level", f: c => esc(c.level || ""), v: c => c.level || "" }] : []),
      { k: "place", l: "Place", f: c => c.place ? ord(c.place) + (c.participants ? ` / ${c.participants}` : "") : (/withdr/i.test(c.notes || "") ? "WD" : "–"), v: c => c.place ?? 999, n: 1 },
      { k: "rd", l: "RD", f: c => fmt(c.rdScore), v: c => c.rdScore ?? -1, n: 1 },
      { k: "fd", l: "FD", f: c => fmt(c.fdScore), v: c => c.fdScore ?? -1, n: 1 },
      { k: "total", l: "Total", f: c => `<b>${fmt(c.total)}</b>`, v: c => c.total ?? -1, n: 1 },
      { k: "video", l: "Media", f: c => playBtn(c.rd, c, "RD", "play mini") + playBtn(c.fd, c, "FD", "play mini") + igLink(c, "ig mini"), v: c => (c.rd?.video ? 1 : 0) + (c.fd?.video ? 1 : 0) },
    ];
    const col = cols.find(c => c.k === state.sort.key) || cols[0];
    const rows = list.slice().sort((a, b) => { const A = col.v(a), B = col.v(b); return (A > B ? 1 : A < B ? -1 : 0) * state.sort.dir; });
    return `<div class="tbl-wrap card" style="padding:0"><table class="res"><thead><tr>${cols.map(c => `<th class="${c.n ? "n" : ""}" data-k="${c.k}">${c.l}${state.sort.key === c.k ? (state.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.n ? "n" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  let lastFocus = null;
  function openVideo(url, title) {
    const id = ytId(url), m = $("videoModal");
    lastFocus = document.activeElement;
    $("videoTitle").textContent = title || "";
    $("videoLink").href = url;
    $("videoFrame").innerHTML = id ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>` : "";
    m.hidden = false; document.body.style.overflow = "hidden"; $("videoClose").focus();
  }
  function closeVideo() {
    const m = $("videoModal"); if (m.hidden) return;
    m.hidden = true; $("videoFrame").innerHTML = ""; document.body.style.overflow = ""; lastFocus?.focus();
  }

  function renderList() {
    const list = filtered();
    const el = $("list");
    if (!list.length) { el.innerHTML = `<div class="card empty">No competitions match these filters.</div>`; return; }
    el.innerHTML = state.view === "cards" ? renderCards(list) : renderTable(list);
    el.onclick = (e) => {
      const th = e.target.closest("th[data-k]");
      if (th) { const k = th.dataset.k; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : 1 }; renderList(); return; }
      const pb = e.target.closest("button[data-video]");
      if (pb) { e.stopPropagation(); openVideo(pb.dataset.video, pb.dataset.title); return; }
      if (e.target.closest("a")) return;
      const card = e.target.closest(".comp"); if (card) card.classList.toggle("open");
    };
    el.onkeydown = (e) => { if (e.key === "Enter") e.target.closest(".comp")?.classList.toggle("open"); };
  }

  function renderProfile() {
    const a = DATA.athletes || {}; if (!a.skaters) return;
    const age = (d) => { const b = new Date(d), n = new Date(); let y = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) y--; return y; };
    const sk = a.skaters.map(k => `<div class="pf"><div class="nm">${esc(k.name.replace(/\b([A-ZÄÖÜ])([A-ZÄÖÜ]+)\b/g, (m, f, r) => f + r.toLowerCase()))}</div>
      <div class="muted">Born ${dfmt(k.birthdate)} in ${esc(k.birthplace || "–")} · ${age(k.birthdate)} yrs${k.height_cm ? " · " + k.height_cm + " cm" : ""}</div></div>`).join("");
    const mk = Object.keys(a).filter(k => /^music_\d{4}_\d{2}$/.test(k)).sort().pop();
    const m = (mk && a[mk]) || {}, ms = mk ? mk.slice(6).replace("_", "/") : "";
    $("profile").innerHTML = `<div class="card profile">
      <div class="pf-grid">${sk}
        <div class="pf"><div class="k">Club</div><div>${esc(a.skaters[0].club || "–")}</div></div>
        ${a.choreographer && a.coach && !a.coach.startsWith(a.choreographer)
          ? `<div class="pf"><div class="k">Coach</div><div>${esc(a.coach)}</div></div><div class="pf"><div class="k">Choreographer</div><div>${esc(a.choreographer)}</div></div>`
          : `<div class="pf"><div class="k">Coach${a.choreographer ? " & choreographer" : ""}</div><div>${esc(a.coach || "–")}</div></div>`}
      </div>
      ${m.rhythm_dance ? `<div class="music"><div><span class="k">${ms} Rhythm Dance</span> ${esc(m.rhythm_dance)}</div><div><span class="k">${ms} Free Dance</span> ${esc(m.free_dance)}</div></div>` : ""}
      <div class="links">${a.isu_bio ? `<a href="${esc(a.isu_bio)}" target="_blank" rel="noopener">ISU biography ↗</a>` : ""}${a.instagram ? `<a href="https://www.instagram.com/${esc(a.instagram)}/" target="_blank" rel="noopener">Instagram @${esc(a.instagram)} ↗</a>` : ""}${(a.instagram_personal || []).map(h => `<a href="https://www.instagram.com/${esc(h)}/" target="_blank" rel="noopener">@${esc(h)} ↗</a>`).join("")}</div>
    </div>`;
  }

  function render() { renderFilters(); renderChart(); renderBests(); renderList(); }

  /* ---------- Theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved) document.documentElement.dataset.theme = saved;
    $("themeToggle").onclick = () => {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = dark ? "light" : "dark";
      document.documentElement.dataset.theme = next; localStorage.setItem("theme", next);
      renderChart();
    };
  }

  /* Show full text on hover/focus/tap wherever text is cut off */
  function initTruncTips() {
    const tip = $("tooltip");
    const isCut = (el) => el instanceof SVGElement ? el.classList.contains("cut") : el.scrollWidth > el.clientWidth + 1;
    const show = (el) => {
      tip.innerHTML = `<div class="t" style="margin:0">${esc(el.dataset.full)}</div>`;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2));
      const top = r.top - tip.offsetHeight - 8 < 8 ? r.bottom + 8 : r.top - tip.offsetHeight - 8;
      tip.style.left = left + "px"; tip.style.top = top + "px";
    };
    const handler = (e) => { const el = e.target.closest?.("[data-full]"); if (el && isCut(el)) show(el); };
    document.addEventListener("mouseover", handler);
    document.addEventListener("click", handler);
    document.addEventListener("mouseout", (e) => { if (e.target.closest?.("[data-full]")) tip.hidden = true; });
    addEventListener("scroll", () => { if (!tip.querySelector(".r")) tip.hidden = true; }, { passive: true });
  }

  function init(data) {
    const comps = data.competitions.map(norm).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    DATA = { ...data, competitions: comps, seasons: [...new Set(comps.map(c => c.season))],
      levels: ["Advanced Novice", "Basic Novice", "Novice", "Junior", "Senior"].filter(l => comps.some(c => c.level === l)) };
    const mx = (k) => Math.max(0, ...comps.map(c => c[k] || 0));
    SCALE.rd = Math.max(75, Math.ceil(mx("rdScore") * 1.1 / 5) * 5);
    SCALE.fd = Math.max(110, Math.ceil(mx("fdScore") * 1.1 / 5) * 5);
    SCALE.pd = Math.max(40, ...comps.flatMap(c => (c.segments || []).filter(x => /pattern/i.test(x.name || "")).map(x => Math.ceil((x.score || 0) * 1.15))));
    $("updated").textContent = `Last updated ${dfmt(data.updated)}.`;
    initTheme(); initTruncTips(); renderStats(); renderProfile();
    $("viewToggle").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; state.view = b.dataset.view;
      [...$("viewToggle").children].forEach(x => x.classList.toggle("on", x === b)); renderList(); };
    $("videoClose").onclick = closeVideo;
    $("videoModal").onclick = (e) => { if (e.target.id === "videoModal") closeVideo(); };
    addEventListener("keydown", (e) => { if (e.key === "Escape") closeVideo(); }); renderLegend(); render();
    let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderChart, 120); });
  }

  if (window.SKATE_DATA) init(window.SKATE_DATA);
  else fetch("data/results.json").then(r => r.json()).then(init).catch(() => { $("list").innerHTML = `<div class="card empty">Could not load data/results.json</div>`; });
})();
