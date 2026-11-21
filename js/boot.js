// Есть ли на устройстве шрифт Satoshi? Если нет — CSS подгоняет
// ширину похожего шрифта Inter под макет (класс no-satoshi на <html>).
(function () {
  var root = document.documentElement;
  if (!/\/product(\.html)?$/.test(location.pathname)) return;
  if (!window.matchMedia('(max-width: 767px)').matches) return;
  if (!document.fonts || !document.fonts.load) {
    root.classList.add('no-satoshi');
    return;
  }
  window.addEventListener('load', function () {
    document.fonts.load('400 16px "Satoshi"').then(function (faces) {
      if (!faces.length) root.classList.add('no-satoshi');
    }, function () {
      root.classList.add('no-satoshi');
    });
  });
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
