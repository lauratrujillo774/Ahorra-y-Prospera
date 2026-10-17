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
