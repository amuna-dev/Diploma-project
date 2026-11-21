// HTML-шаблоны, которые повторяются на разных страницах.

import { escapeHtml, formatPrice, isRussian } from './utils.js';

/**
 * Карточка товара (Best sellers, Featured products, All products, My orders).
 * @param {object} product — товар из API: { _id, title, price, image }
 * @param {{ showPrice?: boolean, productId?: string, headingLevel?: number }} options
 */
export function productCard(product, { showPrice = true, productId = product._id, headingLevel = 3 } = {}) {
  const title = escapeHtml(product.title);
  const price = showPrice
    ? `<span class="product-card__price">${formatPrice(product.price)}</span>`
    : '';

  return `
    <article class="product-card">
      <a class="product-card__link" href="product.html?id=${encodeURIComponent(productId)}">
        <div class="product-card__image">
          <img src="${escapeHtml(product.image)}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="product-card__info">
          <h${headingLevel} class="product-card__title">${title}</h${headingLevel}>
          ${price}
        </div>
      </a>
    </article>`;
}

/** Серые заглушки, пока товары загружаются (чтобы страница не "прыгала") */
export function productSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="product-card product-card--skeleton" aria-hidden="true">
      <div class="product-card__image"></div>
      <div class="product-card__info">
        <span class="skeleton-line"></span>
      </div>
    </div>`).join('');
}

/** Сообщение внутри сетки: пусто / ошибка */
export function statusMessage(text, { type = 'info', retry = false } = {}) {
  return `
    <div class="status status--${type}" role="${type === 'error' ? 'alert' : 'status'}">
      <p class="status__text"${isRussian(text) ? ' lang="ru"' : ''}>${escapeHtml(text)}</p>
      ${retry ? '<button class="status__retry" type="button" data-retry>Try again</button>' : ''}
    </div>`;
}

/**
 * Если картинка товара с внешнего сайта не загрузилась —
 * оставляем аккуратный серый фон вместо "битой" иконки.
 */
export function handleBrokenImages(root = document) {
  root.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (img.tagName === 'IMG' && !img.dataset.broken) {
        img.dataset.broken = 'true';
        img.removeAttribute('src');
        img.closest('.product-card__image, .cart-item__image, .product__image, .category-card')
          ?.classList.add('is-broken');
      }
    },
    true, // событие error не всплывает — ловим на этапе погружения
  );
}

/** Блокирует кнопку на время запроса и показывает текст загрузки */
export function setButtonLoading(button, loading, loadingText) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent;
    if (loadingText) button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
