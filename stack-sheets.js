/*
 * StackSheets — анимация стека шторок.
 * Без зависимостей. Подключается обычным <script>, создаёт глобальный StackSheets.
 *
 * Правила (из описания в Figma):
 *  - Вторая шторка выезжает снизу. Открытие: 360 мс, slow-02, productive-entrance.
 *  - Закрытие: 300 мс, slow-01, productive-exit.
 *  - Первая шторка своей анимации не имеет, она следует за положением второй.
 *    Пока вторая проходит путь 50→100%, первая уменьшается 1→0.90 (scale-medium)
 *    и становится серой плашкой Stack. При закрытии то же самое в обратную сторону.
 *  - Свайп вниз: шторка следует за пальцем без анимации. Отпустили до порога —
 *    возврат на место 300 мс, productive-bounce. После порога — обычное закрытие.
 *  - Затемнение не анимируется (оно общее и живёт вне этого компонента).
 */
(function (global) {
  'use strict';

  /* Токены анимации. Значения и названия совпадают с описанием в Figma. */
  var TOKENS = {
    'slow-01': 300,
    'slow-02': 360,
    'scale-medium': 0.9,
    'productive-entrance': [0, 0, 0.38, 0.9],
    'productive-exit': [0.2, 0, 1, 0.9],
    'productive-bounce': [0.22, 1.12, 0.37, 1.02]
  };

  var MOTION = {
    open:   { duration: TOKENS['slow-02'], easing: TOKENS['productive-entrance'] },
    close:  { duration: TOKENS['slow-01'], easing: TOKENS['productive-exit'] },
    bounce: { duration: TOKENS['slow-01'], easing: TOKENS['productive-bounce'] }
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* cubic-bezier с тем же поведением, что в CSS */
  function bezier(x1, y1, x2, y2) {
    function cx(t) { return 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t; }
    function cy(t) { return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t; }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 40; i++) {
        var v = cx(t);
        if (Math.abs(v - x) < 1e-6) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return cy(t);
    };
  }

  var EASE = {};
  Object.keys(MOTION).forEach(function (k) {
    var e = MOTION[k].easing;
    EASE[k] = bezier(e[0], e[1], e[2], e[3]);
  });

  /*
   * options:
   *   screen   — контейнер, по клику на пустую область которого (затемнение) закрывается вторая шторка
   *   first    — элемент первой шторки (transform-origin: 50% 0 задаётся в CSS)
   *   second   — элемент второй шторки
   *   plate    — слой поверх первой шторки, который проявляется в серую плашку Stack
   *   travel   — путь второй шторки от края экрана до своего места, px
   *   lift     — ДОПУЩЕНИЕ: смещение первой шторки вверх в конце, px (в описании не указано)
   *   minScale — scale первой шторки в конце, по умолчанию scale-medium
   *   threshold— ДОПУЩЕНИЕ: доля пути, после которой свайп закрывает шторку (в описании не указан)
   *   onUpdate — вызывается на каждом кадре: { progress, scale, mode, motion }
   */
  function create(options) {
    var o = options || {};
    var first = o.first, second = o.second, plate = o.plate, screen = o.screen;
    var travel = o.travel || 734;
    var lift = o.lift == null ? 20 : o.lift;
    var minScale = o.minScale == null ? TOKENS['scale-medium'] : o.minScale;
    var threshold = o.threshold == null ? 0.3 : o.threshold;
    var onUpdate = o.onUpdate || function () {};

    var p = 0;                 /* путь второй шторки: 0 за экраном, 1 на своём месте */
    var isOpen = false;        /* целевое состояние */
    var slow = 1;              /* множитель длительности для отладки */
    var anim = null, dragging = false, moved = false, startY = 0, startP = 0;
    var mode = 'closed', motion = null;

    function emit() {
      var t = clamp((p - 0.5) / 0.5, 0, 1);       /* первая шторка идёт на отрезке 50–100% */
      var scale = 1 - (1 - minScale) * t;
      second.style.transform = 'translateY(' + ((1 - p) * travel).toFixed(2) + 'px)';
      first.style.transform = 'translateY(' + (-lift * t).toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
      if (plate) plate.style.opacity = t;
      onUpdate({ progress: p, scale: scale, mode: mode, motion: motion });
    }

    function frame(now) {
      if (!anim) return;
      var k = (now - anim.start) / anim.dur;
      if (k >= 1) {
        p = anim.target; anim = null; motion = null;
        mode = isOpen ? 'open' : 'closed';
        emit();
        return;
      }
      p = anim.p0 + (anim.target - anim.p0) * anim.ease(k);
      emit();
      requestAnimationFrame(frame);
    }

    /* Новая анимация всегда стартует от текущего положения с полной длительностью токена. */
    function run(kind, target) {
      motion = kind;
      anim = { p0: p, target: target, dur: MOTION[kind].duration * slow, ease: EASE[kind], start: performance.now() };
      requestAnimationFrame(frame);
    }

    function open()  { isOpen = true;  mode = 'opening';   run('open', 1); }
    function close() { isOpen = false; mode = 'closing';   run('close', 0); }
    function bounceBack() { isOpen = true; mode = 'bouncing'; run('bounce', 1); }

    /* Жесты */
    first.addEventListener('click', function () { if (!isOpen) open(); });

    if (screen) {
      screen.addEventListener('click', function (e) {
        if (e.target === screen && isOpen) close();   /* клик по затемнению */
      });
    }

    second.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false; startY = e.clientY; startP = p; anim = null; motion = null;
      second.setPointerCapture(e.pointerId);
    });
    second.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dy = Math.max(0, e.clientY - startY);
      if (dy > 6 && !moved) { moved = true; mode = 'dragging'; second.classList.add('is-dragging'); }
      if (moved) { p = clamp(startP - dy / travel, 0, 1); emit(); }
    });
    function release() {
      if (!dragging) return;
      dragging = false;
      second.classList.remove('is-dragging');
      if (!moved) { close(); return; }                 /* тап по второй шторке закрывает её */
      if (1 - p > threshold) close(); else bounceBack();
    }
    second.addEventListener('pointerup', release);
    second.addEventListener('pointercancel', release);

    emit();

    return {
      open: open,
      close: close,
      /* Ручная установка прогресса 0..1 (для проверки анимации по кадрам) */
      setProgress: function (v) {
        anim = null; motion = null;
        p = clamp(v, 0, 1); isOpen = p >= 1; mode = 'manual'; emit();
      },
      setSlow: function (k) { slow = k > 0 ? k : 1; },
      setThreshold: function (v) { threshold = clamp(v, 0, 1); },
      get progress() { return p; },
      get isOpen() { return isOpen; }
    };
  }

  global.StackSheets = { create: create, TOKENS: TOKENS, MOTION: MOTION, bezier: bezier };
})(window);
