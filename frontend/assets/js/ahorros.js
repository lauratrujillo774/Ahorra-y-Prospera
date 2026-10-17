// Ahorros: metas con aportes y cuentas de ahorro
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, fecha, hoy, $, barra, intentar, confirmar, modal } = window.UI;
  let metas = [];
  let cuentas = [];

  const camposMeta = (m = {}) => [
    { k: 'nombre', label: 'Nombre de la meta', valor: m.nombre, req: true, placeholder: 'Ej. Viaje a la costa' },
    { k: 'monto_objetivo', label: 'Valor que quieres reunir', tipo: 'number', valor: m.monto_objetivo, req: true, min: 1, step: 1000 },
    { k: 'fecha_limite', label: 'Fecha límite (opcional)', tipo: 'date', valor: m.fecha_limite },
    { k: 'descripcion', label: '¿Para qué es? (opcional)', valor: m.descripcion },
    { k: 'id_cuenta', label: 'Cuenta donde la guardas', tipo: 'select', valor: m.id_cuenta ?? '', opciones: [{ valor: '', texto: 'Sin cuenta' }, ...cuentas.map((c) => ({ valor: c.id_cuenta, texto: c.nombre }))] },
  ];

  function kpis() {
    const activas = metas.filter((m) => m.estado === 'activa');
    const ahorrado = metas.filter((m) => m.estado !== 'cancelada').reduce((t, m) => t + m.monto_actual, 0);
    const objetivo = activas.reduce((t, m) => t + m.monto_objetivo, 0);
    $('#kpis').innerHTML = `
      <div class="kpi verde"><small>Total ahorrado en metas</small><b>${dinero(ahorrado)}</b></div>
      <div class="kpi"><small>Metas activas</small><b>${activas.length}</b><em>${metas.filter((m) => m.estado === 'cumplida').length} cumplida(s)</em></div>
      <div class="kpi"><small>Falta para tus metas activas</small><b>${dinero(Math.max(0, objetivo - activas.reduce((t, m) => t + m.monto_actual, 0)))}</b></div>
      <div class="kpi"><small>Saldo en cuentas</small><b>${dinero(cuentas.reduce((t, c) => t + c.saldo, 0))}</b></div>`;
  }

  function dibujarMetas() {
    $('#metas').innerHTML = metas.length ? metas.map((m) => `
      <article class="panel meta-tarjeta" data-id="${m.id_meta}">
        <div class="deuda-cabecera"><h3>${esc(m.nombre)}</h3><span class="estado-pill ${m.estado}">${m.estado}</span></div>
        ${m.descripcion ? `<p class="sub" style="margin:0">${esc(m.descripcion)}</p>` : ''}
        ${barra(m.porcentaje_avance)}
        <div class="meta-cifras"><span><b>${dinero(m.monto_actual)}</b> de ${dinero(m.monto_objetivo)}</span><b>${Math.round(m.porcentaje_avance)}%</b></div>
        <div class="texto-suave">${m.estado === 'cumplida' ? '¡Meta cumplida!' : `Faltan ${dinero(m.monto_faltante)}`}${m.fecha_limite ? ` · Límite: ${fecha(m.fecha_limite)}` : ''}${m.cuenta ? ` · ${esc(m.cuenta)}` : ''}</div>
        <div class="deuda-acciones">
          ${m.estado === 'activa' ? '<button class="mini verde" data-aportar>+ Aportar</button>' : ''}
          <button class="mini" data-historial>Historial</button><button class="mini" data-editar>Editar</button>
          ${m.estado === 'activa' ? '<button class="mini" data-pausar>Pausar</button>' : m.estado === 'pausada' ? '<button class="mini" data-reanudar>Reanudar</button>' : ''}
          <button class="mini rojo" data-borrar>Eliminar</button></div>
      </article>`).join('') : `<div class="panel vacio" style="grid-column:1/-1">Aún no tienes metas.<br>Crea tu primera meta y empieza a aportar poco a poco</div>`;
  }

  function dibujarCuentas() {
    $('#cuentas').innerHTML = cuentas.length
      ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Cuenta</th><th>Entidad</th><th class="num">Saldo</th><th></th></tr></thead><tbody>${cuentas.map((c) => `<tr><td><b>${esc(c.nombre)}</b></td><td>${esc(c.entidad || '—')}</td><td class="num">${dinero(c.saldo)}</td><td class="acciones-fila"><button class="icono-btn" data-cedit="${c.id_cuenta}" aria-label="Editar"></button><button class="icono-btn rojo" data-cborrar="${c.id_cuenta}" aria-label="Eliminar"></button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vacio">No has registrado cuentas.</div>';
  }

  async function cargar() {
    try {
      [metas, cuentas] = await Promise.all([api('/metas'), api('/cuentas')]);
      kpis(); dibujarMetas(); dibujarCuentas();
    } catch (e) { $('#metas').innerHTML = `<div class="panel vacio">${esc(e.message)}</div>`; }
  }

  $('#nuevaMeta').addEventListener('click', async () => {
    const v = await modal({ titulo: 'Nueva meta de ahorro', campos: camposMeta(), textoOk: 'Crear meta' });
    if (v && await intentar(api('/metas', { method: 'POST', cuerpo: v }), 'Meta creada')) cargar();
  });

  $('#metas').addEventListener('click', async (e) => {
    const tarjeta = e.target.closest('[data-id]');
    if (!tarjeta) return;
    const m = metas.find((x) => String(x.id_meta) === tarjeta.dataset.id);
    const id = m.id_meta;
    if (e.target.closest('[data-aportar]')) {
      const v = await modal({ titulo: `Aportar a "${m.nombre}"`, descripcion: `Faltan <b>${dinero(m.monto_faltante)}</b>.`, campos: [{ k: 'monto', label: 'Monto del aporte', tipo: 'number', req: true, min: 1, step: 1000 }, { k: 'fecha', label: 'Fecha', tipo: 'date', valor: hoy() }, { k: 'nota', label: 'Nota (opcional)' }], textoOk: 'Aportar' });
      if (v && await intentar(api(`/metas/${id}/aportes`, { method: 'POST', cuerpo: v }))) cargar();
    } else if (e.target.closest('[data-editar]')) {
      const v = await modal({ titulo: 'Editar meta', campos: camposMeta(m) });
      if (v && await intentar(api(`/metas/${id}`, { method: 'PUT', cuerpo: { ...v, estado: m.estado === 'cumplida' ? undefined : m.estado } }), 'Meta actualizada')) cargar();
    } else if (e.target.closest('[data-pausar]') || e.target.closest('[data-reanudar]')) {
      const estado = e.target.closest('[data-pausar]') ? 'pausada' : 'activa';
      if (await intentar(api(`/metas/${id}`, { method: 'PUT', cuerpo: { nombre: m.nombre, descripcion: m.descripcion, monto_objetivo: m.monto_objetivo, fecha_limite: m.fecha_limite, estado } }), estado === 'pausada' ? 'Meta pausada' : 'Meta reanudada')) cargar();
    } else if (e.target.closest('[data-borrar]')) {
      if (await confirmar(`¿Eliminar la meta "${m.nombre}" y todos sus aportes?`) && await intentar(api(`/metas/${id}`, { method: 'DELETE' }), 'Meta eliminada')) cargar();
    } else if (e.target.closest('[data-historial]')) {
      const aportes = await api(`/metas/${id}/aportes`);
      const fondo = document.createElement('div');
      fondo.className = 'ap-modal-fondo';
      fondo.innerHTML = `<div class="ap-modal"><h3>Aportes a "${esc(m.nombre)}"</h3>${aportes.length
        ? `<div class="tabla-caja" style="margin-top:12px"><table class="tabla" style="min-width:0"><thead><tr><th>Fecha</th><th>Nota</th><th class="num">Monto</th><th></th></tr></thead><tbody>${aportes.map((a) => `<tr><td>${fecha(a.fecha)}</td><td>${esc(a.nota || '—')}</td><td class="num">${dinero(a.monto)}</td><td><button class="icono-btn rojo" data-quitar="${a.id_aporte}" aria-label="Quitar"></button></td></tr>`).join('')}</tbody></table></div>` : '<div class="vacio">Aún no hay aportes.</div>'}
        <div class="acciones-plan" style="margin-top:16px;justify-content:flex-end"><button class="boton-ap suave" data-cerrar>Cerrar</button></div></div>`;
      document.body.appendChild(fondo);
      fondo.addEventListener('click', async (ev) => {
        if (ev.target === fondo || ev.target.closest('[data-cerrar]')) fondo.remove();
        const q = ev.target.closest('[data-quitar]');
        if (q && await intentar(api(`/metas/${id}/aportes/${q.dataset.quitar}`, { method: 'DELETE' }), 'Aporte eliminado')) { fondo.remove(); cargar(); }
      });
    }
  });

  const camposCuenta = (c = {}) => [{ k: 'nombre', label: 'Nombre', valor: c.nombre, req: true, placeholder: 'Ej. Cuenta de ahorros' }, { k: 'entidad', label: 'Entidad (opcional)', valor: c.entidad, placeholder: 'Banco, billetera, efectivo…' }, { k: 'saldo', label: 'Saldo actual', tipo: 'number', valor: c.saldo ?? 0, min: 0, step: 1000 }];
  $('#nuevaCuenta').addEventListener('click', async () => {
    const v = await modal({ titulo: 'Nueva cuenta', campos: camposCuenta(), textoOk: 'Crear' });
    if (v && await intentar(api('/cuentas', { method: 'POST', cuerpo: v }), 'Cuenta creada')) cargar();
  });
  $('#cuentas').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-cedit]');
    const bo = e.target.closest('[data-cborrar]');
    if (ed) {
      const c = cuentas.find((x) => String(x.id_cuenta) === ed.dataset.cedit);
      const v = await modal({ titulo: 'Editar cuenta', campos: camposCuenta(c) });
      if (v && await intentar(api(`/cuentas/${c.id_cuenta}`, { method: 'PUT', cuerpo: v }), 'Cuenta actualizada')) cargar();
    } else if (bo && await confirmar('¿Eliminar esta cuenta? Las metas asociadas se conservan.') && await intentar(api(`/cuentas/${bo.dataset.cborrar}`, { method: 'DELETE' }), 'Cuenta eliminada')) cargar();
  });

  window.UI.pestanas();
  cargar();
})();
