// Регистрация: POST /register { name, surname, phone, email, password } → сразу получаем токен.

import { api } from '../api.js';
import { mergeGuestCart } from '../guest-cart.js';
import { clearErrorOnInput, clearErrors, EMAIL_PATTERN, focusFirstInvalid, setFieldError, setFormError } from '../forms.js';
import { initLayout } from '../layout.js';
import { session, STORAGE_BLOCKED_MESSAGE } from '../session.js';
import { setButtonLoading } from '../ui.js';
import { getParam, onlyDigits, safeNextUrl } from '../utils.js';

const next = safeNextUrl(getParam('next'));

if (session.isLoggedIn) window.location.replace(next);

initLayout();

const form = document.getElementById('register-form');
const fields = {
  name: document.getElementById('register-name'),
  surname: document.getElementById('register-surname'),
  email: document.getElementById('register-email'),
  phone: document.getElementById('register-phone'),
  password: document.getElementById('register-password'),
  repeat: document.getElementById('register-repeat'),
};
const submit = form.querySelector('[type="submit"]');

const loginLink = document.getElementById('login-link');
if (loginLink && getParam('next')) {
  loginLink.href = `login.html?next=${encodeURIComponent(next)}`;
}

clearErrorOnInput(form);

// Телефон: подставляем +998 и форматируем как "+998 90 123-45-67"
function formatPhoneInput(value) {
  let digits = onlyDigits(value);
  if (digits.startsWith('998')) digits = digits.slice(3);
  if (digits.startsWith('998') && digits.length > 9) digits = digits.slice(3);
  digits = digits.slice(0, 9);

  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  let result = `+998 ${parts[0]}`;
  if (parts[1]) result += ` ${parts[1]}`;
  if (parts[2]) result += `-${parts[2]}`;
  if (parts[3]) result += `-${parts[3]}`;
  return result;
}

fields.phone.addEventListener('focus', () => {
  if (!fields.phone.value) fields.phone.value = '+998 ';
});
fields.phone.addEventListener('blur', () => {
  if (onlyDigits(fields.phone.value) === '998') fields.phone.value = '';
});
fields.phone.addEventListener('input', (event) => {
  const value = fields.phone.value;
  const digits = onlyDigits(value);
  const deleting = Boolean(event.inputType?.startsWith('delete'));
  if (!digits || (deleting && '998'.startsWith(digits) && !value.endsWith(' '))) fields.phone.value = '';
  else fields.phone.value = formatPhoneInput(value);
});

function validate() {
  let valid = true;
  const fail = (input, message) => {
    setFieldError(input, message);
    valid = false;
  };

  const name = fields.name.value.trim();
  const surname = fields.surname.value.trim();
  const phone = onlyDigits(fields.phone.value);

  if (!name) fail(fields.name, 'Enter your name');
  else if (name.length > 50) fail(fields.name, 'Name must be up to 50 characters');

  if (!surname) fail(fields.surname, 'Enter your surname');
  else if (surname.length > 50) fail(fields.surname, 'Surname must be up to 50 characters');

  if (!EMAIL_PATTERN.test(fields.email.value.trim())) fail(fields.email, 'Enter a valid email, e.g. alex@wepro.uz');

  if (!/^998\d{9}$/.test(phone)) fail(fields.phone, 'Enter your phone number, e.g. +998 90 123-45-67');

  if (fields.password.value.length < 4 || fields.password.value.length > 64) {
    fail(fields.password, 'Password must be 4–64 characters');
  }
  if (fields.repeat.value !== fields.password.value) fail(fields.repeat, 'Passwords do not match');

  return valid;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  if (!validate()) {
    focusFirstInvalid(form);
    return;
  }
  if (!session.available) {
    setFormError(form, STORAGE_BLOCKED_MESSAGE);
    return;
  }

  setButtonLoading(submit, true, 'Creating account…');
  try {
    const { token, user } = await api.register({
      name: fields.name.value.trim(),
      surname: fields.surname.value.trim(),
      phone: onlyDigits(fields.phone.value),
      email: fields.email.value.trim(),
      password: fields.password.value,
    });
    session.start(token, user);
    await mergeGuestCart().catch(() => {});
    window.location.replace(next);
  } catch (error) {
    if (error.status === 409 && /e-?mail|почт/i.test(error.message)) {
      setFieldError(fields.email, error.message);
      fields.email.focus();
    } else {
      setFormError(form, error.message);
    }
    setButtonLoading(submit, false);
  }
});
