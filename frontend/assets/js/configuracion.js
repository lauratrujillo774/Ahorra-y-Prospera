// Configuración: foto de perfil, datos, moneda (con conversión de valores), tema, contraseña y sesiones
(() => {
  const { api, token, urlArchivo } = window.APSesion;
  const { dinero, esc, fecha, $, intentar, modal, aviso } = window.UI;
  let monedas = [];
  let monedaActual = null;

  const avisar = (id, t, c = 'error') => { const m = $('#' + id); m.textContent = t; m.className = `mensaje-ap ver ${c}`; };
  const iniciales = () => (window.APUsuario && window.APUsuario.iniciales) || 'US';

  // Refresca los datos guardados del usuario (nombre, foto, moneda) y los avatares visibles
  async function refrescarUsuario() {
    const { usuario } = await api('/auth/yo');
    localStorage.setItem('ap-usuario', JSON.stringify(usuario));
    // El menú de perfil se vuelve a armar con la foto nueva
    if (window.APUsuario) window.APUsuario.foto = urlArchivo(usuario.foto);
    document.getElementById('profile')?.remove();
    pintarFoto(urlArchivo(usuario.foto));
    return usuario;
  }

  function pintarFoto(url) {
    const grande = $('#fotoGrande');
    const avatares = [grande, ...document.querySelectorAll('.profile, .avatar')];
    avatares.forEach((el) => {
      if (!el) return;
      el.classList.toggle('con-foto', !!url);
      el.style.backgroundImage = url ? `url("${url}")` : '';
      el.textContent = url ? '' : iniciales();
    });
    $('#quitarFoto').hidden = !url;
  }

  // ---------- Foto de perfil ----------
  // Recorta la imagen a un cuadrado centrado de 512 px (queda nítida en el círculo y pesa poco)
  async function recortarCuadrado(archivo) {
    const img = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const lado = Math.min(img.width, img.height);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 512;
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 512, 512);
    return new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.9));
  }

  // Vista previa en círculo antes de guardar; devuelve true si el usuario acepta
  function vistaPrevia(url) {
    return new Promise((resolver) => {
      const fondo = document.createElement('div');
      fondo.className = 'ap-modal-fondo';
      fondo.innerHTML = `<div class="ap-modal" style="text-align:center"><h3>Así se verá tu foto</h3>
        <div class="foto-previa" style="background-image:url('${url}')"></div>
        <p class="sub">Recortamos tu imagen al centro para que quede bien en el círculo.</p>
        <div class="acciones-plan" style="justify-content:center"><button class="boton-ap suave" data-no>Elegir otra</button><button class="boton-ap principal" data-si>Usar esta foto</button></div></div>`;
      document.body.appendChild(fondo);
      const fin = (v) => { fondo.remove(); resolver(v); };
      fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('[data-no]')) fin(false); if (e.target.closest('[data-si]')) fin(true); });
    });
  }

  $('#cambiarFoto').addEventListener('click', () => $('#archivoFoto').click());
  $('#fotoGrande').addEventListener('click', () => $('#archivoFoto').click());
  $('#archivoFoto').addEventListener('change', async (e) => {
    const original = e.target.files[0];
    e.target.value = '';
    if (!original) return;
    $('#mensajeFoto').className = 'mensaje-ap';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(original.type)) return avisar('mensajeFoto', 'Elige una imagen JPG, PNG o WEBP');
    if (original.size > 15 * 1024 * 1024) return avisar('mensajeFoto', 'La imagen es demasiado grande (máximo 15 MB)');
    let archivo;
    try { archivo = await recortarCuadrado(original); } catch { return avisar('mensajeFoto', 'No se pudo leer la imagen. Prueba con otra.'); }
    const url = URL.createObjectURL(archivo);
    const aceptada = await vistaPrevia(url);
    URL.revokeObjectURL(url);
    if (!aceptada) return;
    const datos = new FormData();
    datos.append('foto', archivo, 'foto.jpg');
    try {
      const API = location.port === '5000' || location.protocol === 'https:' ? '' : 'http://localhost:5000';
      const r = await fetch(API + '/perfil/foto', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: datos });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || 'No se pudo subir la foto');
      await refrescarUsuario();
      aviso('Foto de perfil actualizada');
    } catch (err) { avisar('mensajeFoto', err.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor.' : err.message); }
  });
  $('#quitarFoto').addEventListener('click', async () => {
    if (await intentar(api('/perfil/foto', { method: 'DELETE' }), 'Foto eliminada')) await refrescarUsuario();
  });

  // ---------- Perfil ----------
  async function cargarPerfil() {
    const { perfil: p, monedas: lista, sesiones } = await api('/perfil');
    monedas = lista;
    monedaActual = p.id_moneda;
    $('#nombres').value = p.nombres; $('#apellidos').value = p.apellidos; $('#correo').value = p.correo;
    $('#correo_auxiliar').value = p.correo_auxiliar || ''; $('#telefono').value = p.telefono || '';
    $('#fecha_nacimiento').value = p.fecha_nacimiento || ''; $('#porcentaje').value = p.porcentaje_ahorro_meta; $('#tema').value = p.tema;
    $('#id_moneda').innerHTML = lista.map((m) => `<option value="${m.id_moneda}" ${m.id_moneda === p.id_moneda ? 'selected' : ''}>${esc(m.nombre)} (${m.codigo})</option>`).join('');
    pintarFoto(urlArchivo(p.foto_perfil));
    $('#sesiones').innerHTML = sesiones.map((s) => `<div class="mov" style="grid-template-columns:auto 1fr"><div class="mov-ic">${s.actual ? '' : ''}</div><div><b>${s.actual ? 'Esta sesión' : 'Otra sesión'}</b><small>${esc((s.navegador || 'Navegador desconocido').slice(0, 70))}<br>IP ${esc(s.ip || '—')} · desde ${fecha(s.inicio_en.slice(0, 10))}</small></div></div>`).join('') || '<div class="vacio">Sin sesiones.</div>';
  }

  // Pregunta qué hacer con los valores cuando se cambia la moneda
  async function decidirConversion(nuevaId) {
    const vieja = monedas.find((m) => m.id_moneda === monedaActual);
    const nueva = monedas.find((m) => m.id_moneda === nuevaId);
    const factor = nueva.tasa_cambio_usd / vieja.tasa_cambio_usd;
    const ejemplo = (n) => `${n.toLocaleString('es-CO')} ${vieja.codigo} → ${(Math.round(n * factor * 100) / 100).toLocaleString('es-CO')} ${nueva.codigo}`;
    const v = await modal({
      titulo: `Cambiar de ${vieja.codigo} a ${nueva.codigo}`,
      descripcion: `Tasa de referencia: <b>1 ${vieja.codigo} = ${factor.toLocaleString('es-CO', { maximumSignificantDigits: 6 })} ${nueva.codigo}</b><br>Ejemplo: ${ejemplo(1000000)}.<br><br>¿Qué hacemos con tus valores ya registrados (ingresos, gastos, presupuestos, metas, deudas, inversiones…)?`,
      campos: [{ k: 'convertir', label: 'Opción', tipo: 'select', valor: 'si', opciones: [{ valor: 'si', texto: `Convertir todos mis valores a ${nueva.codigo} (recomendado)` }, { valor: 'no', texto: 'Dejar los números igual y solo cambiar el símbolo' }] }],
      textoOk: 'Continuar',
    });
    return v ? v.convertir === 'si' : null;
  }

  $('#formPerfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#mensajePerfil').className = 'mensaje-ap';
    const nuevaId = Number($('#id_moneda').value);
    let convertir = false;
    if (nuevaId !== monedaActual) {
      const decision = await decidirConversion(nuevaId);
      if (decision === null) return;
      convertir = decision;
    }
    const cuerpo = {
      nombres: $('#nombres').value, apellidos: $('#apellidos').value, correo_auxiliar: $('#correo_auxiliar').value, telefono: $('#telefono').value,
      fecha_nacimiento: $('#fecha_nacimiento').value || null, porcentaje_ahorro_meta: $('#porcentaje').value, id_moneda: nuevaId, tema: $('#tema').value, convertir,
    };
    try {
      const r = await api('/perfil', { method: 'PUT', cuerpo });
      await refrescarUsuario();
      monedaActual = nuevaId;
      localStorage.setItem('ap-theme', cuerpo.tema === 'oscuro' ? 'dark' : 'light');
      document.body.classList.toggle('light', cuerpo.tema !== 'oscuro');
      avisar('mensajePerfil', r.message, 'ok');
      aviso(r.convertido ? 'Perfil y valores actualizados' : 'Perfil actualizado');
    } catch (err) { avisar('mensajePerfil', err.message); }
  });

  // ---------- Contraseña y sesiones ----------
  $('#formClave').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#mensajeClave').className = 'mensaje-ap';
    try {
      await api('/perfil/contrasena', { method: 'PUT', cuerpo: { actual: $('#actual').value, nueva: $('#nueva').value } });
      e.target.reset();
      avisar('mensajeClave', 'Contraseña actualizada (se cerraron tus demás sesiones)', 'ok');
      cargarPerfil();
    } catch (err) { avisar('mensajeClave', err.message); }
  });

  $('#cerrarOtras').addEventListener('click', async () => {
    if (await intentar(api('/perfil/cerrar-otras-sesiones', { method: 'POST' }), 'Otras sesiones cerradas')) cargarPerfil();
  });

  cargarPerfil().catch((e) => aviso(e.message, 'error'));
})();
