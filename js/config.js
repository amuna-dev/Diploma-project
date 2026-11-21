// Общие настройки проекта.
// Если учитель поменяет адрес сервера — достаточно исправить API_BASE здесь.

export const API_BASE = 'https://api.wepro.uz/sandbox-shop';

// Ограничения из документации Sandbox Shop API
export const LIMITS = {
  maxCartPositions: 20, // не больше 20 разных товаров в корзине
  maxQty: 20, // не больше 20 штук одного товара
  commentMin: 2, // длина комментария: от 2 ...
  commentMax: 300, // ... до 300 символов
  commentsPerProduct: 3, // не больше 3 комментариев на товар от одного пользователя
};

// Сколько товаров показывать на странице каталога (как в макете: 3 ряда по 4)
export const PRODUCTS_PER_PAGE = 12;

// Границы ползунка цены в фильтре, USD
export const PRICE_RANGE = { min: 0, max: 100, step: 1 };
