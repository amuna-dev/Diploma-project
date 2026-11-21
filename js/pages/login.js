// Вход: POST /login { email, password } → сохраняем токен → возвращаемся туда, откуда пришли.

import { api } from '../api.js';
import { mergeGuestCart } from '../guest-cart.js';
import { clearErrorOnInput, clearErrors, EMAIL_PATTERN, focusFirstInvalid, setFieldError, setFormError } from '../forms.js';
import { initLayout } from '../layout.js';
import { session, STORAGE_BLOCKED_MESSAGE } from '../session.js';
import { setButtonLoading } from '../ui.js';
import { getParam, safeNextUrl } from '../utils.js';

const next = safeNextUrl(getParam('next'));

// уже вошли — сразу отправляем дальше
if (session.isLoggedIn) window.location.replace(next);

initLayout();

const form = document.getElementById('login-form');
const email = document.getElementById('login-email');
const password = document.getElementById('login-password');
const submit = form.querySelector('[type="submit"]');

// ссылка "Register" сохраняет адрес возврата
const registerLink = document.getElementById('register-link');
if (registerLink && getParam('next')) {
  registerLink.href = `register.html?next=${encodeURIComponent(next)}`;
}

clearErrorOnInput(form);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);

  let valid = true;
  if (!EMAIL_PATTERN.test(email.value.trim())) {
    setFieldError(email, 'Enter a valid email, e.g. alex@wepro.uz');
    valid = false;
  }
  if (!password.value) {
    setFieldError(password, 'Enter your password');
    valid = false;
  }
  if (!valid) {
    focusFirstInvalid(form);
    return;
  }
  if (!session.available) {
    setFormError(form, STORAGE_BLOCKED_MESSAGE);
    return;
  }

  setButtonLoading(submit, true, 'Logging in…');
  try {
    const { token, user } = await api.login(email.value.trim(), password.value);
    session.start(token, user);
    await mergeGuestCart().catch(() => {});
    window.location.replace(next);
  } catch (error) {
    setFormError(form, error.message);
    setButtonLoading(submit, false);
  }
});
