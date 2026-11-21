// Главная страница: Best sellers, Shop by category, Featured products.

import { api } from '../api.js';
import { initLayout } from '../layout.js';
import { handleBrokenImages, productCard, productSkeletons, statusMessage } from '../ui.js';
import { escapeHtml } from '../utils.js';

initLayout();
handleBrokenImages();

// Фото категорий экспортированы из макета Figma. Название, id и ссылка приходят с API;
// если учитель добавит новую категорию, для неё возьмётся фото из API.
const CATEGORY_IMAGES_FROM_DESIGN = {
  creams: 'assets/images/category-creams.jpg',
  serums: 'assets/images/category-serums.jpg',
  lotion: 'assets/images/category-lotion.jpg',
};

function categoryCard(category) {
  const key = category.title.trim().toLowerCase();
  const image = CATEGORY_IMAGES_FROM_DESIGN[key] || category.image;
  const title = escapeHtml(category.title);

  return `
    <a class="category-card" href="products.html?category=${encodeURIComponent(category._id)}">
      <img class="category-card__image" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">
      <span class="glass-button category-card__label">${title}</span>
    </a>`;
}

/**
 * Загружает секцию: показывает заглушки → данные → или сообщение об ошибке с кнопкой "Try again".
 */
async function loadSection(container, { load, render, skeletons = 4, emptyText }) {
  if (!container) return;
  container.innerHTML = productSkeletons(skeletons);

  try {
    const items = await load();
    container.innerHTML = items.length
      ? items.map(render).join('')
      : statusMessage(emptyText);
  } catch (error) {
    container.innerHTML = statusMessage(error.message, { type: 'error', retry: true });
    container.querySelector('[data-retry]')?.addEventListener('click', () => {
      loadSection(container, { load, render, skeletons, emptyText });
    });
  }
}

loadSection(document.getElementById('bestsellers'), {
  load: async () => (await api.getBestsellers(4)).products,
  render: (product) => productCard(product),
  emptyText: 'No products yet.',
});

loadSection(document.getElementById('categories'), {
  load: async () => (await api.getCategories()).categories,
  render: categoryCard,
  skeletons: 0,
  emptyText: 'No categories yet.',
});

loadSection(document.getElementById('featured'), {
  load: async () => (await api.getNewest(12)).products,
  render: (product) => productCard(product),
  skeletons: 12,
  emptyText: 'No products yet.',
});
