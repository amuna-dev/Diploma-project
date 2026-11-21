// Страница товара: фото, название, цена, количество + "Add to cart",
// отзывы (комментарии), модальные окна "Leave a comment" и "Thank you!".

import { api } from '../api.js';
import { LIMITS } from '../config.js';
import { announce, countCartItems, initLayout, setBagCount } from '../layout.js';
import { guestCart } from '../guest-cart.js';
import { closeModal, initModal, openModal } from '../modal.js';
import { session } from '../session.js';
import { handleBrokenImages, setButtonLoading, statusMessage } from '../ui.js';
import { escapeHtml, formatDate, formatPrice, getParam, redirectToLogin, setMessage } from '../utils.js';

initLayout();
handleBrokenImages();

const productId = getParam('id');

const els = {
  page: document.querySelector('.product-page'),
  imageBox: document.querySelector('.product__image'),
  title: document.getElementById('product-title'),
  price: document.getElementById('product-price'),
  qtyMinus: document.getElementById('qty-minus'),
  qtyPlus: document.getElementById('qty-plus'),
  qtyValue: document.getElementById('qty-value'),
  addToCart: document.getElementById('add-to-cart'),
  cartMessage: document.getElementById('cart-message'),
  reviewsCount: document.getElementById('reviews-count'),
  reviewsList: document.getElementById('reviews-list'),
  writeReview: document.getElementById('write-review'),
  commentModal: document.getElementById('comment-modal'),
  commentForm: document.getElementById('comment-form'),
  commentText: document.getElementById('comment-text'),
  commentError: document.getElementById('comment-error'),
  thanksModal: document.getElementById('thanks-modal'),
  thanksOk: document.getElementById('thanks-ok'),
};

let product = null;
let comments = [];
let qty = 1;

// ---------- Товар ----------

function renderProduct() {
  document.title = `${product.title} — WEPRO`;
  const image = document.createElement('img');
  image.id = 'product-image';
  image.width = 610;
  image.height = 530;
  image.alt = product.title;
  image.src = product.image;
  els.imageBox.replaceChildren(image);
  els.title.textContent = product.title;
  els.price.textContent = formatPrice(product.price);
}

async function loadProduct() {
  if (!productId) {
    showPageError('Product not found.');
    return;
  }

  try {
    ({ product } = await api.getProduct(productId));
    comments = [...(product.comments || [])].reverse(); // новые отзывы — первыми
    renderProduct();
    renderReviews();
    els.page.classList.remove('is-loading');
  } catch (error) {
    showPageError(error.status === 404 ? 'Product not found.' : error.message);
  }
}

function showPageError(message) {
  els.page.classList.remove('is-loading');
  els.page.innerHTML = `
    <div class="container product-page__error">
      ${statusMessage(message, { type: 'error' })}
      <p class="status__link"><a class="btn btn--black btn--pill" href="products.html">Back to products</a></p>
    </div>`;
}

// ---------- Количество ----------

function renderQty() {
  els.qtyValue.textContent = String(qty);
  els.qtyMinus.disabled = qty <= 1;
  els.qtyPlus.disabled = qty >= LIMITS.maxQty;
}

els.qtyMinus.addEventListener('click', () => {
  qty = Math.max(1, qty - 1);
  renderQty();
});

els.qtyPlus.addEventListener('click', () => {
  qty = Math.min(LIMITS.maxQty, qty + 1);
  renderQty();
});

// ---------- Корзина ----------

let messageTimer = null;
function showCartMessage(text, type = 'success') {
  clearTimeout(messageTimer);
  setMessage(els.cartMessage, text);
  els.cartMessage.dataset.type = type;
  els.cartMessage.hidden = false;
  announce(text);
  messageTimer = setTimeout(() => {
    els.cartMessage.hidden = true;
  }, 4000);
}

els.addToCart.addEventListener('click', async () => {
  if (!product) return;
  if (!session.isLoggedIn) {
    try {
      const added = guestCart.add(product, qty);
      setBagCount(guestCart.count());
      showCartMessage(
        added < qty
          ? `Added to your bag: ${added} pcs. Maximum is ${LIMITS.maxQty} pcs. of one product.`
          : `Added to your bag: ${added} pcs.`,
      );
      qty = 1;
      renderQty();
    } catch (error) {
      showCartMessage(error.message, 'error');
    }
    return;
  }

  setButtonLoading(els.addToCart, true, 'Adding…');
  try {
    const { cart } = await api.addToCart(product._id, qty);
    setBagCount(countCartItems(cart));
    showCartMessage(`Added to your bag: ${qty} pcs.`);
    qty = 1;
    renderQty();
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }
    showCartMessage(error.message, 'error');
  } finally {
    setButtonLoading(els.addToCart, false);
  }
});

// ---------- Отзывы ----------

function reviewCard(comment) {
  return `
    <article class="review">
      <div class="review__body">
        <h3 class="review__author">
          <span>${escapeHtml(comment.author)}</span>
          <svg class="review__badge" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="Verified">
            <use href="assets/icons/sprite.svg#verified"></use>
          </svg>
        </h3>
        <p class="review__text">"${escapeHtml(comment.text)}"</p>
      </div>
      <div class="review__footer">
        ${comment.at && formatDate(comment.at) ? `<p class="review__date">Posted on ${formatDate(comment.at)}</p>` : '<span></span>'}
      </div>
    </article>`;
}

function renderReviews() {
  els.reviewsCount.textContent = `(${comments.length})`;
  els.reviewsList.innerHTML = comments.length
    ? comments.map(reviewCard).join('')
    : statusMessage('No reviews yet. Be the first to leave one!');
}

// ---------- Модальное окно "Leave a comment" ----------

initModal(els.commentModal);
initModal(els.thanksModal);

els.writeReview.addEventListener('click', () => {
  if (!session.isLoggedIn) {
    redirectToLogin();
    return;
  }
  els.commentError.hidden = true;
  els.commentText.removeAttribute('aria-invalid');
  openModal(els.commentModal);
});

function showCommentError(message) {
  setMessage(els.commentError, message);
  els.commentError.hidden = false;
  els.commentText.setAttribute('aria-invalid', 'true');
}

els.commentText.addEventListener('input', () => {
  els.commentError.hidden = true;
  els.commentText.removeAttribute('aria-invalid');
});

els.commentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = els.commentText.value.trim();

  if (text.length < LIMITS.commentMin || text.length > LIMITS.commentMax) {
    showCommentError(`Comment must be ${LIMITS.commentMin}–${LIMITS.commentMax} characters long.`);
    return;
  }

  const submit = els.commentForm.querySelector('[type="submit"]');
  setButtonLoading(submit, true, 'Sending…');

  try {
    const { comment } = await api.addComment(product._id, text);
    comments.unshift(comment);
    renderReviews();
    els.commentForm.reset();
    closeModal(els.commentModal);
    openModal(els.thanksModal);
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }
    showCommentError(error.message);
  } finally {
    setButtonLoading(submit, false);
  }
});

els.thanksOk.addEventListener('click', () => closeModal(els.thanksModal));

// ---------- Старт ----------

renderQty();
loadProduct();
