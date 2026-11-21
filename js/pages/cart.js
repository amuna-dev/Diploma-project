// Корзина: список позиций, изменение количества, удаление, итог (считает сервер),
// оформление заказа (POST /orders).

import { api } from '../api.js';
import { LIMITS } from '../config.js';
import { announce, countCartItems, initLayout, setBagCount } from '../layout.js';
import { guestCart, mergeGuestCart, refreshGuestCart, takeMergeNotice, toCart } from '../guest-cart.js';
import { closeModal, initModal, openModal } from '../modal.js';
import { session } from '../session.js';
import { handleBrokenImages, setButtonLoading, statusMessage } from '../ui.js';
import { escapeHtml, formatPrice, redirectToLogin, setMessage } from '../utils.js';

initLayout({ refreshBag: false });
handleBrokenImages();

const els = {
  list: document.getElementById('cart-list'),
  summary: document.querySelector('.summary'),
  total: document.getElementById('cart-total'),
  checkout: document.getElementById('checkout'),
  message: document.getElementById('checkout-message'),
  orderModal: document.getElementById('order-modal'),
  orderOk: document.getElementById('order-ok'),
};

let cart = { items: [], total: 0 };
const pendingQty = new Map(); // productId → { qty, timer } отложенного PATCH
const sentQty = new Map();
let mutationFailed = false;

// ---------- Отрисовка ----------

function cartItem(item) {
  const title = escapeHtml(item.title);
  const href = `product.html?id=${encodeURIComponent(item.productId)}`;

  return `
    <li class="cart-item" data-id="${escapeHtml(item.productId)}">
      <a class="cart-item__image" href="${href}" tabindex="-1" aria-hidden="true">
        <img src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async">
      </a>
      <div class="cart-item__info">
        <div class="cart-item__text">
          <a class="cart-item__title" href="${href}">${title}</a>
          <p class="cart-item__price" data-sum>${formatPrice(item.sum ?? item.price * item.qty)}</p>
        </div>
        <div class="cart-item__actions">
          <button class="cart-item__remove" type="button" data-remove aria-label="Remove ${title}">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <use href="assets/icons/sprite.svg#trash"></use>
            </svg>
          </button>
          <div class="qty qty--cart" role="group" aria-label="Quantity of ${title}">
            <button class="qty__btn" type="button" data-step="-1" aria-label="Decrease quantity of ${title}"
                    ${item.qty <= 1 ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><use href="assets/icons/sprite.svg#minus"></use></svg>
            </button>
            <span class="qty__value" data-qty>${Number(item.qty) || 0}</span>
            <button class="qty__btn" type="button" data-step="1" aria-label="Increase quantity of ${title}"
                    ${item.qty >= LIMITS.maxQty ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><use href="assets/icons/sprite.svg#plus"></use></svg>
            </button>
          </div>
        </div>
      </div>
    </li>`;
}

function renderTotal() {
  // В макете пустая корзина показывает "0", а полная — "$467"
  els.total.textContent = cart.items.length ? formatPrice(cart.total) : '0';
}

let focusAfterRender = null;

function rememberFocus() {
  if (focusAfterRender) {
    const saved = focusAfterRender;
    focusAfterRender = null;
    return saved;
  }
  const el = document.activeElement;
  const row = el && el.closest ? el.closest('.cart-item') : null;
  if (!row || !els.list.contains(row)) return null;
  if (el.dataset.step) return { id: row.dataset.id, selector: `[data-step="${el.dataset.step}"]` };
  if (el.hasAttribute('data-remove')) return { id: row.dataset.id, selector: '[data-remove]' };
  return { id: row.dataset.id, selector: '.cart-item__title' };
}

function restoreFocus(saved) {
  if (!saved) return;
  const row = [...els.list.querySelectorAll('.cart-item')].find((r) => r.dataset.id === saved.id);
  if (!row) {
    els.checkout.focus({ preventScroll: true });
    return;
  }
  const target = row.querySelector(saved.selector);
  const fallback = row.querySelector('[data-step]:not(:disabled)') || row.querySelector('.cart-item__title');
  (target && !target.disabled ? target : fallback).focus({ preventScroll: true });
}

function render() {
  const saved = rememberFocus();
  setBagCount(countCartItems(cart));
  renderTotal();
  els.summary.classList.toggle('is-empty', !cart.items.length);

  if (!cart.items.length) {
    els.list.innerHTML = '<li class="cart-empty">No products in your bag</li>';
    restoreFocus(saved);
    return;
  }
  els.list.innerHTML = cart.items.map(cartItem).join('');
  restoreFocus(saved);
}

function withPendingQty(items) {
  return items.map((item) => {
    const qty = pendingQty.get(item.productId)?.qty ?? sentQty.get(item.productId);
    if (qty === undefined) return item;
    return { ...item, qty, sum: Math.round(item.price * qty * 100) / 100 };
  });
}

function applyCart(newCart) {
  const items = withPendingQty(newCart?.items || []);
  const total = (pendingQty.size || sentQty.size)
    ? Math.round(items.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100
    : newCart?.total || 0;
  cart = { items, total };
  render();
}

// ---------- Загрузка ----------

async function loadCart() {
  els.list.setAttribute('aria-busy', 'true');
  try {
    if (!session.isLoggedIn) {
      applyCart(toCart(guestCart.items()));
      applyCart(toCart(await refreshGuestCart()));
      return;
    }
    const data = await api.getCart();
    applyCart(data.cart);
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin('cart.html');
      return;
    }
    els.list.innerHTML = `<li>${statusMessage(error.message, { type: 'error', retry: true })}</li>`;
    els.list.querySelector('[data-retry]')?.addEventListener('click', loadCart);
  } finally {
    els.list.removeAttribute('aria-busy');
  }
}

// ---------- Изменение количества (с задержкой, чтобы не спамить сервер) ----------

let queue = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function handleMutationError(error) {
  mutationFailed = true;
  if (error.status === 401) {
    redirectToLogin('cart.html');
    return;
  }
  showMessage(error.message);
  await loadCart(); // возвращаем настоящее состояние с сервера
}

function settleQty(productId, qty) {
  if (sentQty.get(productId) === qty) sentQty.delete(productId);
}

function sendQty(productId) {
  const pending = pendingQty.get(productId);
  if (!pending) return queue;
  clearTimeout(pending.timer);
  pendingQty.delete(productId);
  sentQty.set(productId, pending.qty);
  return enqueue(async () => {
    try {
      const data = await api.setCartQty(productId, pending.qty);
      settleQty(productId, pending.qty);
      if (data?.cart) applyCart(data.cart);
      else await loadCart();
    } catch (error) {
      settleQty(productId, pending.qty);
      await handleMutationError(error);
    }
  });
}

function sendQtyOnLeave() {
  const latest = new Map(sentQty);
  pendingQty.forEach((pending, productId) => {
    clearTimeout(pending.timer);
    latest.set(productId, pending.qty);
  });
  pendingQty.clear();
  latest.forEach((qty, productId) => {
    sentQty.set(productId, qty);
    api.setCartQty(productId, qty, { keepalive: true })
      .catch(() => {})
      .finally(() => settleQty(productId, qty));
  });
}

function scheduleQtyUpdate(productId, qty) {
  const previous = pendingQty.get(productId);
  if (previous) clearTimeout(previous.timer);
  pendingQty.set(productId, { qty, timer: setTimeout(() => sendQty(productId), 400) });
}

function flushQtyUpdates() {
  [...pendingQty.keys()].forEach(sendQty);
  return queue;
}

els.list.addEventListener('click', (event) => {
  const row = event.target.closest('.cart-item');
  if (!row) return;
  const productId = row.dataset.id;
  const item = cart.items.find((i) => i.productId === productId);
  if (!item) return;

  const stepButton = event.target.closest('[data-step]');
  if (stepButton) {
    const newQty = Math.min(LIMITS.maxQty, Math.max(1, item.qty + Number(stepButton.dataset.step)));
    if (newQty === item.qty) return;

    if (!session.isLoggedIn) {
      guestCart.setQty(productId, newQty);
      applyCart(toCart(guestCart.items()));
      announce(`${item.title}: ${newQty} pcs.`);
      return;
    }

    // сразу показываем новое число, сервер обновим чуть позже
    item.qty = newQty;
    item.sum = Math.round(item.price * newQty * 100) / 100;
    row.querySelector('[data-qty]').textContent = String(newQty);
    row.querySelector('[data-sum]').textContent = formatPrice(item.sum);
    row.querySelector('[data-step="-1"]').disabled = newQty <= 1;
    row.querySelector('[data-step="1"]').disabled = newQty >= LIMITS.maxQty;
    if (stepButton.disabled) row.querySelector('[data-step]:not(:disabled)')?.focus({ preventScroll: true });
    cart.total = cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    renderTotal();
    setBagCount(countCartItems(cart));

    scheduleQtyUpdate(productId, newQty);
    announce(`${item.title}: ${newQty} pcs.`);
    return;
  }

  const removeButton = event.target.closest('[data-remove]');
  if (removeButton) {
    const pending = pendingQty.get(productId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingQty.delete(productId);
    }
    if (document.activeElement === removeButton) focusAfterRender = { id: productId, selector: '[data-remove]' };
    if (!session.isLoggedIn) {
      guestCart.remove(productId);
      applyCart(toCart(guestCart.items()));
      announce(`${item.title} removed from your bag.`);
      return;
    }
    removeButton.disabled = true;
    row.classList.add('is-removing');
    enqueue(async () => {
      try {
        const data = await api.removeFromCart(productId);
        if (data?.cart) applyCart(data.cart);
        else await loadCart();
        announce(`${item.title} removed from your bag.`);
      } catch (error) {
        await handleMutationError(error);
      }
    });
  }
});

// ---------- Оформление заказа ----------

function showMessage(text) {
  setMessage(els.message, text);
  els.message.hidden = !text;
}

els.checkout.addEventListener('click', async () => {
  showMessage('');
  if (!cart.items.length) {
    showMessage('Your bag is empty. Add products first.');
    return;
  }
  if (!session.isLoggedIn) {
    redirectToLogin('cart.html');
    return;
  }
  setButtonLoading(els.checkout, true, 'Placing order…');
  els.list.inert = true;
  try {
    mutationFailed = false;
    await flushQtyUpdates();
    if (mutationFailed) return;
    if (!cart.items.length) {
      showMessage('Your bag is empty. Add products first.');
      return;
    }
    await enqueue(() => api.createOrder());
    applyCart({ items: [], total: 0 }); // сервер очищает корзину после заказа
    openModal(els.orderModal);
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin('cart.html');
      return;
    }
    showMessage(error.message);
  } finally {
    els.list.inert = false;
    setButtonLoading(els.checkout, false);
  }
});

initModal(els.orderModal);
els.orderOk.addEventListener('click', () => {
  closeModal(els.orderModal);
  window.location.href = 'profile.html#orders';
});

// ---------- Старт ----------

async function start() {
  if (session.isLoggedIn && guestCart.items().length) await mergeGuestCart().catch(() => {});
  await loadCart();
  const notice = takeMergeNotice();
  if (notice.length) showMessage(`Some products from your guest bag could not be added: ${notice.join(', ')}.`);
}

window.addEventListener('pagehide', sendQtyOnLeave);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) loadCart();
});

start();
