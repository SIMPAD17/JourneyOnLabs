/* Journey On Labs: the page's one script, for progressive enhancement; the page reads and works the same without it.
   1. The hero's flow field: tracer particles carried by potential flow past three cylinders (uniform flow plus a doublet
      for each), colored by speed through the four apps' colors; the pointer adds a fourth, moving cylinder. With
      prefers-reduced-motion, or while paused, it shows still streamlines.
   2. The simulation clips play while on screen and pause off screen; "Pause animations" stops them and the flow field.
   3. The Black Friday countdown and time bar to the end of Monday, 30 Nov 2026 (Pacific time; the codes expire on
      1 Dec), and the sale's parts hidden once it has ended.
   4. Copy buttons for the two codes.
   No cookies, no storage, no requests. */
(function () {
  'use strict';
  var START = Date.UTC(2026, 10, 26, 8, 0, 0); // Thu 26 Nov 2026 00:00 PST
  var END = Date.UTC(2026, 11, 1, 8, 0, 0);    // Tue 1 Dec 2026 00:00 PST
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var paused = reduce;

  // ---------------------------------------------------------------------------------------------- 1. the flow field
  var flow = (function () {
    var cv = document.getElementById('flow');
    if (!cv || !cv.getContext) return null;
    var ctx = cv.getContext('2d'), host = cv.parentElement, W = 0, H = 0, dpr = 1, parts = [], obs = [], ptr = null, ptrT = null;
    var running = false, visible = true, last = 0, raf = 0, time = 0;
    var dark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    var COLORS = dark ? [[57, 135, 229], [25, 158, 112], [240, 179, 35], [217, 89, 38]] : [[38, 113, 204], [27, 175, 122], [209, 149, 0], [235, 104, 52]];
    var L = 22, ALPHA = dark ? 0.95 : 0.85; // trail length in steps, and the newest segment's opacity
    var sl = document.createElement('canvas'), slx = sl.getContext('2d'); // the still streamlines under the tracers
    var NB = 8, bins = [];
    for (var b = 0; b < NB; b++) {
      var t = b / (NB - 1) * 3, i = Math.min(2, Math.floor(t)), u = t - i, a = COLORS[i], c = COLORS[i + 1];
      bins.push('rgb(' + Math.round(a[0] + (c[0] - a[0]) * u) + ',' + Math.round(a[1] + (c[1] - a[1]) * u) + ',' + Math.round(a[2] + (c[2] - a[2]) * u) + ')');
    }
    function layout() {
      var r = host.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wide = W >= 900, s = Math.min(W, H * 1.6);
      // three cylinders where the flow is seen: the right half on wide screens, the lower part on narrow ones
      obs = wide
        ? [{ x: W * 0.70, y: H * 0.40, a: s * 0.085 }, { x: W * 0.86, y: H * 0.70, a: s * 0.05 }, { x: W * 0.58, y: H * 0.78, a: s * 0.035 }]
        : [{ x: W * 0.62, y: H * 0.80, a: s * 0.10 }, { x: W * 0.26, y: H * 0.88, a: s * 0.05 }];
      var n = Math.round(Math.max(260, Math.min(1100, W * H / 1500)));
      parts = []; for (var k = 0; k < n; k++) parts.push(spawn(true));
      lines();
      ctx.clearRect(0, 0, W, H);
    }
    function binOf(sp) { return Math.max(0, Math.min(NB - 1, Math.round((sp - 0.55) / 1.1 * (NB - 1)))); }
    function lines() { // streamlines past the fixed cylinders, each segment colored by the local speed, drawn once per layout
      sl.width = cv.width; sl.height = cv.height; slx.setTransform(dpr, 0, 0, dpr, 0, 0); slx.clearRect(0, 0, W, H);
      var keep = ptr; ptr = null;
      var rows = Math.max(18, Math.round(H / 15)), segs = []; for (var b = 0; b < NB; b++) segs.push([]);
      for (var r = 0; r < rows; r++) {
        var x = -10, y = (r + 0.5) * H / rows;
        for (var st = 0; st < 1600 && x < W + 10; st++) {
          var v = vel(x, y), m = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1, nx = x + 3 * v[0] / m, ny = y + 3 * v[1] / m;
          if (inside(nx, ny)) break;
          segs[binOf(m)].push(x, y, nx, ny); x = nx; y = ny;
        }
      }
      slx.lineWidth = 1.2; slx.lineCap = 'round';
      for (var b2 = 0; b2 < NB; b2++) { var a = segs[b2]; if (!a.length) continue; slx.strokeStyle = bins[b2]; slx.beginPath(); for (var j = 0; j < a.length; j += 4) { slx.moveTo(a[j], a[j + 1]); slx.lineTo(a[j + 2], a[j + 3]); } slx.stroke(); }
      ptr = keep;
    }
    function all() { return ptr ? obs.concat([ptr]) : obs; }
    function inside(x, y) { var o = all(); for (var k = 0; k < o.length; k++) { var dx = x - o[k].x, dy = y - o[k].y; if (dx * dx + dy * dy < o[k].a * o[k].a) return true; } return false; }
    function spawn(anywhere) {
      var p = { x: anywhere ? Math.random() * W : -Math.random() * 40, y: Math.random() * H, age: 0, life: 4 + Math.random() * 6, h: [], bin: 0 };
      if (inside(p.x, p.y)) p.x = -10;
      p.h.push(p.x, p.y);
      return p;
    }
    function vel(x, y) { // u - i v = U (1 - sum a^2 / (z - z_k)^2), plus a slow sway
      var u = 1, v = 0, o = all();
      for (var k = 0; k < o.length; k++) {
        var dx = x - o[k].x, dy = y - o[k].y, r2 = dx * dx + dy * dy; if (r2 < 1) r2 = 1;
        var q = o[k].a * o[k].a / (r2 * r2); u -= q * (dx * dx - dy * dy); v -= q * 2 * dx * dy;
      }
      v += 0.06 * Math.sin(x * 0.006 - time * 0.5) * Math.cos(y * 0.004 + time * 0.3);
      return [u, v];
    }
    function step(dt) { // move every tracer, keep its last L positions, and draw them as a fading trail
      var U = W / 9;
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k], v = vel(p.x, p.y), sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        var nx = p.x + v[0] * U * dt, ny = p.y + v[1] * U * dt;
        p.age += dt;
        if (nx > W + 4 || ny < -4 || ny > H + 4 || p.age > p.life || inside(nx, ny)) { parts[k] = spawn(false); continue; }
        p.bin = binOf(sp);
        p.x = nx; p.y = ny; p.h.unshift(nx, ny); if (p.h.length > 2 * L) p.h.length = 2 * L;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = dark ? 0.2 : 0.26; ctx.drawImage(sl, 0, 0, W, H);
      ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      for (var age = 0; age < L - 1; age++) {
        ctx.globalAlpha = ALPHA * (1 - age / (L - 1));
        for (var b = 0; b < NB; b++) {
          var any = false;
          ctx.beginPath();
          for (var j = 0; j < parts.length; j++) {
            var q = parts[j], hh = q.h, i0 = 2 * age;
            if (q.bin !== b || hh.length < i0 + 4) continue;
            ctx.moveTo(hh[i0], hh[i0 + 1]); ctx.lineTo(hh[i0 + 2], hh[i0 + 3]); any = true;
          }
          if (any) { ctx.strokeStyle = bins[b]; ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
      drawBodies();
    }
    function drawBodies() {
      var o = all();
      for (var k = 0; k < o.length; k++) {
        ctx.beginPath(); ctx.arc(o[k].x, o[k].y, o[k].a, 0, Math.PI * 2);
        ctx.fillStyle = dark ? '#1c1c1b' : '#ffffff'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = dark ? 'rgba(232,230,225,.55)' : 'rgba(31,30,27,.45)'; ctx.stroke();
      }
    }
    function still() { // the streamlines alone, for reduced motion and while paused
      ctx.clearRect(0, 0, W, H); ctx.globalAlpha = dark ? 0.6 : 0.65; ctx.drawImage(sl, 0, 0, W, H); ctx.globalAlpha = 1; drawBodies();
    }
    function loop(ts) {
      raf = 0; if (!running) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts; time += dt;
      if (ptr && ptrT) { ptr.x += (ptrT.x - ptr.x) * 0.25; ptr.y += (ptrT.y - ptr.y) * 0.25; }
      step(dt); raf = requestAnimationFrame(loop);
    }
    function start() { if (running || paused || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    layout(); if (paused) still(); else start();
    var rt = 0; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); if (paused) still(); }, 150); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }).observe(host);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    var hero = host.parentElement;
    hero.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      ptrT = { x: x, y: y }; if (!ptr) ptr = { x: x, y: y, a: Math.min(W, H * 1.6) * 0.035 };
      if (paused) still();
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { ptr = null; ptrT = null; if (paused) still(); }, { passive: true });
    return { pause: function () { stop(); still(); }, play: function () { start(); } };
  })();

  // ---------------------------------------------------------------------------------------------- 2. the clips
  var vids = Array.prototype.slice.call(document.querySelectorAll('video.sim')), seen = new Set();
  function play(v) { if (paused) return; var p = v.play(); if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ }); }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { seen.add(e.target); if (e.target.preload === 'none') e.target.preload = 'auto'; play(e.target); }
        else { seen.delete(e.target); e.target.pause(); }
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { io.observe(v); });
  }
  var toggle = document.getElementById('motion');
  if (toggle && (vids.length || flow)) {
    toggle.hidden = false;
    var label = function () { toggle.textContent = paused ? 'Play animations' : 'Pause animations'; toggle.setAttribute('aria-pressed', paused ? 'true' : 'false'); };
    label();
    toggle.addEventListener('click', function () {
      paused = !paused; label();
      vids.forEach(function (v) { if (paused) v.pause(); else if (seen.has(v)) play(v); });
      if (flow) { if (paused) flow.pause(); else flow.play(); }
    });
  }

  // ---------------------------------------------------------------------------------------------- 3. countdown
  var left = document.querySelector('[data-left]'), now = document.querySelector('[data-now]');
  function tick() {
    var t = Date.now(), ms = END - t;
    if (ms <= 0) { Array.prototype.forEach.call(document.querySelectorAll('[data-sale]'), function (el) { el.hidden = true; }); return false; }
    if (left) {
      var m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
      var parts = d > 0 ? [d + (d === 1 ? ' day' : ' days'), h + (h === 1 ? ' hour' : ' hours')] : [h + (h === 1 ? ' hour' : ' hours'), mm + (mm === 1 ? ' minute' : ' minutes')];
      left.textContent = 'Ends in ' + parts.join(' ') + ', on Monday, November 30';
    }
    if (now) { now.hidden = false; now.style.left = (Math.max(0, Math.min(1, (t - START) / (END - START))) * 100).toFixed(2) + '%'; }
    return true;
  }
  if (tick()) setInterval(tick, 30000);

  // ---------------------------------------------------------------------------------------------- 4. copy buttons
  Array.prototype.forEach.call(document.querySelectorAll('button[data-copy]'), function (b) {
    if (!navigator.clipboard) return;
    b.hidden = false;
    b.addEventListener('click', function () {
      var code = b.getAttribute('data-copy');
      navigator.clipboard.writeText(code).then(function () {
        b.textContent = 'Copied'; b.classList.add('done');
        setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('done'); }, 1800);
      }, function () { /* clipboard refused: the code stays on screen */ });
    });
  });
})();
