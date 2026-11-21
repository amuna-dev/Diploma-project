// Есть ли на устройстве шрифт Satoshi? Если нет — CSS подгоняет
// ширину похожего шрифта Inter под макет (класс no-satoshi на <html>).
(function () {
  var root = document.documentElement;
  var probe = document.createElement('span');
  probe.textContent = 'mmmmmmmmmmlli WEPRO';
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:72px;font-family:monospace;visibility:hidden';
  root.appendChild(probe);
  var base = probe.offsetWidth;
  probe.style.fontFamily = '"Satoshi", monospace';
  if (probe.offsetWidth === base) root.classList.add('no-satoshi');
  root.removeChild(probe);
})();

// ES-модули не работают, если открыть файл двойным кликом (адрес file://)
if (location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', function () {
    var note = document.createElement('p');
    note.className = 'noscript';
    note.lang = 'ru';
    note.textContent = 'Откройте сайт через Live Server (VS Code) или любой локальный сервер — по адресу file:// браузер блокирует JavaScript-модули.';
    document.body.prepend(note);
  });
}
