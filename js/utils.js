// Небольшие вспомогательные функции, которые используются на разных страницах.

/** Экранирует текст перед вставкой в HTML (защита от XSS в названиях и комментариях) */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** 47.99 → "$47.99", 260 → "$260", 16.9 → "$16.90" */
export function formatPrice(value) {
  const number = Number(value) || 0;
  const rounded = Math.round(number * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** ISO-дата → "August 14, 2023" (как в макете) */
export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** "998991112233" → "+998 99 111-22-33" */
export function formatPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const match = digits.match(/^998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (match) return `+998 ${match[1]} ${match[2]}-${match[3]}-${match[4]}`;
  return digits ? `+${digits}` : '';
}

export function isRussian(text) {
  return /[А-Яа-яЁё]/.test(String(text ?? ''));
}

export function setMessage(el, text) {
  el.textContent = text;
  if (isRussian(text)) el.lang = 'ru';
  else el.removeAttribute('lang');
}

/** Оставляет только цифры: "+998 90 123-45-67" → "998901234567" */
export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Значение параметра из адресной строки: ?id=123 → "123" */
export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Разрешаем возвращаться только на страницы нашего сайта (защита от open redirect).
 * "cart.html" и "product.html?id=1" — можно, "https://evil.com" — нельзя.
 */
export function safeNextUrl(value, fallback = 'profile.html') {
  if (value && /^[a-z0-9_-]+\.html(\?[\w=&%.-]*)?$/i.test(value)) return value;
  return fallback;
}

/** Текущая страница вместе с параметрами — чтобы вернуться сюда после входа */
export function pageFile() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return file.includes('.') ? file : `${file}.html`;
}

function currentPage() {
  return pageFile() + window.location.search;
}

/** Переход на страницу входа с возвратом на текущую страницу */
export function redirectToLogin(next = currentPage()) {
  window.location.href = `login.html?next=${encodeURIComponent(next)}`;
}
