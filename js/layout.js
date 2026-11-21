// Общая логика для всех страниц: шапка (Account, Bag (N)), мобильное меню.

import { api } from './api.js';
import { guestCart } from './guest-cart.js';
import { session } from './session.js';
import { pageFile, setMessage } from './utils.js';

let bagVersion = 0;
let liveRegion = null;

/** Сумма количества всех позиций корзины: 2 шт. + 1 шт. → 3 */
export function countCartItems(cart) {
  return (cart?.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

/** Обновляет число в "Bag (N)" во всех местах страницы и запоминает его */
export function setBagCount(count) {
  const value = Math.max(0, Number(count) || 0);
  bagVersion++;
  session.cartCount = value;
  document.querySelectorAll('[data-bag-count]').forEach((el) => {
    el.textContent = String(value);
  });
}

export function announce(text) {
  if (!liveRegion) return;
  liveRegion.textContent = '';
  window.setTimeout(() => setMessage(liveRegion, text), 100);
}

function createLiveRegion() {
  liveRegion = document.createElement('p');
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('role', 'status');
  document.body.append(liveRegion);
}

/** "Account" ведёт в профиль, если пользователь вошёл, иначе — на страницу входа */
function updateAccountLinks() {
  const href = session.isLoggedIn ? 'profile.html' : 'login.html';
  document.querySelectorAll('[data-account-link]').forEach((link) => {
    link.href = href;
  });
}

async function refreshBagCount() {
  if (!session.isLoggedIn) {
    setBagCount(guestCart.count());
    return;
  }

  setBagCount(session.cartCount); // сразу показываем сохранённое значение
  const version = bagVersion;

  try {
    const { cart } = await api.getCart();
    if (version === bagVersion) setBagCount(countCartItems(cart));
  } catch (error) {
    if (error.status === 401) {
      // токен больше не действует — показываем шапку гостя
      setBagCount(guestCart.count());
      updateAccountLinks();
    }
  }
}

function initMobileMenu() {
  const button = document.querySelector('[data-menu-toggle]');
  const menu = document.getElementById('mobile-menu');
  if (!button || !menu) return;

  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
  };

  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    setOpen(open);
    if (open) menu.querySelector('a')?.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    const focusWasInside = menu.contains(document.activeElement);
    setOpen(false);
    if (focusWasInside) button.focus();
  });

  // если окно растянули до десктопа — меню больше не нужно
  window.matchMedia('not all and (max-width: 767px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

function markActiveLinks() {
  const page = pageFile();
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
  });
}

/**
 * Запускается на каждой странице.
 * @param {{ refreshBag?: boolean }} options — на странице корзины количество
 *        считается из её собственного запроса, поэтому лишний запрос не нужен.
 */
export function initLayout({ refreshBag = true } = {}) {
  updateAccountLinks();
  markActiveLinks();
  initMobileMenu();
  createLiveRegion();
  if (refreshBag) refreshBagCount();
  else setBagCount(session.cartCount);

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    updateAccountLinks();
    if (refreshBag) refreshBagCount();
  });
}
