/* LMS kit: motion. Shared by LMS Dash and the client portal.
   LMSMotion.reveal(root) watches every .k-reveal inside root that has not been shown yet. When one
   scrolls into view it fades up, its charts draw, its bars grow and its [data-count] numbers count
   from 0, once, 40 ms after the one before it. LMSMotion.settle(root) shows everything at once with
   no motion: use it for a redraw of a page that is already on screen.
   Markup always holds the final values, so the page reads correctly without this script.
   Plain script: it sets globalThis.LMSMotion. */
(function (root) {
  'use strict';
  if (typeof window === 'undefined') { root.LMSMotion = { reveal() {}, settle() {} }; return; }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let io = null;
  let stagger = 0;
  let staggerReset = 0;

  function fmtFor(name) {
    const f = root.LMSCharts && root.LMSCharts.fmt;
    return (f && f[name]) || ((v) => String(Math.round(v)));
  }

  function countUp(el) {
    const to = parseFloat(el.dataset.count);
    if (!Number.isFinite(to)) return;
    const f = fmtFor(el.dataset.fmt);
    const pre = el.dataset.pre || '';
    const suf = el.dataset.suf || '';
    const t0 = performance.now();
    const dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = pre + f(to * (1 - Math.pow(1 - k, 3))) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function show(el) {
    const d = stagger++ * 40;
    clearTimeout(staggerReset);
    staggerReset = setTimeout(() => { stagger = 0; }, 160);
    el.style.transitionDelay = `${d}ms`;
    el.querySelectorAll('.k-draw, .k-sweep, .k-bar__f, .k-vbars i').forEach((x) => {
      if (!x.style.getPropertyValue('--d')) x.style.setProperty('--d', `${d + 120}ms`);
    });
    void el.offsetWidth;
    el.classList.remove('k-wait');
    el.classList.add('is-in');
    setTimeout(() => el.querySelectorAll('[data-count]').forEach(countUp), d + 100);
    setTimeout(() => { el.style.transitionDelay = ''; }, d + 700);
  }

  function settle(scope) {
    (scope || document).querySelectorAll('.k-reveal').forEach((el) => {
      if (io) io.unobserve(el);
      if (el.classList.contains('k-wait')) {
        el.querySelectorAll('[data-count]').forEach((n) => { n.textContent = (n.dataset.pre || '') + fmtFor(n.dataset.fmt)(parseFloat(n.dataset.count) || 0) + (n.dataset.suf || ''); });
      }
      el.classList.remove('k-wait');
      el.classList.add('is-in');
    });
  }

  function reveal(scope) {
    const box = scope || document;
    const els = [...box.querySelectorAll('.k-reveal:not(.is-in):not(.k-wait)')];
    if (!els.length) return;
    if (reduce.matches || !('IntersectionObserver' in window)) { settle(box); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          show(e.target);
        });
      }, { threshold: 0.12 });
    }
    els.forEach((el) => {
      el.querySelectorAll('[data-count]').forEach((n) => { n.textContent = (n.dataset.pre || '') + fmtFor(n.dataset.fmt)(0) + (n.dataset.suf || ''); });
      el.classList.add('k-wait');
      io.observe(el);
    });
    /* A hidden tab never reports intersections; show what is on screen when it comes back. */
    setTimeout(() => { if (document.hidden) settle(box); }, 1500);
  }

  root.LMSMotion = { reveal, settle };
})(typeof globalThis !== 'undefined' ? globalThis : window);
