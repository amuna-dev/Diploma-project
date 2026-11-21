// Профиль: данные пользователя (GET /me), выход (POST /logout), история заказов (GET /orders).

import { api } from '../api.js';
import { initLayout } from '../layout.js';
import { session } from '../session.js';
import { handleBrokenImages, productCard, productSkeletons, setButtonLoading, statusMessage } from '../ui.js';
import { formatPhone, redirectToLogin } from '../utils.js';

if (!session.isLoggedIn) redirectToLogin('profile.html');

initLayout();
handleBrokenImages();

const els = {
  name: document.getElementById('profile-name'),
  phone: document.getElementById('profile-phone'),
  email: document.getElementById('profile-email'),
  logout: document.getElementById('logout'),
  orders: document.getElementById('orders-grid'),
};

function renderUser(user) {
  if (!user) return;
  els.name.textContent = `${user.name} ${user.surname}`.trim();
  els.phone.textContent = formatPhone(user.phone);
  els.phone.href = `tel:+${user.phone}`;
  els.email.textContent = user.email;
  els.email.href = `mailto:${user.email}`;
}

async function loadProfile() {
  renderUser(session.user); // сразу показываем сохранённые данные
  try {
    const { user } = await api.me();
    session.user = user;
    renderUser(user);
  } catch (error) {
    if (error.status === 401) redirectToLogin('profile.html');
  }
}

async function loadOrders() {
  els.orders.innerHTML = productSkeletons(4);
  try {
    const { orders } = await api.getOrders();
    // Каждая купленная позиция — отдельная карточка, новые заказы первыми (как отдаёт API)
    const items = orders.flatMap((order) => order.items || []);
    els.orders.innerHTML = items.length
      ? items
          .map((item) => productCard(item, { showPrice: false, productId: item.productId }))
          .join('')
      : statusMessage('You have no orders yet.');
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin('profile.html');
      return;
    }
    els.orders.innerHTML = statusMessage(error.message, { type: 'error', retry: true });
    els.orders.querySelector('[data-retry]')?.addEventListener('click', loadOrders);
  }
}

els.logout.addEventListener('click', async () => {
  setButtonLoading(els.logout, true, 'Logging out…');
  try {
    await api.logout(); // сервер делает все токены аккаунта недействительными
  } catch {
    /* даже если сервер недоступен — выходим локально */
  }
  session.clear();
  window.location.replace('index.html');
});

if (session.isLoggedIn) {
  loadProfile();
  loadOrders();
}

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (!session.isLoggedIn) {
    redirectToLogin('profile.html');
    return;
  }
  loadProfile();
  loadOrders();
});
