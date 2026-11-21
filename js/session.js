// Хранение сессии пользователя (токен, профиль, количество товаров в корзине) в localStorage.
// Все обращения обёрнуты в try/catch: в приватном режиме браузер может запретить localStorage.

const KEYS = {
  token: 'wepro.token',
  user: 'wepro.user',
  cartCount: 'wepro.cartCount',
};

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* хранилище недоступно — просто ничего не сохраняем */
  }
}

export const STORAGE_BLOCKED_MESSAGE =
  'Your browser blocks site data for this page. Allow cookies and site data, then try again.';

export const session = {
  get available() {
    try {
      const probe = 'wepro.probe';
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  },

  get token() {
    return read(KEYS.token);
  },

  get isLoggedIn() {
    return Boolean(read(KEYS.token));
  },

  get user() {
    try {
      return JSON.parse(read(KEYS.user));
    } catch {
      return null;
    }
  },

  set user(user) {
    write(KEYS.user, user ? JSON.stringify(user) : null);
  },

  get cartCount() {
    return Number(read(KEYS.cartCount)) || 0;
  },

  set cartCount(count) {
    write(KEYS.cartCount, String(Math.max(0, Number(count) || 0)));
  },

  /** Сохраняет токен и профиль после входа / регистрации */
  start(token, user) {
    write(KEYS.token, token);
    this.user = user;
  },

  /** Полностью очищает сессию (выход, истёкший токен) */
  clear() {
    write(KEYS.token, null);
    write(KEYS.user, null);
    write(KEYS.cartCount, null);
  },
};
