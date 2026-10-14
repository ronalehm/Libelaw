// Libelaw — interacciones del sitio. Un solo archivo, sin dependencias.

// ===== Configuración =====
// Enlace de reservas: Calendly (https://calendly.com/usuario/consulta) o
// página de citas de Google Calendar (https://calendar.app.google/xxxx).
const BOOKING_URL = 'https://calendly.com/libelaw/consulta-inicial';
const WHATSAPP = '51984426215';

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ===== Carrusel de servicios =====
// Se ejecuta antes que los enlaces de agenda para que las copias también los reciban.
$$('.marquee-track').forEach(track => {
  const cards = [...track.children];
  const clone = card => {
    const copy = card.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    $$('a', copy).forEach(a => a.tabIndex = -1);
    track.append(copy);
  };
  while (track.scrollWidth < screen.width) cards.forEach(clone); // cubre pantallas anchas
  [...track.children].forEach(clone);                             // segunda mitad idéntica para el bucle
  track.style.animationDuration = track.scrollWidth / 2 / 40 + 's'; // 40 px por segundo
});

// ===== Enlaces de agenda =====
$$('[data-booking]').forEach(a => {
  a.href = BOOKING_URL;
  a.target = '_blank';
  a.rel = 'noopener';
});

// ===== Menú móvil =====
const menuBtn = document.querySelector('.menu-btn');
if (menuBtn) {
  const nav = menuBtn.closest('.nav');
  const setOpen = open => {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  menuBtn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  $$('#menu a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => e.key === 'Escape' && setOpen(false));
  document.addEventListener('click', e => !nav.contains(e.target) && setOpen(false));
}

// ===== Formularios =====

// Mensajes de error claros, debajo de cada campo
function messageFor(el) {
  const v = el.validity;
  if (v.valueMissing) {
    if (el.type === 'checkbox') return 'Marca esta casilla para continuar.';
    if (el.type === 'radio' || el.tagName === 'SELECT') return 'Elige una opción.';
    return 'Completa este campo.';
  }
  if (v.typeMismatch && el.type === 'email') return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  if (v.patternMismatch) return el.title || 'Revisa el formato.';
  if (v.tooShort) return `Escribe al menos ${el.minLength} caracteres (llevas ${el.value.length}).`;
  if (v.rangeUnderflow) return 'El monto no puede ser negativo.';
  return el.validationMessage;
}

function showError(el) {
  const field = el.closest('.field, .consent') || el.parentElement;
  let msg = field.querySelector('.error');
  if (el.validity.valid) {
    msg?.remove();
    el.removeAttribute('aria-invalid');
    return;
  }
  if (!msg) {
    msg = document.createElement('small');
    msg.className = 'error';
    msg.id = (el.id || el.name.replace(/\W/g, '')) + '-error';
    msg.setAttribute('aria-live', 'polite');
    field.append(msg);
  }
  msg.textContent = messageFor(el);
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', msg.id);
}

// Celular: agrupa en bloques de 3 mientras se escribe (984 426 215)
function formatPhone(input) {
  const digits = input.value.replace(/\D/g, '').replace(/^51(?=9)/, '').slice(0, 9);
  input.value = digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

// Documento: el formato cambia según el tipo elegido
const DOC_RULES = {
  'DNI': { pattern: '\\d{8}', max: 8, numeric: true, title: 'El DNI tiene 8 dígitos.' },
  'Carné de extranjería': { pattern: '[A-Za-z0-9]{9,12}', max: 12, title: 'Entre 9 y 12 caracteres.' },
  'Pasaporte': { pattern: '[A-Za-z0-9]{6,12}', max: 12, title: 'Entre 6 y 12 caracteres.' },
  'RUC': { pattern: '(10|15|17|20)\\d{9}', max: 11, numeric: true, title: 'El RUC tiene 11 dígitos.' },
};

function applyDocRule(select) {
  const input = select.form.querySelector('[data-doc-number]');
  const rule = DOC_RULES[select.value];
  input.pattern = rule.pattern;
  input.maxLength = rule.max;
  input.title = rule.title;
  input.inputMode = rule.numeric ? 'numeric' : 'text';
  if (input.value) showError(input);
}

// Muestra u oculta un bloque y lo vuelve obligatorio según una casilla
function applyToggle(checkbox) {
  const target = document.getElementById(checkbox.dataset.toggle);
  target.hidden = !checkbox.checked;
  $$('input, select, textarea', target).forEach(el => {
    el.required = checkbox.checked;
    if (!checkbox.checked) { el.value = ''; showError(el); }
  });
}

// Envío sin salir de la página (FormSubmit acepta JSON en /ajax/)
async function sendForm(form) {
  const button = form.querySelector('[type=submit]');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Enviando…';
  form.querySelector('.form-alert')?.remove();

  const cc = form.querySelector('[name=_cc]');
  if (cc) cc.value = form.querySelector('[name=email]').value; // copia de la hoja al consumidor

  try {
    const res = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || String(data.success) === 'false') throw new Error(data.message);

    const done = document.createElement('div');
    done.className = 'sent';
    done.setAttribute('role', 'status');
    done.tabIndex = -1;
    done.innerHTML = '<h2>Enviado</h2><p></p><a class="btn btn-ghost" href="index.html">Volver al inicio</a>';
    done.querySelector('p').textContent = form.dataset.success;
    form.replaceWith(done);
    done.focus();
  } catch {
    const alert = document.createElement('p');
    alert.className = 'form-alert';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `No pudimos enviar el formulario. Revisa tu conexión e inténtalo de nuevo, o escríbenos por <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a>.`;
    button.before(alert);
    button.disabled = false;
    button.textContent = label;
  }
}

$$('form.form').forEach(form => {
  form.noValidate = true; // usamos nuestros mensajes en lugar de las burbujas del navegador

  form.addEventListener('focusout', e => {
    if (e.target.matches('input, select, textarea') && e.target.value) showError(e.target);
  });
  form.addEventListener('input', e => {
    const el = e.target;
    if (el.type === 'tel') formatPhone(el);
    if (el.hasAttribute('aria-invalid') || el.type === 'radio' || el.type === 'checkbox') showError(el);
    const counter = el.parentElement.querySelector('.counter');
    if (counter) counter.textContent = `${el.value.length} / ${el.maxLength}`;
  });
  form.addEventListener('change', e => {
    if (e.target.matches('[data-doc-type]')) applyDocRule(e.target);
    if (e.target.matches('[data-toggle]')) applyToggle(e.target);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (form.querySelector('[name=_honey]')?.value) return; // bot
    const fields = $$('input:not([type=hidden]), select, textarea', form).filter(el => el.willValidate);
    fields.forEach(showError);
    const firstBad = fields.find(el => !el.validity.valid);
    if (firstBad) {
      firstBad.focus();
      return;
    }
    if (form.hasAttribute('data-ajax')) sendForm(form);
    else form.submit();
  });

  // Contador de caracteres en los textos largos
  $$('textarea[maxlength]', form).forEach(t => {
    const counter = document.createElement('small');
    counter.className = 'counter';
    counter.textContent = `0 / ${t.maxLength}`;
    t.after(counter);
  });

  $$('[data-doc-type]', form).forEach(applyDocRule);
});

// Servicio preseleccionado desde el enlace: contacto.html?servicio=Procesos%20civiles
const wanted = new URLSearchParams(location.search).get('servicio');
const serviceSelect = document.querySelector('select[name=Servicio]');
if (wanted && serviceSelect) {
  const option = [...serviceSelect.options].find(o => o.text === wanted);
  if (option) serviceSelect.value = option.value || option.text;
}

// ===== Libro de Reclamaciones =====
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const code = `LR-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const date = now.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' });
$$('[data-lr-code]').forEach(el => el.value = el.textContent = code);
$$('[data-lr-date]').forEach(el => el.value = el.textContent = date);
$$('[data-print]').forEach(b => b.addEventListener('click', () => print()));
