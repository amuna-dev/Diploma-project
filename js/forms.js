// Общие функции для форм входа и регистрации: показ ошибок у полей и под кнопкой.

import { setMessage } from './utils.js';

export function setFieldError(input, message) {
  const field = input.closest('.field');
  const error = field?.querySelector('.field__error');
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    if (error) {
      setMessage(error, message);
      error.hidden = false;
    }
  } else {
    input.removeAttribute('aria-invalid');
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }
}

export function clearErrors(form) {
  form.querySelectorAll('input, textarea').forEach((input) => setFieldError(input, ''));
  const formError = form.querySelector('.form-error');
  if (formError) {
    formError.textContent = '';
    formError.hidden = true;
  }
}

export function setFormError(form, message) {
  const formError = form.querySelector('.form-error');
  if (!formError) return;
  setMessage(formError, message);
  formError.hidden = !message;
}

/** Убирает ошибку поля, как только пользователь начал его исправлять */
export function clearErrorOnInput(form) {
  form.addEventListener('input', (event) => {
    if (event.target.matches('input, textarea')) setFieldError(event.target, '');
  });
}

export function focusFirstInvalid(form) {
  form.querySelector('[aria-invalid="true"]')?.focus();
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
