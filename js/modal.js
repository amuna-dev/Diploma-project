// Простые модальные окна: открытие/закрытие, клик по фону, клавиша Escape,
// возврат фокуса на кнопку, которая открыла окно.

const openModals = []; // стек открытых окон (последнее — сверху)
let lastFocused = null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(modal) {
  return [...modal.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

function onKeydown(event) {
  const top = openModals[openModals.length - 1];
  if (!top) return;

  if (event.key === 'Escape') {
    closeModal(top);
    return;
  }
  if (event.key !== 'Tab') return;

  const items = focusableIn(top);
  if (!items.length) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const outside = !top.contains(document.activeElement);

  if (event.shiftKey && (outside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (outside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

export function openModal(modal) {
  if (!modal || openModals.includes(modal)) return;
  if (!openModals.length) lastFocused = document.activeElement;

  modal.hidden = false;
  openModals.push(modal);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKeydown);

  const focusTarget = modal.querySelector('[autofocus], textarea, input, button');
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

export function closeModal(modal) {
  const index = openModals.indexOf(modal);
  if (index === -1) return; // окно не было открыто через openModal — ничего не делаем

  modal.hidden = true;
  openModals.splice(index, 1);
  modal.dispatchEvent(new CustomEvent('modal:close'));

  if (!openModals.length) {
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
  }
}

/** Закрытие по клику на элементы с атрибутом data-close (фон, крестик) */
export function initModal(modal) {
  if (!modal) return;
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeModal(modal);
  });
}
