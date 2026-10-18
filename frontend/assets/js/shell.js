// Estructura común de las páginas del panel: tema, campana de notificaciones y menú de perfil
(() => {
  const claro = (localStorage.getItem('ap-theme') || 'light') === 'light';
  document.body.classList.toggle('light', claro);

  const botonTema = document.getElementById('themeBtn');
  if (botonTema) {
    botonTema.textContent = claro ? '☀' : '☾';
    botonTema.addEventListener('click', () => {
      const esClaro = document.body.classList.toggle('light');
      localStorage.setItem('ap-theme', esClaro ? 'light' : 'dark');
      botonTema.textContent = esClaro ? '☀' : '☾';
      window.dispatchEvent(new Event('ap-tema'));
    });
  }

  // ---------- Menú lateral en móvil (hamburguesa) ----------
  const lateral = document.querySelector('.sidebar');
  const barra = document.querySelector('.topbar');
  if (lateral && barra) {
    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'menu-panel-boton';
    abrir.setAttribute('aria-label', 'Abrir menú');
    abrir.setAttribute('aria-expanded', 'false');
    abrir.textContent = '☰';
    barra.insertBefore(abrir, barra.firstChild);

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'sidebar-cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar menú');
    cerrar.textContent = '✕';
    lateral.appendChild(cerrar);

    const fondo = document.createElement('div');
    fondo.className = 'sidebar-fondo';
    document.body.appendChild(fondo);

    const poner = (abierto) => {
      lateral.classList.toggle('abierto', abierto);
      fondo.classList.toggle('visible', abierto);
      document.body.classList.toggle('menu-abierto', abierto);
      abrir.setAttribute('aria-expanded', String(abierto));
    };
    abrir.addEventListener('click', () => poner(true));
    cerrar.addEventListener('click', () => poner(false));
    fondo.addEventListener('click', () => poner(false));
    lateral.addEventListener('click', (e) => { if (e.target.closest('nav a')) poner(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') poner(false); });
    window.matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) poner(false); });
  }

  // ---------- Menú de perfil ----------
  const perfil = document.querySelector('.profile');
  if (perfil) {
    perfil.addEventListener('click', (e) => {
      e.stopPropagation();
      let menu = document.getElementById('profile');
      if (!menu) {
        const u = window.APUsuario || { nombres: 'Invitado', iniciales: 'IN' };
        menu = document.createElement('div');
        menu.id = 'profile';
        menu.className = 'profile-menu';
        menu.innerHTML = `<b ${u.foto ? `class="con-foto" style="background-image:url('${u.foto}')"` : ''}>${u.foto ? '' : u.iniciales}</b><div><strong>${u.nombres}</strong><small>Perfil personal</small></div><a href="configuracion.html">Configuración</a><a href="#" id="cerrarSesion">Cerrar sesión</a>`;
        document.body.appendChild(menu);
        menu.querySelector('#cerrarSesion').addEventListener('click', (ev) => { ev.preventDefault(); window.APSesion.cerrar(); });
      }
      menu.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('profile');
      if (menu && !menu.contains(e.target)) menu.classList.remove('show');
    });
  }

  // ---------- Campana de notificaciones ----------
  const campana = document.getElementById('campana');
  if (campana && window.APSesion) {
    const { api } = window.APSesion;
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const iconos = { exceso_gasto: '', vencimiento_pago: '', meta_ahorro: '', logro: '', reto: '', sistema: '' };
    const panel = document.createElement('div');
    panel.className = 'panel-notif';
    panel.hidden = true;
    panel.innerHTML = '<div class="panel-notif-cab"><b>Notificaciones</b><button type="button" id="leerTodas">Marcar todas como leídas</button></div><div id="listaNotif"></div>';
    document.body.appendChild(panel);
    const punto = campana.querySelector('.punto');

    async function cargar() {
      try {
        const { noLeidas, notificaciones } = await api('/notificaciones');
        punto.hidden = noLeidas === 0;
        punto.textContent = noLeidas > 9 ? '9+' : noLeidas;
        panel.querySelector('#listaNotif').innerHTML = notificaciones.length
          ? notificaciones.map((n) => `<div class="notif ${n.leida ? '' : 'nueva'}" data-id="${n.id_notificacion}"><span class="notif-ic">${iconos[n.tipo] || ''}</span><div><b>${esc(n.titulo)}</b><p>${esc(n.mensaje)}</p></div></div>`).join('')
          : '<div class="vacio">No tienes notificaciones por ahora</div>';
      } catch { /* sin conexión */ }
    }
    campana.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) cargar();
    });
    panel.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (e.target.id === 'leerTodas') { await api('/notificaciones/leer-todas', { method: 'POST' }); cargar(); return; }
      const n = e.target.closest('.notif.nueva');
      if (n) { await api(`/notificaciones/${n.dataset.id}/leer`, { method: 'POST' }); cargar(); }
    });
    document.addEventListener('click', () => { panel.hidden = true; });
    cargar();
  }
})();
