/* The markup script for "Request website changes".

   The portal serves a client's own website inside a sandboxed frame (/site/<token>/...,
   src/lib/review/proxy.ts) and injects this file first in <head>. It draws the pins, the
   hover outline and the drawings on top of the page, makes wording editable in place, keeps
   links inside the frame, and talks to the portal page around the frame with postMessage.
   The portal page (src/app/review/ReviewTool.tsx) owns the toolbar, the list and saving.

   Plain ES2017, no build step, no dependencies. Bump AGENT_VERSION in proxy.ts on a change. */
(function () {
  'use strict';
  if (window.__lmsReview) return;
  window.__lmsReview = true;

  var me = document.currentScript;
  var PREFIX = (me && me.getAttribute('data-prefix')) || '';
  var HOST = ((me && me.getAttribute('data-host')) || '').toLowerCase().replace(/^www\./, '');
  var framed = window.parent !== window;
  // The page around the frame is on this same host; only it gets our messages.
  var PARENT = location.origin;

  var mode = 'browse';
  var readOnly = false;
  var notes = [];
  var activeId = null;
  var pending = null; // a pin shown while the person types its note
  var strokes = []; // the drawing in progress, in page pixels
  var editing = null; // { el, before }

  function send(type, data) {
    if (!framed) return;
    var msg = { lms: 1, type: type };
    if (data) for (var k in data) msg[k] = data[k];
    window.parent.postMessage(msg, PARENT);
  }

  /* ── addresses ─────────────────────────────────────────────────── */

  function realPath() {
    var p = location.pathname;
    if (PREFIX && p.indexOf(PREFIX) === 0) p = p.slice(PREFIX.length);
    return p || '/';
  }

  /* A site address as a frame address; null when it leads somewhere else. */
  function toFrame(href) {
    var url;
    try { url = new URL(href, location.href); } catch { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    var inFrame = url.origin === location.origin;
    var sameSite = url.hostname.toLowerCase().replace(/^www\./, '') === HOST;
    if (!inFrame && !sameSite) return null;
    var path = url.pathname;
    if (inFrame && (path === PREFIX || path.indexOf(PREFIX + '/') === 0)) return url.href;
    // The markup script itself lives outside the frame's path.
    if (inFrame && path === '/review-agent.js') return url.href;
    return location.origin + PREFIX + path + url.search + url.hash;
  }

  /* Requests the site's own scripts make with a root address ("/api/...") would miss the
     frame's path. Send them through it; anything but a GET is refused there anyway. */
  if (window.fetch) {
    var realFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (typeof input === 'string' || input instanceof URL) {
          var mapped = toFrame(String(input));
          if (mapped) input = mapped;
        }
      } catch { /* leave it */ }
      return realFetch.call(this, input, init);
    };
  }
  if (window.XMLHttpRequest) {
    var realOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      try { var mapped = toFrame(String(url)); if (mapped) args[1] = mapped; } catch { /* leave it */ }
      return realOpen.apply(this, args);
    };
  }

  if (!framed) return; // opened by its address alone: just the site, nothing to mark up

  /* ── the layer on top of the page ──────────────────────────────── */

  var host = document.createElement('lms-review');
  host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box}' +
    '.hover{position:absolute;border:2px solid #D2523F;border-radius:4px;background:rgba(210,82,63,.08);pointer-events:none;display:none}' +
    '.hover.text{border-style:dashed;border-color:#3D74B0;background:rgba(61,116,176,.08)}' +
    '.pin{position:absolute;width:30px;height:30px;margin:-30px 0 0 -4px;border:0;border-radius:50% 50% 50% 4px;background:#D2523F;color:#fff;font:700 13px/30px system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;cursor:pointer;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.35);padding:0;transition:transform .15s}' +
    '.pin:hover,.pin.on{transform:scale(1.18)}' +
    '.pin.on{outline:3px solid rgba(255,255,255,.9);outline-offset:1px}' +
    '.pin.done{background:#1F7A4F}' +
    '.pin.text{background:#3D74B0}' +
    '.pin.done.text{background:#1F7A4F}' +
    '.pin.wait{opacity:.75;animation:bob 1s ease-in-out infinite}' +
    '@keyframes bob{50%{transform:translateY(-4px)}}' +
    '@keyframes flash{0%,100%{box-shadow:0 2px 8px rgba(0,0,0,.35)}50%{box-shadow:0 0 0 10px rgba(210,82,63,.35)}}' +
    '.pin.flash{animation:flash .6s ease 2}' +
    'svg{position:absolute;top:0;left:0;overflow:visible;pointer-events:none}' +
    'path{fill:none;stroke:#D2523F;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}' +
    'path.done{stroke:#1F7A4F}' +
    'path.halo{stroke:#fff;stroke-width:8;opacity:.75}' +
    '.pad{position:fixed;inset:0;pointer-events:auto;cursor:crosshair;touch-action:none;display:none}' +
    '.mark{position:absolute;border:2px dashed #3D74B0;border-radius:4px;pointer-events:none}' +
    '.mark.done{border-color:#1F7A4F}' +
    '</style>' +
    '<svg id="ink" width="1" height="1"></svg><div id="marks"></div><div class="hover" id="hover"></div><div id="pins"></div><div class="pad" id="pad"></div>';
  var $ink = root.getElementById('ink');
  var $marks = root.getElementById('marks');
  var $hover = root.getElementById('hover');
  var $pins = root.getElementById('pins');
  var $pad = root.getElementById('pad');

  function mount() {
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }

  /* Page coordinates are measured from the layer itself, so they stay right whatever the
     page does with margins or transforms on <body>. */
  function origin() {
    var r = host.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }
  function pageRect(el) {
    var r = el.getBoundingClientRect();
    var o = origin();
    return { x: r.left - o.x, y: r.top - o.y, w: r.width, h: r.height };
  }

  /* ── anchors: remembering where a note points ──────────────────── */

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function unique(sel) {
    try { return document.querySelectorAll(sel).length === 1; } catch { return false; }
  }

  function selectorFor(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      // An id that looks written by a person is the most stable hook there is.
      if (node.id && !/\d{3,}|^(ember|react|radix|headlessui)/i.test(node.id) && unique('#' + cssEscape(node.id))) {
        parts.unshift('#' + cssEscape(node.id));
        return parts.join(' > ');
      }
      if (node === document.body) { parts.unshift('body'); break; }
      var tag = node.tagName.toLowerCase();
      var i = 1;
      var sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function ownText(el) {
    var t = el.tagName === 'IMG' ? el.getAttribute('alt') || '' : el.innerText || el.textContent || '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  function anchorFor(el, px, py) {
    var r = pageRect(el);
    return {
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      text: ownText(el),
      rx: r.w ? (px - r.x) / r.w : 0.5,
      ry: r.h ? (py - r.y) / r.h : 0.5,
      docX: Math.round(px),
      docY: Math.round(py),
      w: Math.round(r.w),
      h: Math.round(r.h),
    };
  }

  function find(anchor) {
    if (!anchor || !anchor.selector) return null;
    var el = null;
    try { el = document.querySelector(anchor.selector); } catch { el = null; }
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return r.width || r.height ? el : null;
  }

  /* Where a note sits on the page right now, and the box its drawing is stretched over. */
  function place(note) {
    var a = note.anchor;
    if (!a) return null;
    var el = find(a);
    if (el) {
      var r = pageRect(el);
      return { x: r.x + a.rx * r.w, y: r.y + a.ry * r.h, box: r, el: el };
    }
    return { x: a.docX, y: a.docY, box: { x: a.docX - a.rx * a.w, y: a.docY - a.ry * a.h, w: a.w, h: a.h }, el: null };
  }

  /* ── drawing what's there ──────────────────────────────────────── */

  function pathData(points) {
    var d = '';
    for (var i = 0; i + 1 < points.length; i += 2) d += (i ? 'L' : 'M') + points[i].toFixed(1) + ' ' + points[i + 1].toFixed(1);
    return d;
  }

  function svgPath(d, cls) {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    if (cls) p.setAttribute('class', cls);
    return p;
  }

  function onThisPage(n) { return n.pagePath === realPath(); }

  function render() {
    mount();
    $pins.textContent = '';
    $marks.textContent = '';
    $ink.textContent = '';
    notes.filter(onThisPage).forEach(function (n) {
      var at = place(n);
      if (!at) return;
      var done = !!n.doneAt;
      var x = at.x;
      var y = at.y;
      // A drawing only makes sense on the layout it was drawn on: one made on a phone is not
      // stretched over the computer layout, and the other way round. Its pin still shows.
      var sameLayout = !n.viewportW || (n.viewportW <= 600) === (window.innerWidth <= 600);
      if (n.kind === 'draw' && n.strokes && sameLayout) {
        var minX = Infinity;
        var minY = Infinity;
        n.strokes.forEach(function (s) {
          var pts = [];
          for (var i = 0; i + 1 < s.length; i += 2) {
            var px = at.box.x + s[i] * at.box.w;
            var py = at.box.y + s[i + 1] * at.box.h;
            pts.push(px, py);
            if (py < minY) { minY = py; minX = px; }
          }
          var d = pathData(pts);
          $ink.appendChild(svgPath(d, 'halo'));
          $ink.appendChild(svgPath(d, done ? 'done' : ''));
        });
        if (minX !== Infinity) { x = minX; y = minY; }
      }
      if (n.kind === 'text' && at.el) {
        // Show the page as it will read, when it still says what it said.
        if (!at.el.__lmsBefore && n.textBefore != null && squash(at.el.innerText) === squash(n.textBefore) && !done) {
          at.el.__lmsBefore = at.el.innerHTML;
          at.el.__lmsBeforeText = n.textBefore;
          at.el.innerText = n.textAfter;
        }
        at.el.__lmsNote = n.id;
        var r = pageRect(at.el);
        var m = document.createElement('div');
        m.className = 'mark' + (done ? ' done' : '');
        m.style.cssText = 'left:' + (r.x - 4) + 'px;top:' + (r.y - 3) + 'px;width:' + (r.w + 8) + 'px;height:' + (r.h + 6) + 'px';
        $marks.appendChild(m);
        x = r.x;
        y = r.y;
      }
      var pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin' + (n.kind === 'text' ? ' text' : '') + (done ? ' done' : '') + (n.id === activeId ? ' on' : '');
      pin.style.left = x + 'px';
      pin.style.top = y + 'px';
      pin.textContent = n.n;
      pin.setAttribute('aria-label', 'Note ' + n.n);
      pin.dataset.id = n.id;
      $pins.appendChild(pin);
    });
    if (pending) {
      var p = document.createElement('div');
      p.className = 'pin wait';
      p.style.left = pending.x + 'px';
      p.style.top = pending.y + 'px';
      p.textContent = '+';
      $pins.appendChild(p);
    }
    if (strokes.length) {
      strokes.forEach(function (s) {
        var d = pathData(s);
        $ink.appendChild(svgPath(d, 'halo'));
        $ink.appendChild(svgPath(d, ''));
      });
    }
  }

  function squash(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  /* Text edits that no longer have a note (deleted, or a different set loaded) go back. */
  function restoreOrphans() {
    var keep = {};
    notes.forEach(function (n) { if (n.kind === 'text') keep[n.id] = 1; });
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.__lmsBefore && !keep[el.__lmsNote] && el !== (editing && editing.el)) {
        el.innerHTML = el.__lmsBefore;
        el.__lmsBefore = null;
        el.__lmsNote = null;
      }
    }
  }

  var frame = 0;
  function renderSoon() {
    if (frame) return;
    frame = requestAnimationFrame(function () { frame = 0; render(); });
  }
  window.addEventListener('scroll', renderSoon, true);
  window.addEventListener('resize', function () { renderSoon(); send('size', { width: window.innerWidth }); });
  window.addEventListener('load', renderSoon);

  /* ── modes ─────────────────────────────────────────────────────── */

  function inLayer(e) { return e.target === host || (e.composedPath && e.composedPath().indexOf(host) >= 0); }

  function hasOwnWords(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 3 && c.nodeValue.trim().length > 1) return true;
    }
    return false;
  }

  /* The element whose wording a click means: the nearest one that holds words of its own. */
  function wordsAt(el) {
    var node = el;
    for (var i = 0; node && node !== document.body && i < 4; i++, node = node.parentElement) {
      if (/^(INPUT|TEXTAREA|SELECT|IMG|SVG|VIDEO|IFRAME|CANVAS)$/i.test(node.tagName)) return null;
      if (hasOwnWords(node)) return node;
    }
    return null;
  }

  function showHover(el, text) {
    if (!el || el === document.body || el === document.documentElement) { $hover.style.display = 'none'; return; }
    var r = pageRect(el);
    $hover.className = 'hover' + (text ? ' text' : '');
    $hover.style.cssText = 'display:block;left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
  }

  function setMode(next) {
    if (editing) finishEdit(true);
    mode = readOnly ? 'browse' : next;
    $hover.style.display = 'none';
    $pad.style.display = mode === 'draw' ? 'block' : 'none';
    document.documentElement.style.cursor = mode === 'comment' ? 'crosshair' : mode === 'text' ? 'text' : '';
    if (mode !== 'draw' && strokes.length) { strokes = []; render(); }
    if (pending && mode !== 'comment') { pending = null; render(); }
  }

  document.addEventListener('mousemove', function (e) {
    if (mode !== 'comment' && mode !== 'text') return;
    if (inLayer(e) || editing) { $hover.style.display = 'none'; return; }
    showHover(mode === 'text' ? wordsAt(e.target) : e.target, mode === 'text');
  }, true);

  /* While marking up, the page itself must not react: no menus, no navigation. */
  ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (mode === 'browse' || inLayer(e)) return;
      if (editing && editing.el.contains(e.target)) return;
      e.stopPropagation();
      if (type === 'mousedown' && mode === 'comment') e.preventDefault();
    }, true);
  });

  window.addEventListener('click', function (e) {
    if (inLayer(e)) return;
    if (mode === 'browse') return browseClick(e);
    if (editing && editing.el.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (editing) { finishEdit(true); return; }
    var o = origin();
    var px = e.clientX - o.x;
    var py = e.clientY - o.y;
    if (mode === 'comment') {
      var el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      if (!el || el === document.documentElement) el = document.body;
      pending = { x: px, y: py };
      render();
      send('pick', { anchor: anchorFor(el, px, py), isImage: /^(IMG|PICTURE|VIDEO)$/.test(el.tagName) });
    } else if (mode === 'text') {
      var target = wordsAt(e.target.nodeType === 1 ? e.target : e.target.parentElement);
      if (!target) { send('hint', { text: 'Click on some wording to change it. Use Comment for pictures and everything else.' }); return; }
      startEdit(target);
    }
  }, true);

  root.addEventListener('click', function (e) {
    var pin = e.target.closest ? e.target.closest('.pin') : null;
    if (pin && pin.dataset.id) { e.stopPropagation(); send('open', { id: pin.dataset.id }); }
  });

  function browseClick(e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var raw = a.getAttribute('href') || '';
    if (/^(mailto|tel|sms|javascript):/i.test(raw)) return;
    if (raw.charAt(0) === '#') {
      // Scroll there ourselves: a <base> on the page would turn this into a page load.
      var to = raw.length > 1 ? document.getElementById(decodeURIComponent(raw.slice(1))) : document.body;
      if (to) { e.preventDefault(); to.scrollIntoView({ behavior: 'smooth' }); }
      return;
    }
    var mapped = toFrame(a.href);
    if (mapped) {
      // Stay in the frame even when the link wants a new tab.
      if (a.target && a.target !== '_self') { e.preventDefault(); location.href = mapped; }
      else if (mapped !== a.href) { e.preventDefault(); location.href = mapped; }
      return;
    }
    e.preventDefault();
    window.open(a.href, '_blank', 'noopener');
  }

  document.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    send('hint', { text: 'Forms are switched off in this preview, so nothing was sent.' });
  }, true);

  /* ── edit wording in place ─────────────────────────────────────── */

  function startEdit(el) {
    $hover.style.display = 'none';
    // Editing an element that already carries an edit continues from its original wording.
    var before = el.__lmsBefore ? el.__lmsBeforeText : el.innerText;
    editing = { el: el, before: before, html: el.__lmsBefore || el.innerHTML, noteId: el.__lmsNote || null };
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.style.outline = '2px solid #3D74B0';
    el.style.outlineOffset = '3px';
    el.focus();
    el.addEventListener('keydown', editKeys, true);
    el.addEventListener('blur', editBlur, true);
  }

  function editKeys(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(true); }
  }
  function editBlur() { if (editing) finishEdit(true); }

  function finishEdit(keep) {
    var ed = editing;
    if (!ed) return;
    editing = null;
    var el = ed.el;
    el.removeEventListener('keydown', editKeys, true);
    el.removeEventListener('blur', editBlur, true);
    el.removeAttribute('contenteditable');
    el.style.outline = '';
    el.style.outlineOffset = '';
    var after = el.innerText;
    if (!keep || squash(after) === squash(ed.before)) {
      // Back to the original. A note that is still there puts its wording back in render().
      el.innerHTML = ed.html;
      el.__lmsBefore = null;
      // Typed back to what it said: the note has nothing left to ask for.
      if (keep && ed.noteId) send('text', { before: squash(ed.before), after: squash(ed.before), replaces: ed.noteId });
      render();
      return;
    }
    el.__lmsBefore = ed.html;
    el.__lmsBeforeText = ed.before;
    var r = pageRect(el);
    send('text', { anchor: anchorFor(el, r.x, r.y), before: squash(ed.before), after: squash(after), replaces: ed.noteId });
    render();
  }

  /* ── draw ──────────────────────────────────────────────────────── */

  var stroke = null;
  $pad.addEventListener('pointerdown', function (e) {
    if (mode !== 'draw') return;
    e.preventDefault();
    $pad.setPointerCapture(e.pointerId);
    var o = origin();
    stroke = [e.clientX - o.x, e.clientY - o.y];
    strokes.push(stroke);
  });
  $pad.addEventListener('pointermove', function (e) {
    if (!stroke) return;
    var o = origin();
    var x = e.clientX - o.x;
    var y = e.clientY - o.y;
    var n = stroke.length;
    if (Math.abs(x - stroke[n - 2]) + Math.abs(y - stroke[n - 1]) < 3 || n >= 1000) return;
    stroke.push(x, y);
    renderSoon();
  });
  function endStroke() {
    if (!stroke) return;
    if (stroke.length < 6) strokes.pop();
    stroke = null;
    render();
    send('drawing', { count: strokes.length });
  }
  $pad.addEventListener('pointerup', endStroke);
  $pad.addEventListener('pointercancel', endStroke);
  // The pad covers the page while drawing, so pass the wheel through to scroll.
  $pad.addEventListener('wheel', function (e) { window.scrollBy(e.deltaX, e.deltaY); }, { passive: true });

  function finishDrawing() {
    if (!strokes.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(function (s) {
      for (var i = 0; i + 1 < s.length; i += 2) {
        if (s[i] < minX) minX = s[i];
        if (s[i] > maxX) maxX = s[i];
        if (s[i + 1] < minY) minY = s[i + 1];
        if (s[i + 1] > maxY) maxY = s[i + 1];
      }
    });
    var o = origin();
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    $pad.style.display = 'none';
    var el = document.elementFromPoint(cx + o.x, cy + o.y) || document.body;
    $pad.style.display = mode === 'draw' ? 'block' : 'none';
    if (el === host) el = document.body;
    // Hang the drawing on something about its own size, so it scales sensibly with the page.
    while (el.parentElement && el !== document.body) {
      var r0 = el.getBoundingClientRect();
      if (r0.width >= (maxX - minX) * 0.6 && r0.height >= (maxY - minY) * 0.6) break;
      el = el.parentElement;
    }
    var box = pageRect(el);
    var w = box.w || 1;
    var h = box.h || 1;
    var out = strokes.map(function (s) {
      var step = Math.max(2, Math.ceil(s.length / 2 / 300) * 2); // at most 300 points a stroke
      var pts = [];
      for (var i = 0; i + 1 < s.length; i += step) pts.push(+((s[i] - box.x) / w).toFixed(4), +((s[i + 1] - box.y) / h).toFixed(4));
      return pts;
    });
    send('draw', { anchor: anchorFor(el, minX, minY), strokes: out });
  }

  /* ── messages from the portal page ─────────────────────────────── */

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || e.origin !== PARENT) return;
    var m = e.data;
    if (!m || m.lms !== 1) return;
    if (m.type === 'init' || m.type === 'notes') {
      notes = Array.isArray(m.notes) ? m.notes : [];
      if (m.type === 'init') { readOnly = !!m.readOnly; setMode(m.mode || 'browse'); }
      pending = null;
      if (m.clearDrawing) strokes = [];
      restoreOrphans();
      render();
    } else if (m.type === 'mode') {
      setMode(m.mode);
    } else if (m.type === 'cancel') {
      pending = null;
      render();
    } else if (m.type === 'draw-undo') {
      strokes.pop();
      render();
      send('drawing', { count: strokes.length });
    } else if (m.type === 'draw-clear') {
      strokes = [];
      render();
      send('drawing', { count: 0 });
    } else if (m.type === 'draw-done') {
      finishDrawing();
    } else if (m.type === 'focus') {
      activeId = m.id || null;
      render();
      var pin = activeId && $pins.querySelector('[data-id="' + activeId + '"]');
      if (pin) {
        var r = pin.getBoundingClientRect();
        window.scrollBy({ top: r.top - window.innerHeight * 0.35, behavior: 'smooth' });
        pin.classList.add('flash');
      }
    }
  });

  /* Shortcuts work while the frame has focus, e.g. with a menu held open under the mouse. */
  window.addEventListener('keydown', function (e) {
    if (editing || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 'Escape') send('escape');
    var key = { b: 'browse', c: 'comment', t: 'text', d: 'draw' }[String(e.key).toLowerCase()];
    if (key && !readOnly) send('key', { mode: key });
  }, true);

  /* Single-page sites change address without loading. */
  function announce(type) { send(type, { path: realPath(), title: document.title, width: window.innerWidth }); }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var real = history[fn];
    history[fn] = function (state, title, url) {
      var args = Array.prototype.slice.call(arguments);
      if (url != null) { var mapped = toFrame(String(url)); if (mapped) args[2] = mapped; }
      var out = real.apply(this, args);
      announce('ready');
      return out;
    };
  });
  window.addEventListener('popstate', function () { announce('ready'); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); announce('ready'); });
  else { mount(); announce('ready'); }
})();
