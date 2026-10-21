/* Демо-страница: наполняет шторки строками и связывает панель проверки с компонентом. */
(function () {
  'use strict';

  function makeRows(el, n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="row"><span class="ic">i</span><span class="t">Title here</span><span class="v">Value</span><span class="ic">i</span></div>';
    }
    el.innerHTML = h;
  }
  makeRows(document.getElementById('rows1'), 10);
  makeRows(document.getElementById('rows2'), 10);

  var $ = function (id) { return document.getElementById(id); };
  var LABELS = {
    closed: 'Закрыто', opening: 'Открывается', open: 'Открыто', closing: 'Закрывается',
    bouncing: 'Возврат на место', dragging: 'Перетаскивание', manual: 'Вручную'
  };
  var rows = { open: $('t-open'), close: $('t-close'), bounce: $('t-bounce') };

  var sheets = StackSheets.create({
    screen: $('screen'),
    first: $('s1'),
    second: $('s2'),
    plate: $('plate'),
    travel: 734,
    onUpdate: function (s) {
      var pc = Math.min(1, Math.max(0, s.progress)) * 100;
      $('rP').textContent = Math.round(s.progress * 100) + '%';
      $('rS').textContent = s.scale.toFixed(3);
      $('rM').textContent = LABELS[s.mode] || s.mode;
      $('barI').style.width = pc + '%';
      $('scrub').value = pc;
      $('scrubV').textContent = Math.round(pc) + '%';
      for (var k in rows) rows[k].classList.toggle('on', k === s.motion);
    }
  });

  $('bOpen').addEventListener('click', sheets.open);
  $('bClose').addEventListener('click', sheets.close);
  $('scrub').addEventListener('input', function () { sheets.setProgress(Number(this.value) / 100); });
  $('slow').addEventListener('input', function () {
    sheets.setSlow(Number(this.value));
    $('slowV').textContent = '×' + this.value;
  });
  $('thr').addEventListener('input', function () {
    sheets.setThreshold(Number(this.value) / 100);
    $('thrV').textContent = this.value + '%';
  });
})();
