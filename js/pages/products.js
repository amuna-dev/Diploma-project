// Каталог: фильтр по категориям и цене, пагинация.
// Состояние фильтров хранится в адресной строке (?category=...&minPrice=...&page=2),
// поэтому ссылки с главной и кнопка "Назад" в браузере работают правильно.

import { api } from '../api.js';
import { PRICE_RANGE, PRODUCTS_PER_PAGE } from '../config.js';
import { initLayout } from '../layout.js';
import { closeModal, initModal, openModal } from '../modal.js';
import { handleBrokenImages, productCard, productSkeletons, statusMessage } from '../ui.js';
import { escapeHtml } from '../utils.js';

initLayout();
handleBrokenImages();

const els = {
  title: document.getElementById('catalog-title'),
  grid: document.getElementById('products-grid'),
  pagination: document.getElementById('pagination'),
  filters: document.getElementById('filters'),
  categories: document.getElementById('filter-categories'),
  priceToggle: document.getElementById('price-toggle'),
  priceBody: document.getElementById('price-body'),
  range: document.getElementById('price-range'),
  min: document.getElementById('price-min'),
  max: document.getElementById('price-max'),
  minLabel: document.getElementById('price-min-label'),
  maxLabel: document.getElementById('price-max-label'),
  apply: document.getElementById('apply-filter'),
  openFilters: document.getElementById('filters-open'),
};

const mobileQuery = window.matchMedia('(max-width: 767px)');

let categories = [];

// ---------- Состояние из адресной строки ----------

function readState() {
  const params = new URLSearchParams(window.location.search);
  const toNumber = (value, fallback) => {
    const number = Number(value);
    return value !== null && value !== '' && Number.isFinite(number) ? number : fallback;
  };

  const maxPrice = toNumber(params.get('maxPrice'), null);

  return {
    category: params.get('category') || '',
    cat: (params.get('cat') || '').toLowerCase(), // ссылки из футера: ?cat=creams
    minPrice: Math.max(0, toNumber(params.get('minPrice'), 0)),
    maxPrice: maxPrice === null ? null : Math.max(0, maxPrice),
    page: Math.max(1, Math.floor(toNumber(params.get('page'), 1))),
  };
}

// Границы ползунка: по умолчанию из config.js, затем уточняются по реальному каталогу
const bounds = { min: PRICE_RANGE.min, max: PRICE_RANGE.max };

function clamp(value) {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

let state = readState();
let draftCategory = state.category;

function writeState({ replace = false } = {}) {
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.minPrice > 0) params.set('minPrice', state.minPrice);
  if (state.maxPrice !== null) params.set('maxPrice', state.maxPrice);
  if (state.page > 1) params.set('page', state.page);

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

// ---------- Категории ----------

function renderCategories() {
  const focused = els.categories.contains(document.activeElement) ? document.activeElement.dataset.category : null;
  els.categories.innerHTML = categories
    .map((category) => {
      const active = category._id === draftCategory;
      return `
        <li>
          <button class="filter-category${active ? ' is-active' : ''}" type="button"
                  data-category="${escapeHtml(category._id)}" aria-pressed="${active}">
            <span>${escapeHtml(category.title)}</span>
            <svg class="filter-category__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <use href="assets/icons/sprite.svg#chevron-right"></use>
            </svg>
          </button>
        </li>`;
    })
    .join('');
  if (focused !== null && focused !== undefined) {
    const again = [...els.categories.querySelectorAll('[data-category]')].find((b) => b.dataset.category === focused);
    if (again) again.focus({ preventScroll: true });
  }
}

async function loadCategories() {
  try {
    ({ categories } = await api.getCategories());
  } catch {
    categories = [];
  }

  // ?cat=creams (из футера) → превращаем в id категории
  if (state.cat && !state.category) {
    const match = categories.find((c) => {
      const title = String(c.title ?? '').toLowerCase();
      return title === state.cat || title.startsWith(state.cat) || state.cat.startsWith(title);
    });
    if (match) state.category = match._id;
    writeState({ replace: true });
  }

  if (state.category && categories.length && !categories.some((c) => c._id === state.category)) {
    state.category = '';
    writeState({ replace: true });
  }

  draftCategory = state.category;
  renderCategories();
  updateTitle();
}

function updateTitle() {
  const category = categories.find((c) => c._id === state.category);
  els.title.textContent = category ? category.title : 'All products';
  document.title = `${category ? category.title : 'All products'} — WEPRO`;
}

els.categories.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;

  const id = button.dataset.category;
  draftCategory = draftCategory === id ? '' : id; // повторный клик снимает фильтр
  renderCategories();

  // На десктопе применяем сразу, в мобильной шторке — по кнопке Apply Filter
  if (!mobileQuery.matches) applyFilters();
});

// ---------- Ползунок цены (два input[type=range] друг на друге) ----------

function syncRange(changed) {
  let min = Number(els.min.value);
  let max = Number(els.max.value);

  if (min > max) {
    // ползунки не могут "перепрыгнуть" друг друга
    if (changed === els.min) min = max;
    else max = min;
    els.min.value = min;
    els.max.value = max;
  }

  // доли 0…1 — по ним CSS рисует чёрную полосу между ручками и подписи под ними
  const span = bounds.max - bounds.min || 1;
  els.range.style.setProperty('--from-ratio', String((min - bounds.min) / span));
  els.range.style.setProperty('--to-ratio', String((max - bounds.min) / span));

  els.min.classList.toggle('is-top', min >= max && min > (bounds.min + bounds.max) / 2);

  els.minLabel.textContent = `$${min}`;
  els.maxLabel.textContent = `$${max}`;
  els.min.setAttribute('aria-valuetext', `$${min}`);
  els.max.setAttribute('aria-valuetext', `$${max}`);
}

function applyBoundsToInputs() {
  for (const input of [els.min, els.max]) {
    input.min = bounds.min;
    input.max = bounds.max;
    input.step = PRICE_RANGE.step;
  }
  els.min.value = clamp(state.minPrice);
  els.max.value = state.maxPrice === null ? bounds.max : clamp(state.maxPrice);
  syncRange();
}

function initRange() {
  applyBoundsToInputs();
  els.min.addEventListener('input', () => syncRange(els.min));
  els.max.addEventListener('input', () => syncRange(els.max));
}

/**
 * Верхняя граница ползунка = цена самого дорогого товара, округлённая вверх до десятков.
 * Запрос делается один раз за сессию (результат хранится в sessionStorage).
 */
async function loadPriceBounds() {
  const KEY = 'wepro.priceMax';
  let max = null;
  try {
    max = Number(sessionStorage.getItem(KEY)) || null;
  } catch {
    /* sessionStorage недоступен */
  }

  if (!max) {
    try {
      const { products } = await api.getProducts({ limit: 100 });
      const top = Math.max(...products.map((p) => Number(p.price) || 0));
      if (top > 0) max = Math.ceil(top / 10) * 10;
      try {
        if (max) sessionStorage.setItem(KEY, String(max));
      } catch {
        /* ничего страшного */
      }
    } catch {
      return; // оставляем границы из config.js
    }
  }

  if (!max || max === bounds.max) return;
  bounds.max = max;
  applyBoundsToInputs();
}

els.priceToggle.addEventListener('click', () => {
  const expanded = els.priceToggle.getAttribute('aria-expanded') === 'true';
  els.priceToggle.setAttribute('aria-expanded', String(!expanded));
  els.priceBody.hidden = expanded;
});

// ---------- Товары ----------

let requestId = 0;

async function loadProducts() {
  const current = ++requestId;
  els.grid.setAttribute('aria-busy', 'true');
  els.grid.innerHTML = productSkeletons(PRODUCTS_PER_PAGE);
  els.pagination.innerHTML = '';

  const params = { page: state.page, limit: PRODUCTS_PER_PAGE };
  if (state.category) params.category = state.category;
  if (state.minPrice > 0) params.minPrice = state.minPrice;
  if (state.maxPrice !== null) params.maxPrice = state.maxPrice; // ручка в самом конце — без верхней границы

  try {
    const data = await api.getProducts(params);
    if (current !== requestId) return;

    // если пользователь открыл ?page=9, а страниц всего 3 — показываем последнюю
    if (data.pages > 0 && state.page > data.pages) {
      state.page = data.pages;
      writeState({ replace: true });
      return loadProducts();
    }

    els.grid.innerHTML = data.products.length
      ? data.products.map((product) => productCard(product, { headingLevel: 2 })).join('')
      : statusMessage('No products match these filters.');
    renderPagination(data.page, data.pages);
  } catch (error) {
    if (current !== requestId) return;
    els.grid.innerHTML = statusMessage(error.message, { type: 'error', retry: true });
    els.grid.querySelector('[data-retry]')?.addEventListener('click', loadProducts);
  } finally {
    if (current === requestId) els.grid.removeAttribute('aria-busy');
  }
}

function renderPagination(page, pages) {
  if (!pages || pages <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  const buttons = [];
  buttons.push(pageButton(page - 1, '‹', page <= 1, 'Previous page'));
  for (let i = 1; i <= pages; i++) {
    buttons.push(pageButton(i, String(i), false, `Page ${i}`, i === page));
  }
  buttons.push(pageButton(page + 1, '›', page >= pages, 'Next page'));
  els.pagination.innerHTML = buttons.join('');
}

function pageButton(page, label, disabled, ariaLabel, current = false) {
  return `<button class="pagination__btn${current ? ' is-current' : ''}" type="button"
            data-page="${page}" aria-label="${ariaLabel}" ${current ? 'aria-current="page"' : ''}
            ${disabled ? 'disabled' : ''}>${label}</button>`;
}

els.pagination.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled || button.classList.contains('is-current')) return;
  state.page = Number(button.dataset.page);
  writeState();
  loadProducts();
  els.title.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.title.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
});

// ---------- Применение фильтров ----------

function applyFilters() {
  const min = Number(els.min.value);
  const max = Number(els.max.value);
  state.category = draftCategory;
  state.minPrice = min > bounds.min ? min : 0;
  state.maxPrice = max < bounds.max ? max : null;
  state.page = 1;
  writeState();
  updateTitle();
  loadProducts();
}

els.apply.addEventListener('click', () => {
  applyFilters();
  closeModal(els.filters);
});

// ---------- Мобильная шторка с фильтрами ----------

initModal(els.filters);
els.openFilters.addEventListener('click', () => openModal(els.filters));
els.filters.addEventListener('modal:close', () => {
  draftCategory = state.category;
  renderCategories();
  applyBoundsToInputs();
});

// На десктопе панель фильтров всегда видна, на мобильном — это модальная шторка
function syncFiltersMode() {
  closeModal(els.filters); // если шторка была открыта — закрываем
  const panel = els.filters.querySelector('.filters__panel');
  if (mobileQuery.matches) {
    els.filters.hidden = true;
    els.filters.classList.add('is-sheet');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Filters');
  } else {
    els.filters.hidden = false;
    els.filters.classList.remove('is-sheet');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.removeAttribute('aria-label');
  }
}
mobileQuery.addEventListener('change', syncFiltersMode);
syncFiltersMode();

// Кнопки "Назад/Вперёд" в браузере
window.addEventListener('popstate', () => {
  state = readState();
  draftCategory = state.category;
  applyBoundsToInputs();
  renderCategories();
  updateTitle();
  loadProducts();
});

// ---------- Старт ----------

initRange();
loadPriceBounds();
if (state.cat || state.category) {
  // ссылка из футера (?cat=creams): сначала узнаём id категории, потом грузим товары
  loadCategories().catch(() => {}).then(loadProducts);
} else {
  loadCategories();
  loadProducts();
}
