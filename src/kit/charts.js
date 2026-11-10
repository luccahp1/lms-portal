/* LMS kit: chart and number helpers. Shared by LMS Dash and the client portal.
   Each helper returns an SVG or HTML string drawn at its final state; motion.js animates it in.
   Colours come from --c on the surrounding card, so the same chart works in any section and theme.
   Plain script: it sets globalThis.LMSCharts, so Dash loads it with a <script> tag and the portal imports it. */
(function (root) {
  'use strict';

  let uid = 0;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const fmt = {
    int: (v) => Math.round(v).toLocaleString('en-CA'),
    money: (v) => `$${Math.round(v).toLocaleString('en-CA')}`,
    cents: (v) => `$${v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pct: (v) => `${Math.round(v)}%`,
    dec1: (v) => v.toFixed(1),
    compact: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : String(Math.round(v))),
  };

  /* A number that counts up from 0 when it scrolls into view. The final value is in the markup. */
  function count(value, { format = 'int', pre = '', suf = '', tag = 'span' } = {}) {
    const v = Number(value) || 0;
    const f = fmt[format] || fmt.int;
    return `<${tag} data-count="${v}" data-fmt="${format}" data-pre="${esc(pre)}" data-suf="${esc(suf)}">${esc(pre)}${f(v)}${esc(suf)}</${tag}>`;
  }

  function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return len;
  }

  /* Line + area chart with a faint grid, y ticks and an emphasised last point.
     second: an optional comparison series drawn dashed. labels: x labels ('' to skip one). */
  function area(values, { w = 520, h = 150, labels = null, second = null, label = 'Chart', yFormat = 'compact' } = {}) {
    const vals = values.map((v) => Number(v) || 0);
    if (vals.length < 2) return '';
    const id = `kg${++uid}`;
    const pt = 8, pr = 8, pb = labels ? 18 : 6, pl = 34;
    const all = second ? vals.concat(second.map(Number)) : vals;
    const top = Math.max(1, ...all);
    const max = top * 1.12;
    const X = (i) => pl + (i * (w - pl - pr)) / (vals.length - 1);
    const Y = (v) => pt + (h - pt - pb) * (1 - v / max);
    const pts = vals.map((v, i) => [X(i), Y(v)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const areaD = `${d} L${X(vals.length - 1).toFixed(1)} ${h - pb} L${X(0).toFixed(1)} ${h - pb} Z`;
    const ticks = [0, top / 2, top];
    const tf = fmt[yFormat] || fmt.compact;
    const grid = ticks.map((t) => `<line class="g" x1="${pl}" x2="${w - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text class="ax" x="${pl - 6}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${esc(tf(t))}</text>`).join('');
    // Keep x labels apart: a label too close to the one before it is dropped, and the last one
    // always shows, pushing out whichever label sits too close in front of it.
    const MIN_GAP = 64;
    const keep = [];
    if (labels) {
      labels.forEach((l, i) => {
        if (!l) return;
        const prev = keep[keep.length - 1];
        if (prev === undefined || X(i) - X(prev) >= MIN_GAP) keep.push(i);
        else if (i === vals.length - 1) keep[keep.length - 1] = i;
      });
      if (keep.length > 1 && X(keep[keep.length - 1]) - X(keep[keep.length - 2]) < MIN_GAP) keep.splice(keep.length - 2, 1);
    }
    const xl = keep.map((i) => `<text class="ax" x="${X(i).toFixed(1)}" y="${h - 3}" text-anchor="${i === 0 ? 'start' : i === vals.length - 1 ? 'end' : 'middle'}">${esc(labels[i])}</text>`).join('');
    let sec = '';
    if (second) {
      const sp = second.map((v, i) => [X(i), Y(Number(v) || 0)]);
      sec = `<path class="ln2 k-fade" d="${sp.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')}"/>`;
    }
    const last = pts[pts.length - 1];
    return `<svg class="k-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></linearGradient></defs>`
      + `${grid}${xl}<path class="k-fade" d="${areaD}" fill="url(#${id})"/>${sec}<path class="ln k-draw" style="--len:${Math.ceil(pathLength(pts))}" d="${d}"/>`
      + `<circle class="pt k-fade" r="4" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}"/></svg>`;
  }

  /* Tiny trend line for a tile or a row. */
  function spark(values) {
    const vals = values.map((v) => Number(v) || 0);
    if (vals.length < 2) return '';
    const w = 120, h = 34, id = `ks${++uid}`;
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = max - min || 1;
    const X = (i) => (i * w) / (vals.length - 1);
    const Y = (v) => h - 3 - ((h - 6) * (v - min)) / span;
    const pts = vals.map((v, i) => [X(i), Y(v)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return `<svg class="k-chart k-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:.25"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></linearGradient></defs>`
      + `<path class="k-fade" d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path class="ln k-draw" vector-effect="non-scaling-stroke" style="--len:${Math.ceil(pathLength(pts) * 1.3)}" d="${d}"/></svg>`;
  }

  /* Half-circle gauge. valueSvg is SVG text content (use count(..., {tag:'tspan'})). */
  function gauge(percent, label, valueSvg) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const r = 80, cx = 100, cy = 96, len = Math.PI * r;
    const arc = `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    return `<div class="k-gauge"><svg viewBox="0 0 200 112" role="img" aria-label="${esc(label)}: ${Math.round(p)}%"><path class="trk" d="${arc}"/>`
      + `<path class="val k-sweep" style="--len:${len.toFixed(1)};--off:${(len * (1 - p / 100)).toFixed(1)}" d="${arc}"/>`
      + `<text class="gv" x="100" y="88" text-anchor="middle">${valueSvg}</text><text class="gl" x="100" y="108" text-anchor="middle">${esc(String(label).toUpperCase())}</text></svg></div>`;
  }

  /* Score ring with a short value in the middle. */
  function ring(percent, label, text) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const r = 26, len = 2 * Math.PI * r;
    return `<div class="k-ring"><svg viewBox="0 0 64 64" role="img" aria-label="${esc(label)}: ${esc(text)}"><circle class="trk" cx="32" cy="32" r="${r}"/>`
      + `<circle class="val k-sweep" style="--len:${len.toFixed(1)};--off:${(len * (1 - p / 100)).toFixed(1)}" cx="32" cy="32" r="${r}"/>`
      + `<text class="rv" x="32" y="37" text-anchor="middle">${esc(text)}</text></svg><small>${esc(label)}</small></div>`;
  }

  /* Horizontal progress bars: [{label, pct, note}]. */
  function bars(items) {
    return `<div class="k-bars">${items.map((b, i) => `<div class="k-bar"><div class="k-bar__l"><span>${esc(b.label)}</span><span>${esc(b.note ?? `${Math.round(b.pct)}%`)}</span></div>`
      + `<div class="k-bar__t"><div class="k-bar__f" style="width:${Math.max(0, Math.min(100, b.pct)).toFixed(1)}%;--d:${i * 90}ms"></div></div></div>`).join('')}</div>`;
  }

  /* Column chart. hi: index of the highlighted column (others are muted); -1 highlights all. */
  function vbars(values, labels, { hi = -1, title = (v) => v } = {}) {
    const vals = values.map((v) => Number(v) || 0);
    const max = Math.max(1, ...vals);
    return `<div class="k-vbars" role="img" aria-label="${esc(labels.map((l, i) => `${l}: ${title(vals[i])}`).join(', '))}">${vals.map((v, i) => `<i class="${hi === -1 || i === hi ? '' : 'm'}" style="--h:${Math.max(v ? 3 : 0, (v / max) * 100).toFixed(1)}%;--d:${i * 60}ms" title="${esc(`${labels[i]}: ${title(v)}`)}"></i>`).join('')}</div>`
      + `<div class="k-vlab">${labels.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
  }

  root.LMSCharts = { esc, fmt, count, area, spark, gauge, ring, bars, vbars };
})(typeof globalThis !== 'undefined' ? globalThis : window);
