// lux-rain.js — Lluvia de lujo al fondo de VlackDiamond.
// Monedas de oro, lingotes de oro y diamantes cayendo suavemente en un
// canvas fijo detrás del contenido. Sin dependencias, sin imágenes.
// - No intercepta clics (pointer-events: none en el CSS).
// - Se pausa sola si la pestaña no está visible o si el usuario prefiere
//   movimiento reducido, y se puede pausar con el botón del pie de página.
// - Pocas piezas y sin sombras costosas para que no gaste batería.
'use strict';

(function () {
  var canvas = document.getElementById('lux-rain');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var TOGGLE_KEY = 'vd_rain';
  var toggle = document.getElementById('rain-toggle');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = !reducedMotion && localStorage.getItem(TOGGLE_KEY) !== 'off';

  var pieces = [];
  var width = 0;
  var height = 0;
  var rafId = null;
  var lastTime = 0;

  function countForWidth(w) {
    if (w < 640) return 12; // celular: menos piezas
    if (w < 1100) return 20;
    return 28;
  }

  function randomPiece(y) {
    var kind = Math.random();
    var size = 12 + Math.random() * 18; // 12–30 px
    return {
      kind: kind < 0.45 ? 'coin' : kind < 0.75 ? 'bar' : 'diamond',
      x: Math.random() * width,
      y: typeof y === 'number' ? y : -size - Math.random() * height,
      size: size,
      speed: 0.35 + Math.random() * 0.9 + size / 60, // las grandes caen un poco más rápido
      sway: 0.3 + Math.random() * 0.7, // vaivén lateral
      phase: Math.random() * Math.PI * 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      twinkle: 0.55 + Math.random() * 0.45
    };
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var target = countForWidth(width);
    while (pieces.length < target) pieces.push(randomPiece());
    pieces.length = target;
  }

  // Moneda de oro: círculo dorado con aro y brillo.
  function drawCoin(p) {
    var r = p.size / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = '#f0d999';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x - r * 0.25, p.y - r * 0.25, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
  }

  // Lingote de oro: trapezoide con cara superior más clara.
  function drawBar(p) {
    var w = p.size;
    var h = p.size * 0.55;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.phase) * 0.25);
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w * 0.32, -h / 2);
    ctx.lineTo(w * 0.32, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    ctx.fillStyle = '#c9a227';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h / 2);
    ctx.lineTo(w * 0.32, -h / 2);
    ctx.lineTo(w * 0.22, -h * 0.05);
    ctx.lineTo(-w * 0.22, -h * 0.05);
    ctx.closePath();
    ctx.fillStyle = '#f0d999';
    ctx.fill();
    ctx.restore();
  }

  // Diamante: rombo con facetas claras y brillo.
  function drawDiamond(p) {
    var w = p.size * 0.5;
    var h = p.size * 0.62;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.phase) * 0.2);
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fillStyle = '#a8d4f0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#d6ecfb';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(-w, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#7fb7e8';
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    if (!running) { rafId = null; return; }
    var dt = Math.min((now - lastTime) / 16.7, 3) || 1; // ~60 fps, con tope
    lastTime = now;
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      p.phase += 0.02 * dt;
      p.y += p.speed * dt;
      p.x += Math.sin(p.phase) * p.sway * 0.4 * dt;
      p.angle += p.spin * dt;
      if (p.y - p.size > height) {
        pieces[i] = randomPiece(-p.size);
        continue;
      }
      // Brillo suave: cada pieza parpadea un poco al caer.
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(p.phase * 1.5) * p.twinkle;
      if (p.kind === 'coin') drawCoin(p);
      else if (p.kind === 'bar') drawBar(p);
      else drawDiamond(p);
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId !== null || !running) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    ctx.clearRect(0, 0, width, height);
  }

  function syncToggleButton() {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(running));
    toggle.textContent = running ? '✨ Pausar lluvia dorada' : '✨ Activar lluvia dorada';
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (running) {
        stop();
        localStorage.setItem(TOGGLE_KEY, 'off');
      } else {
        running = true;
        localStorage.setItem(TOGGLE_KEY, 'on');
        start();
      }
      syncToggleButton();
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (running) {
      start();
    }
  });

  window.addEventListener('resize', resize);
  resize();
  syncToggleButton();
  if (running) start();
})();
