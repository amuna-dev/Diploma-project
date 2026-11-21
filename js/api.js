// Клиент для Sandbox Shop API.
// Все запросы к бэкенду проходят через функцию request(): она добавляет токен,
// превращает ответ в JSON и выбрасывает ApiError с понятным сообщением при ошибке.

import { API_BASE } from './config.js';
import { session } from './session.js';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP-код (0 — нет сети)
    this.data = data;
  }
}

// Запасные тексты, если сервер не прислал поле message
const FALLBACK_MESSAGES = {
  0: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  400: 'Проверьте введённые данные.',
  401: 'Войдите в аккаунт, чтобы продолжить.',
  403: 'Недостаточно прав для этого действия.',
  404: 'Ничего не найдено.',
  409: 'Действие невозможно: превышен лимит или данные уже заняты.',
  429: 'Слишком много запросов. Подождите минуту и попробуйте снова.',
  500: 'Ошибка сервера. Попробуйте позже.',
};

const TIMEOUT_MS = 15000;

async function request(path, { method = 'GET', body, query, keepalive = false } = {}) {
  const url = new URL(API_BASE + path);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = session.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  let text;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal: controller.signal,
    });
    text = await response.text();
  } catch {
    throw new ApiError(FALLBACK_MESSAGES[0], 0);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // Токен истёк, недействителен или был сделан logout — сессия больше не нужна
    if (response.status === 401 && token) session.clear();

    const message =
      (data && data.message) || FALLBACK_MESSAGES[response.status] || FALLBACK_MESSAGES[500];
    throw new ApiError(message, response.status, data);
  }

  return data;
}

const id = (value) => encodeURIComponent(value);

export const api = {
  // ---------- Auth ----------
  /** @param {{name, surname, phone, email, password}} payload */
  register: (payload) => request('/register', { method: 'POST', body: payload }),
  login: (email, password) => request('/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/logout', { method: 'POST' }),
  me: () => request('/me'),

  // ---------- Каталог (без токена) ----------
  /** @param {{category?, minPrice?, maxPrice?, page?, limit?}} params */
  getProducts: (params = {}) => request('/products', { query: params }),
  getNewest: (limit = 8) => request('/products/newest', { query: { limit } }),
  getBestsellers: (limit = 8) => request('/products/bestsellers', { query: { limit } }),
  getProduct: (productId) => request(`/products/${id(productId)}`),
  getCategories: () => request('/categories'),

  // ---------- Корзина (по токену) ----------
  getCart: () => request('/cart'),
  addToCart: (productId, qty = 1) => request('/cart', { method: 'POST', body: { productId, qty } }),
  setCartQty: (productId, qty, { keepalive = false } = {}) =>
    request(`/cart/${id(productId)}`, { method: 'PATCH', body: { qty }, keepalive }),
  removeFromCart: (productId) => request(`/cart/${id(productId)}`, { method: 'DELETE' }),

  // ---------- Заказы (по токену) ----------
  createOrder: () => request('/orders', { method: 'POST' }),
  getOrders: () => request('/orders'),

  // ---------- Комментарии (по токену) ----------
  addComment: (productId, text) =>
    request(`/products/${id(productId)}/comments`, { method: 'POST', body: { text } }),
};
