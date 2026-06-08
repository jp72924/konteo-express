/**
 * RegistroScreen.js — Customer profile screen (Step 3 of 5).
 *
 * Two modes:
 *   - Returning customer: shows pre-filled read-only profile + "Confirmar identidad" button.
 *   - New customer: shows the kiosk customer registration form.
 *
 * New customer fields (in order):
 *   1. Nombre + Apellido  (row)
 *   2. Correo electrónico (full-width)
 *   3. Teléfono           (full-width)
 *   4. Fecha de nacimiento + Sexo  (row)
 *   5. Estado + Ciudad             (row, Ciudad is dynamic)
 *
 * On success: stores customer_id + customer_name in store and navigates to scan.
 */

import { store }           from '../store.js';
import { navigate }        from '../router.js';
import { notify }          from '../notify.js';
import { createCustomer, formatCedula } from '../services/customer.js';
import { esc, initials, kioskHeader, icon } from './utils.js';
import { _progressSteps }  from './HomeScreen.js';

// ─── Venezuelan state → city map ─────────────────────────────────────────────

const _CIUDADES_MAP = {
  'Amazonas':        ['Puerto Ayacucho', 'San Fernando de Atabapo'],
  'Anzoátegui':      ['Barcelona', 'Puerto La Cruz', 'El Tigre', 'Anaco', 'Lechería'],
  'Apure':           ['San Fernando de Apure', 'Guasdualito'],
  'Aragua':          ['Maracay', 'La Victoria', 'Turmero', 'Cagua', 'El Limón'],
  'Barinas':         ['Barinas', 'Barinitas', 'Ciudad Bolivia'],
  'Bolívar':         ['Ciudad Bolívar', 'Puerto Ordaz', 'Upata', 'Caicara del Orinoco'],
  'Carabobo':        ['Valencia', 'Puerto Cabello', 'Guacara', 'Los Guayos', 'Mariara'],
  'Cojedes':         ['San Carlos', 'Tinaco', 'El Baúl'],
  'Delta Amacuro':   ['Tucupita', 'Pedernales'],
  'Distrito Capital':['Caracas', 'Antímano', 'Catia', 'El Valle', 'La Vega'],
  'Falcón':          ['Coro', 'Punto Fijo', 'La Vela de Coro', 'Chichiriviche'],
  'Guárico':         ['San Juan de los Morros', 'Valle de la Pascua', 'Calabozo'],
  'Lara':            ['Barquisimeto', 'Cabudare', 'El Tocuyo', 'Carora'],
  'Mérida':          ['Mérida', 'El Vigía', 'Ejido', 'Tovar'],
  'Miranda':         ['Los Teques', 'Guarenas', 'Guatire', 'Charallave', 'Ocumare del Tuy', 'Baruta'],
  'Monagas':         ['Maturín', 'Punta de Mata', 'Barrancas del Orinoco'],
  'Nueva Esparta':   ['La Asunción', 'Porlamar', 'Juan Griego', 'Pampatar'],
  'Portuguesa':      ['Guanare', 'Acarigua', 'Araure', 'Biscucuy'],
  'Sucre':           ['Cumaná', 'Carúpano', 'Güiria'],
  'Táchira':         ['San Cristóbal', 'Táriba', 'Rubio', 'La Fría'],
  'Trujillo':        ['Trujillo', 'Valera', 'Boconó'],
  'Vargas':          ['La Guaira', 'Maiquetía', 'Catia La Mar', 'Macuto'],
  'Yaracuy':         ['San Felipe', 'Yaritagua', 'Chivacoa'],
  'Zulia':           ['Maracaibo', 'Cabimas', 'Ciudad Ojeda', 'San Francisco', 'Punto Fijo'],
};

const _ESTADOS = Object.keys(_CIUDADES_MAP);

export const RegistroScreen = {
  mount(container, params = {}) {
    const { prefix, number, isNew, customer } = params;
    this._prefix = prefix;
    this._number = number;

    if (isNew) {
      _mountNewForm(container, prefix, number, this);
    } else {
      _mountReturning(container, prefix, number, customer, this);
    }
  },

  unmount() {},
};

// ─── Returning customer ───────────────────────────────────────────────────────

function _mountReturning(container, prefix, number, customer, _screen) {
  const name   = `${customer.first_name} ${customer.last_name}`.trim();
  const cedula = formatCedula(prefix, number);

  container.innerHTML = `
    <div class="screen active">
      ${_header()}

      <div class="kiosk-body">
        ${_progressSteps(3)}

        <div class="profile-badge">
          <div class="avatar">${esc(initials(name))}</div>
          <div>
            <div class="profile-name">${esc(name)}</div>
            <div class="profile-ced">Cédula: ${esc(cedula)}</div>
          </div>
        </div>

        <div class="text-center">
          <div class="screen-title" style="font-size:16px">¡Bienvenido de nuevo!</div>
          <div class="screen-sub">Confirma tu identidad para continuar</div>
        </div>

        <div class="alert-box">
          <div class="alert-icon">${icon('info')}</div>
          <div class="alert-text">
            Al continuar confirmas que eres el titular de la cédula
            <strong>${esc(cedula)}</strong>.
          </div>
        </div>

        <div class="mt-auto"></div>
      </div>

      <div class="bottom-bar">
        <button class="btn-primary" id="btn-confirm">Confirmar identidad →</button>
      </div>
    </div>
  `;

  container.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('cedula');
  });

  container.querySelector('#btn-confirm').addEventListener('click', () => {
    store.set('customer_id',     customer.customer_id);
    store.set('customer_name',   name);
    store.set('customer_cedula', cedula);
    navigate('scan');
  });
}

// ─── New customer registration ────────────────────────────────────────────────

function _mountNewForm(container, prefix, number, _screen) {
  const cedula = formatCedula(prefix, number);

  const estadoOptions = _ESTADOS
    .map(e => `<option value="${esc(e)}">${esc(e)}</option>`)
    .join('');

  container.innerHTML = `
    <div class="screen active">
      ${_header()}

      <div class="kiosk-body">
        ${_progressSteps(3)}

        <div class="profile-badge">
          <div class="avatar">?</div>
          <div>
            <div class="profile-name">Nuevo cliente</div>
            <div class="profile-ced">Cédula: ${esc(cedula)}</div>
          </div>
        </div>

        <div class="text-center">
          <div class="screen-title" style="font-size:16px">Datos personales</div>
          <div class="screen-sub">Completa tu perfil para continuar</div>
        </div>

        <!-- 1. Nombre + Apellido -->
        <div class="field-row">
          <div class="field-group">
            <div class="field-label">Nombre <span>*</span></div>
            <input id="f-nombre" class="ft-input" type="text" placeholder="Ej: María" maxlength="30" autocomplete="off">
            <div class="field-err" id="err-nombre"></div>
          </div>
          <div class="field-group">
            <div class="field-label">Apellido <span>*</span></div>
            <input id="f-apellido" class="ft-input" type="text" placeholder="Ej: González" maxlength="30" autocomplete="off">
            <div class="field-err" id="err-apellido"></div>
          </div>
        </div>

        <!-- 2. Correo electrónico -->
        <div class="field-group">
          <div class="field-label">Correo electrónico <span>*</span></div>
          <input id="f-email" class="ft-input" type="email" placeholder="correo@ejemplo.com" maxlength="60" autocomplete="off">
          <div class="field-err" id="err-email"></div>
        </div>

        <!-- 3. Teléfono -->
        <div class="field-group">
          <div class="field-label">Teléfono <span>*</span></div>
          <input id="f-tel" class="ft-input" type="tel" placeholder="04XX-XXXXXXX" maxlength="16" autocomplete="off">
          <div class="field-err" id="err-tel"></div>
        </div>

        <!-- 4. Fecha de nacimiento + Sexo -->
        <div class="field-row">
          <div class="field-group">
            <div class="field-label">Fecha de nacimiento <span>*</span></div>
            <input id="f-dob" class="ft-input" type="date">
            <div class="field-err" id="err-dob"></div>
          </div>
          <div class="field-group">
            <div class="field-label">Sexo <span>*</span></div>
            <div class="sexo-btns">
              <div class="sexo-btn" id="sexo-M">${icon('mars')} Masc.</div>
              <div class="sexo-btn" id="sexo-F">${icon('venus')} Fem.</div>
            </div>
            <div class="field-err" id="err-sexo"></div>
          </div>
        </div>

        <!-- 5. Estado + Ciudad -->
        <div class="field-row">
          <div class="field-group">
            <div class="field-label">Estado <span>*</span></div>
            <div class="select-wrap">
              <select id="f-estado" class="ft-select">
                <option value="">Seleccionar</option>
                ${estadoOptions}
              </select>
            </div>
            <div class="field-err" id="err-estado"></div>
          </div>
          <div class="field-group">
            <div class="field-label">Ciudad <span>*</span></div>
            <div class="select-wrap">
              <select id="f-ciudad" class="ft-select">
                <option value="">Seleccionar estado primero</option>
              </select>
            </div>
            <div class="field-err" id="err-ciudad"></div>
          </div>
        </div>

        <div style="font-size:11px;color:var(--ft-gray-text);text-align:center;padding-bottom:4px">
          Al continuar aceptas los <span style="color:var(--ft-blue);text-decoration:underline">Términos y Condiciones</span>
        </div>
      </div>

      <div class="bottom-bar">
        <button class="btn-primary" id="btn-registro" disabled>Continuar →</button>
      </div>
    </div>
  `;

  // ── Element refs ──────────────────────────────────────────────────────────
  const btnRegistro = container.querySelector('#btn-registro');
  const fNombre     = container.querySelector('#f-nombre');
  const fApellido   = container.querySelector('#f-apellido');
  const fEmail      = container.querySelector('#f-email');
  const fTel        = container.querySelector('#f-tel');
  const fDob        = container.querySelector('#f-dob');
  const fEstado     = container.querySelector('#f-estado');
  const fCiudad     = container.querySelector('#f-ciudad');
  const sexoBtns    = container.querySelectorAll('.sexo-btn');

  let selectedGender = '';

  // ── Gender toggle ─────────────────────────────────────────────────────────
  container.querySelector('#sexo-M').addEventListener('click', () => {
    selectedGender = 'M';
    sexoBtns.forEach(b => b.classList.remove('selected'));
    container.querySelector('#sexo-M').classList.add('selected');
    _validate();
  });

  container.querySelector('#sexo-F').addEventListener('click', () => {
    selectedGender = 'F';
    sexoBtns.forEach(b => b.classList.remove('selected'));
    container.querySelector('#sexo-F').classList.add('selected');
    _validate();
  });

  // ── Dynamic ciudad dropdown ───────────────────────────────────────────────
  fEstado.addEventListener('change', () => {
    const ciudades = _CIUDADES_MAP[fEstado.value] ?? [];
    fCiudad.innerHTML = ciudades.length
      ? ciudades.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
      : '<option value="">Seleccionar estado primero</option>';
    _validate();
  });

  // ── Live validation ───────────────────────────────────────────────────────
  function _validate() {
    const ok =
      fNombre.value.trim().length > 0 &&
      fApellido.value.trim().length > 0 &&
      fEmail.value.trim().length > 0 &&
      fTel.value.trim().length > 0 &&
      fDob.value.trim().length > 0 &&
      selectedGender !== '' &&
      fEstado.value !== '' &&
      fCiudad.value !== '';
    btnRegistro.disabled = !ok;
  }

  [fNombre, fApellido, fEmail, fTel, fDob].forEach(el => el.addEventListener('input', _validate));
  fCiudad.addEventListener('change', _validate);

  // ── Back button ───────────────────────────────────────────────────────────
  container.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('cedula');
  });

  // ── Submit ────────────────────────────────────────────────────────────────
  btnRegistro.addEventListener('click', async () => {
    _clearErrors(container);

    const firstName   = fNombre.value.trim();
    const lastName    = fApellido.value.trim();
    const email       = fEmail.value.trim();
    const phone       = fTel.value.trim();
    const dateOfBirth = fDob.value.trim();
    const gender      = selectedGender;
    const state       = fEstado.value;
    const city        = fCiudad.value;

    // Field-level guards (button should already be disabled, but belt + suspenders)
    if (!firstName)   { _setError(container, 'err-nombre',   'Campo requerido'); return; }
    if (!lastName)    { _setError(container, 'err-apellido', 'Campo requerido'); return; }
    if (!email)       { _setError(container, 'err-email',    'Campo requerido'); return; }
    if (!phone)       { _setError(container, 'err-tel',      'Campo requerido'); return; }
    if (!dateOfBirth) { _setError(container, 'err-dob',      'Campo requerido'); return; }
    if (!gender)      { _setError(container, 'err-sexo',     'Selecciona sexo'); return; }
    if (!state)       { _setError(container, 'err-estado',   'Campo requerido'); return; }
    if (!city)        { _setError(container, 'err-ciudad',   'Campo requerido'); return; }

    btnRegistro.disabled = true;
    btnRegistro.textContent = 'Registrando…';

    try {
      const customer = await createCustomer(
        { firstName, lastName, email, phone, dateOfBirth, gender, state, city },
        prefix,
        number,
      );
      const name = `${firstName} ${lastName}`.trim();
      store.set('customer_id',     customer.customer_id);
      store.set('customer_name',   name);
      store.set('customer_cedula', cedula);
      navigate('scan');
    } catch (err) {
      if (err.details && Object.keys(err.details).length > 0) {
        const fieldMap = {
          first_name:    'err-nombre',
          last_name:     'err-apellido',
          email:         'err-email',
          phone:         'err-tel',
          date_of_birth: 'err-dob',
          gender:        'err-sexo',
          state:         'err-estado',
          city:          'err-ciudad',
        };
        for (const [field, errId] of Object.entries(fieldMap)) {
          if (err.details[field]) {
            _setError(container, errId, Array.isArray(err.details[field])
              ? err.details[field][0]
              : err.details[field]);
          }
        }
      } else {
        notify(err.message || 'Error al registrar. Intenta nuevamente.', 'error');
      }
      btnRegistro.disabled = false;
      btnRegistro.textContent = 'Continuar →';
    }
  });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function _header() {
  return kioskHeader({ actionLabel: 'Volver', actionId: 'back-btn' });
}

function _clearErrors(container) {
  container.querySelectorAll('.field-err').forEach(el => { el.textContent = ''; });
  container.querySelectorAll('.ft-input').forEach(el => el.classList.remove('error'));
}

function _setError(container, errId, msg) {
  const el = container.querySelector(`#${errId}`);
  if (el) el.textContent = msg;
  const inputId = errId.replace('err-', 'f-');
  const inp = container.querySelector(`#${inputId}`);
  if (inp) inp.classList.add('error');
}
