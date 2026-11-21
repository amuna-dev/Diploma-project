import { api } from './api.js';
import { LIMITS } from './config.js';
import { STORAGE_BLOCKED_MESSAGE } from './session.js';

const KEY = 'wepro.guestCart';
const NOTICE_KEY = 'wepro.mergeNotice';

function sanitize(items) {
  if (!Array.isArray(items)) return [];
  const result = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.productId !== 'string' || !item.productId) continue;
    if (result.some((saved) => saved.productId === item.productId)) continue;
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;
    result.push({
      productId: item.productId,
      title: String(item.title ?? ''),
      price: Number(item.price) || 0,
      image: typeof item.image === 'string' ? item.image : '',
      qty: Math.min(LIMITS.maxQty, qty),
    });
    if (result.length === LIMITS.maxCartPositions) break;
  }
  return result;
}

function read() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return [];
  }
}

function write(items) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

function snapshot(product) {
  return { productId: product._id, title: product.title, price: Number(product.price) || 0, image: product.image };
}

export const guestCart = {
  items() {
    return read();
  },

  count() {
    return read().reduce((sum, item) => sum + item.qty, 0);
  },

  add(product, qty) {
    const items = read();
    const existing = items.find((item) => item.productId === product._id);
    let added;
    if (existing) {
      if (existing.qty >= LIMITS.maxQty) throw new Error(`You can add up to ${LIMITS.maxQty} pcs. of one product.`);
      added = Math.min(qty, LIMITS.maxQty - existing.qty);
      Object.assign(existing, snapshot(product), { qty: existing.qty + added });
    } else {
      if (items.length >= LIMITS.maxCartPositions) throw new Error(`Your bag is full: up to ${LIMITS.maxCartPositions} products.`);
      added = Math.min(qty, LIMITS.maxQty);
      items.push({ ...snapshot(product), qty: added });
    }
    if (!write(items)) throw new Error(STORAGE_BLOCKED_MESSAGE);
    return added;
  },

  setQty(productId, qty) {
    write(read().map((item) => (item.productId === productId ? { ...item, qty: Math.min(LIMITS.maxQty, Math.max(1, qty)) } : item)));
  },

  remove(productId) {
    write(read().filter((item) => item.productId !== productId));
  },
};

export function toCart(items) {
  const withSums = items.map((item) => ({ ...item, sum: Math.round(item.price * item.qty * 100) / 100 }));
  const total = Math.round(withSums.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100;
  return { items: withSums, total };
}

export async function refreshGuestCart() {
  const items = read();
  const fresh = await Promise.all(
    items.map(async (item) => {
      try {
        const { product } = await api.getProduct(item.productId);
        return { ...snapshot(product), qty: item.qty };
      } catch (error) {
        return error.status === 404 ? null : item;
      }
    }),
  );
  const current = read();
  const result = fresh
    .filter(Boolean)
    .map((item) => ({ item, now: current.find((c) => c.productId === item.productId) }))
    .filter(({ now }) => now)
    .map(({ item, now }) => ({ ...item, qty: now.qty }));
  write(result);
  return result;
}

export async function mergeGuestCart() {
  const items = read();
  const retry = [];
  const skipped = [];
  for (const item of items) {
    try {
      await api.addToCart(item.productId, item.qty);
    } catch (error) {
      if (error.status === 401) throw error;
      if (error.status === 0 || error.status === 429 || error.status >= 500) retry.push(item);
      else skipped.push(`${item.title} × ${item.qty}`);
    }
  }
  write(retry);
  if (!skipped.length) return;
  try {
    const previous = JSON.parse(sessionStorage.getItem(NOTICE_KEY));
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify([...(Array.isArray(previous) ? previous : []), ...skipped]));
  } catch {
    return;
  }
}

export function takeMergeNotice() {
  try {
    const list = JSON.parse(sessionStorage.getItem(NOTICE_KEY));
    sessionStorage.removeItem(NOTICE_KEY);
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}
