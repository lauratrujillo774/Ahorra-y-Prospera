// Sesión compartida: llamadas al API, token guardado y protección de las páginas privadas
(() => {
  const CLAVE_TOKEN = 'ap-token';
  const CLAVE_USUARIO = 'ap-usuario';

  // Con el servidor del proyecto (puerto 5000) el API está en la misma dirección;
  // si abres la página desde otro lugar, apunta al backend local
  const API = location.port === '5000' || location.protocol === 'https:' ? '' : 'http://localhost:5000';

  // Rutas de la carpeta pages/ (funcionan en cualquier página, sin importar la profundidad)
  const base = location.pathname.includes('/pages/')
    ? location.pathname.slice(0, location.pathname.indexOf('/pages/') + 1)
    : location.pathname.replace(/[^/]*$/, '');
  const ruta = {
    inicio: base + 'index.html',
    login: base + 'pages/auth/login.html',
    registro: base + 'pages/auth/registro.html',
    panel: base + 'pages/app/dashboard.html',
  };

  const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

  const token = () => leer(CLAVE_TOKEN);
  const usuario = () => { try { return JSON.parse(leer(CLAVE_USUARIO)); } catch { return null; } };

  async function api(url, { method = 'GET', cuerpo } = {}) {
    const cabeceras = { 'Content-Type': 'application/json' };
    if (token()) cabeceras.Authorization = 'Bearer ' + token();
    let respuesta;
    try {
      respuesta = await fetch(API + url, { method, headers: cabeceras, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    } catch {
      throw new Error('No se pudo conectar con el servidor. Verifica que esté encendido.');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const error = new Error(datos.message || 'Ocurrió un error');
      error.estado = respuesta.status;
      throw error;
    }
    return datos;
  }

  function iniciar(datos) {
    guardar(CLAVE_TOKEN, datos.token);
    guardar(CLAVE_USUARIO, JSON.stringify(datos.usuario));
    location.href = ruta.panel;
  }

  async function cerrar() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ya expirada */ }
    borrar(CLAVE_TOKEN);
    borrar(CLAVE_USUARIO);
    location.href = ruta.inicio;
  }

  // Las fotos subidas viven en el servidor (/uploads/...); las de Google ya son una URL completa
  const urlArchivo = (r) => (!r ? null : /^https?:/i.test(r) ? r : API + r);

  window.APSesion = { api, token, usuario, iniciar, cerrar, ruta, urlArchivo };

  // Páginas privadas (pages/app/): exigen sesión y muestran el nombre del usuario
  if (location.pathname.includes('/pages/app/')) {
    if (!token()) {
      location.replace(ruta.login);
      return;
    }
    const u = usuario() || { nombres: 'Usuario', apellidos: '' };
    const iniciales = ((u.nombres || 'U')[0] + ((u.apellidos || '')[0] || '')).toUpperCase();
    const foto = urlArchivo(u.foto);
    window.APUsuario = { nombres: u.nombres, iniciales, foto };

    // Si el servidor ya no reconoce el token, vuelve al inicio de sesión
    api('/auth/yo').catch((e) => {
      if (e.estado === 401) { borrar(CLAVE_TOKEN); borrar(CLAVE_USUARIO); location.replace(ruta.login); }
    });

    document.querySelectorAll('[data-iniciales], .avatar').forEach((b) => {
      b.textContent = iniciales;
      if (foto) { b.textContent = ''; b.classList.add('con-foto'); b.style.backgroundImage = `url("${foto}")`; b.setAttribute('aria-label', 'Tu foto de perfil'); }
    });
    const saludo = [...document.querySelectorAll('h1')].find((h) => h.textContent.includes('Samuel'));
    if (saludo) saludo.innerHTML = saludo.innerHTML.replace('Samuel', u.nombres.split(' ')[0]);

    // El "Consejo inteligente" pasa de la barra lateral al contenido, bajo el encabezado
    const consejo = document.querySelector('aside .side-tip, aside .tip');
    const cabecera = document.querySelector('main header');
    if (consejo && cabecera) {
      consejo.classList.add('consejo-banner');
      cabecera.insertAdjacentElement('afterend', consejo);
    }

    // Botón "Cerrar sesión" en el menú lateral
    const menu = document.querySelector('aside nav');
    if (menu) {
      const salir = document.createElement('a');
      salir.href = '#';
      salir.innerHTML = '⎋ <span>Cerrar sesión</span>';
      salir.addEventListener('click', (e) => { e.preventDefault(); cerrar(); });
      menu.append(salir);
    }
  }
})();
