// Inicio de sesión y registro: valida, llama al API (/auth/...) y guarda la sesión
(() => {
  const { api, token, iniciar, ruta } = window.APSesion;
  const $ = (s) => document.querySelector(s);

  // Si ya hay sesión, va directo al panel
  if (token()) { location.replace(ruta.panel); return; }

  const formulario = $('#formulario');
  const mensaje = $('#mensaje');
  const boton = $('#enviar');
  const esRegistro = !!$('#nombres');

  function avisar(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `mensaje visible ${tipo}`;
  }

  // Acceso con Google (solo aparece si el servidor tiene GOOGLE_CLIENT_ID)
  // El botón siempre se ve; si Google no está configurado, al pulsarlo explica qué falta
  const textoGoogle = esRegistro ? 'Registrarme con Google' : 'Continuar con Google';
  $('#google-boton').innerHTML = `<button type="button" class="boton-google" id="google-respaldo">
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.600 5.900c4.400-4.100 7-10.100 7-17.600z"/><path fill="#FBBC05" d="M10.500 28.700c-.5-1.400-.8-3-.8-4.700s.3-3.200.8-4.700l-7.900-6.100C.900 16.400 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>
    ${textoGoogle}</button>`;
  $('#google-respaldo').addEventListener('click', () => {
    avisar('El acceso con Google aún no está configurado: falta el GOOGLE_CLIENT_ID en backend/.env (mira el README).');
  });

  api('/auth/config').then(({ googleClientId }) => {
    if (!googleClientId) return;
    const cargar = document.createElement('script');
    cargar.src = 'https://accounts.google.com/gsi/client';
    cargar.async = true;
    cargar.onload = () => {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          try {
            iniciar(await api('/auth/google', { method: 'POST', cuerpo: { credential } }));
          } catch (error) {
            avisar(error.message);
          }
        },
      });
      $('#google-boton').innerHTML = '';
      window.google.accounts.id.renderButton($('#google-boton'), {
        theme: 'outline', size: 'large', shape: 'pill', width: 340, locale: 'es',
        text: esRegistro ? 'signup_with' : 'signin_with',
      });
      $('#google-zona').hidden = false;
    };
    document.head.appendChild(cargar);
  }).catch(() => { /* sin Google, queda el formulario normal */ });

  // Botones "Ver / Ocultar" de la contraseña
  document.querySelectorAll('[data-ver]').forEach((b) => {
    b.addEventListener('click', () => {
      const campo = document.getElementById(b.dataset.ver);
      const oculto = campo.type === 'password';
      campo.type = oculto ? 'text' : 'password';
      b.textContent = oculto ? 'Ocultar' : 'Ver';
    });
  });

  if (esRegistro) {
    // Monedas desde la base de datos
    api('/auth/monedas').then((monedas) => {
      if (!monedas.length) return;
      $('#id_moneda').innerHTML = monedas
        .map((m) => `<option value="${m.id_moneda}">${m.nombre} (${m.codigo})</option>`).join('');
    }).catch(() => { /* queda la moneda por defecto */ });

    // Medidor de fuerza de la contraseña
    $('#contrasena').addEventListener('input', (e) => {
      const v = e.target.value;
      let puntos = 0;
      if (v.length >= 8) puntos++;
      if (/[A-Za-z]/.test(v) && /\d/.test(v)) puntos++;
      if (v.length >= 12) puntos++;
      if (/[^A-Za-z0-9]/.test(v)) puntos++;
      const barra = $('#fuerza');
      barra.style.width = `${puntos * 25}%`;
      barra.style.background = ['#b91c1c', '#b91c1c', '#f59e0b', '#16a34a', '#15803d'][puntos];
    });
  }

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.className = 'mensaje';
    formulario.querySelectorAll('input').forEach((i) => i.classList.remove('invalido'));

    const datos = Object.fromEntries(new FormData(formulario));
    const marcar = (id, texto) => { $('#' + id).classList.add('invalido'); $('#' + id).focus(); avisar(texto); };

    if (esRegistro) {
      if (!datos.nombres.trim()) return marcar('nombres', 'Escribe tus nombres');
      if (!datos.apellidos.trim()) return marcar('apellidos', 'Escribe tus apellidos');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo.trim())) return marcar('correo', 'Escribe un correo válido');
    if (esRegistro) {
      if (datos.contrasena.length < 8 || !/[A-Za-z]/.test(datos.contrasena) || !/\d/.test(datos.contrasena)) {
        return marcar('contrasena', 'La contraseña debe tener mínimo 8 caracteres, con letras y números');
      }
      if (datos.contrasena !== datos.confirmar) return marcar('confirmar', 'Las contraseñas no coinciden');
    } else if (!datos.contrasena) {
      return marcar('contrasena', 'Escribe tu contraseña');
    }

    boton.disabled = true;
    const textoOriginal = boton.textContent;
    boton.textContent = esRegistro ? 'Creando cuenta…' : 'Entrando…';
    try {
      const cuerpo = esRegistro
        ? { nombres: datos.nombres, apellidos: datos.apellidos, correo: datos.correo, contrasena: datos.contrasena, id_moneda: datos.id_moneda }
        : { correo: datos.correo, contrasena: datos.contrasena };
      const respuesta = await api(esRegistro ? '/auth/registro' : '/auth/login', { method: 'POST', cuerpo });
      avisar(esRegistro ? '¡Cuenta creada! Entrando a tu panel…' : '¡Bienvenido!', 'exito');
      iniciar(respuesta);
    } catch (error) {
      avisar(error.message);
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });
})();
