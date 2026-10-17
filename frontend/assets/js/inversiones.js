// Inversiones: mis inversiones, tipos (con explicación), simulador, ganancias (que pasan a Ingresos) y asesor IA
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, fecha, hoy, $, intentar, confirmar, modal, aviso } = window.UI;
  const CAT = window.CATALOGO_INVERSION || {};
  let lista = [];
  let tipos = [];
  let resumenGanancias = { porMes: [], porInversion: [], esteMes: 0, total: 0 };
  let tipoActivo = null;
  let filtroRiesgo = 'todos';
  let irAPestana = () => {};

  const claseRiesgo = (r) => (r === 'alto' ? 'alta' : r === 'medio' ? 'media' : '');
  const info = (t) => CAT[t?.nombre] || {};
  const tasaRef = (t) => info(t).tasa ?? 8;

  // ---------- Formularios ----------
  const campos = (i = {}) => [
    { k: 'nombre', label: 'Nombre', valor: i.nombre, req: true, placeholder: 'Ej. CDT Bancolombia' },
    { k: 'id_tipo_inversion', label: 'Tipo de inversión', tipo: 'select', valor: i.id_tipo_inversion ?? tipoActivo ?? tipos[0]?.id_tipo_inversion, opciones: tipos.map((t) => ({ valor: t.id_tipo_inversion, texto: `${t.nombre} (riesgo ${t.nivel_riesgo})` })) },
    { k: 'monto_invertido', label: 'Monto invertido', tipo: 'number', valor: i.monto_invertido, req: true, min: 1, step: 1000 },
    { k: 'valor_actual', label: 'Valor actual (opcional)', tipo: 'number', valor: i.valor_actual, min: 0, step: 1000, ayuda: 'Actualízalo para ver tu ganancia o pérdida.' },
    { k: 'tasa_rendimiento_anual', label: 'Rendimiento esperado E.A. % (opcional)', tipo: 'number', valor: i.tasa_rendimiento_anual ?? (i.id_inversion ? '' : (tipoActivo ? tasaRef(tipos.find((t) => t.id_tipo_inversion === tipoActivo)) || '' : '')), step: 0.1 },
    { k: 'fecha_inicio', label: 'Fecha de inicio', tipo: 'date', valor: i.fecha_inicio || hoy() },
    { k: 'fecha_vencimiento', label: 'Fecha de vencimiento (opcional)', tipo: 'date', valor: i.fecha_vencimiento },
    { k: 'estado', label: 'Estado', tipo: 'select', valor: i.estado || 'activa', opciones: [{ valor: 'activa', texto: 'Activa' }, { valor: 'finalizada', texto: 'Finalizada' }, { valor: 'retirada', texto: 'Retirada' }] },
    { k: 'notas', label: 'Notas (opcional)', valor: i.notas },
  ];

  async function nuevaInversion(idTipo) {
    if (idTipo) tipoActivo = idTipo;
    const v = await modal({ titulo: 'Nueva inversión', campos: campos(), textoOk: 'Registrar' });
    if (v && await intentar(api('/inversiones', { method: 'POST', cuerpo: v }), 'Inversión registrada')) { cargar(); irAPestana('mis'); }
  }

  // ---------- KPIs ----------
  function kpis() {
    const act = lista.filter((i) => i.estado === 'activa');
    const invertido = act.reduce((t, i) => t + i.monto_invertido, 0);
    const valor = act.reduce((t, i) => t + (i.valor_actual ?? i.monto_invertido), 0);
    const gan = valor - invertido;
    $('#kpis').innerHTML = `
      <div class="kpi"><small>Total invertido</small><b>${dinero(invertido)}</b><em>${act.length} inversión(es) activa(s)</em></div>
      <div class="kpi"><small>Valor actual</small><b>${dinero(valor)}</b></div>
      <div class="kpi ${gan < 0 ? 'rojo' : 'verde'}"><small>Ganancia / pérdida del valor</small><b>${dinero(gan)}</b><em>${invertido ? `${Math.round((gan / invertido) * 1000) / 10}% de rendimiento` : '—'}</em></div>
      <div class="kpi verde"><small>Ganancias cobradas este mes</small><b>${dinero(resumenGanancias.esteMes)}</b><em>ya sumadas a tus ingresos</em></div>`;
  }

  // ---------- Tipos de inversión (botones + explicación) ----------
  function dibujarTipos() {
    $('#filtrosRiesgo').innerHTML = [['todos', 'Todos'], ['bajo', 'Riesgo bajo'], ['medio', 'Riesgo medio'], ['alto', 'Riesgo alto']]
      .map(([k, t]) => `<button class="filtro ${k === filtroRiesgo ? 'activo' : ''}" data-riesgo="${k}">${t}</button>`).join('');
    const visibles = tipos.filter((t) => filtroRiesgo === 'todos' || t.nivel_riesgo === filtroRiesgo);
    $('#tiposBotones').innerHTML = visibles.map((t) => `
      <button type="button" class="tipo-boton ${tipoActivo === t.id_tipo_inversion ? 'activo' : ''}" data-tipo="${t.id_tipo_inversion}" aria-pressed="${tipoActivo === t.id_tipo_inversion}">
        <span class="tipo-ic">${info(t).icono || ''}</span><span class="tipo-nombre">${esc(t.nombre)}</span><span class="punto-riesgo ${t.nivel_riesgo}" title="Riesgo ${t.nivel_riesgo}"></span>
      </button>`).join('') || '<div class="vacio">No hay tipos con ese riesgo.</div>';
    detalleTipo();
  }

  function detalleTipo() {
    const t = tipos.find((x) => x.id_tipo_inversion === tipoActivo);
    const caja = $('#tipoDetalle');
    if (!t) { caja.innerHTML = '<div class="vacio">Elige un tipo de inversión para ver su explicación.</div>'; return; }
    const d = info(t);
    const items = (arr) => (arr || []).map((x) => `<li>${esc(x)}</li>`).join('');
    caja.innerHTML = `
      <div class="encabezado-panel"><div class="detalle-titulo"><span class="tipo-ic grande">${d.icono || ''}</span><div><h2 style="margin:0">${esc(t.nombre)}</h2><span class="pildora ${claseRiesgo(t.nivel_riesgo)}">riesgo ${t.nivel_riesgo}</span></div></div>
        <div class="acciones-plan"><button class="boton-ap principal" data-invertir="${t.id_tipo_inversion}">Invertir</button><button class="boton-ap suave" data-ia="${t.id_tipo_inversion}">Aprende más con la IA</button></div></div>
      <h3>¿Qué es?</h3><p style="margin:6px 0 0;line-height:1.65">${esc(d.que || t.descripcion || '')}</p>
      <div class="kpis" style="margin:16px 0">
        <div class="kpi"><small>Rendimiento de referencia</small><b>${d.tasa ? `≈ ${d.tasa}% E.A.` : 'Variable'}</b><em>no es una promesa</em></div>
        <div class="kpi"><small>Plazo</small><b style="font-size:17px">${esc(d.plazo || '—')}</b></div>
        <div class="kpi"><small>Liquidez</small><b style="font-size:17px">${esc(d.liquidez || '—')}</b></div>
        <div class="kpi"><small>Monto para empezar</small><b style="font-size:17px">${esc(d.minimo || '—')}</b></div>
      </div>
      <div class="dos-col" style="grid-template-columns:1fr 1fr;gap:18px">
        <div><h3>Ventajas</h3><ul class="lista-puntos">${items(d.ventajas)}</ul></div>
        <div><h3>Desventajas y riesgos</h3><ul class="lista-puntos">${items(d.desventajas)}</ul></div>
      </div>
      ${d.paraQuien ? `<p style="margin:14px 0 6px"><b>¿Para quién es?</b> ${esc(d.paraQuien)}</p>` : ''}
      ${d.cuidado ? `<div class="mensaje-ap ver ok" style="margin-top:10px"><b>Ten cuidado:</b> ${esc(d.cuidado)}</div>` : ''}
      <p class="ayuda-ap" style="margin-top:12px">Información educativa; no es una recomendación de inversión. Verifica siempre que la entidad esté vigilada por la Superintendencia Financiera.</p>`;
  }

  function elegirTipo(id, desplazar = true) {
    tipoActivo = id;
    const t = tipos.find((x) => x.id_tipo_inversion === id);
    if (t) { $('#sTipo').value = String(id); $('#sTasa').value = tasaRef(t); }
    dibujarTipos();
    simular();
    if (desplazar) $('#tipoDetalle').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('#filtrosRiesgo').addEventListener('click', (e) => { const b = e.target.closest('[data-riesgo]'); if (b) { filtroRiesgo = b.dataset.riesgo; dibujarTipos(); } });
  $('#tiposBotones').addEventListener('click', (e) => { const b = e.target.closest('[data-tipo]'); if (b) elegirTipo(Number(b.dataset.tipo)); });
  $('#tipoDetalle').addEventListener('click', (e) => {
    const inv = e.target.closest('[data-invertir]');
    const ia = e.target.closest('[data-ia]');
    if (inv) nuevaInversion(Number(inv.dataset.invertir));
    if (ia) {
      const t = tipos.find((x) => x.id_tipo_inversion === Number(ia.dataset.ia));
      irAPestana('asesor');
      if (window.APChat) window.APChat.preguntar(`Explícame a fondo la inversión "${t.nombre}": cómo funciona, cuánto dinero necesito para empezar, riesgos, costos y cómo comenzar de forma segura en Colombia.`);
    }
  });

  // ---------- Lista de inversiones ----------
  function tabla() {
    $('#lista').innerHTML = lista.length
      ? `<div class="tabla-caja"><table class="tabla" style="min-width:900px"><thead><tr><th>Inversión</th><th>Tipo</th><th class="num">Invertido</th><th class="num">Valor actual</th><th class="num">Rendimiento</th><th class="num">Ganancias</th><th></th></tr></thead><tbody>${lista.map((i) => `
        <tr><td><b>${esc(i.nombre)}</b><br><small class="texto-suave">desde ${fecha(i.fecha_inicio)}${i.fecha_vencimiento ? ` · vence ${fecha(i.fecha_vencimiento)}` : ''}</small>${i.estado !== 'activa' ? ` <span class="pildora media">${i.estado}</span>` : ''}</td>
        <td>${esc(i.tipo)}<br><span class="pildora ${claseRiesgo(i.nivel_riesgo)}">riesgo ${i.nivel_riesgo}</span></td>
        <td class="num">${dinero(i.monto_invertido)}</td><td class="num">${i.valor_actual === null ? '—' : dinero(i.valor_actual)}</td>
        <td class="num"><b class="${i.ganancia < 0 ? 'neg' : 'pos'}">${dinero(i.ganancia)}<br>${i.rendimiento_pct}%</b></td>
        <td class="num"><b class="pos">${dinero(i.ganancias_cobradas)}</b></td>
        <td class="acciones-fila"><button class="mini verde" data-ganancias="${i.id_inversion}">Ganancias</button><button class="icono-btn" data-editar="${i.id_inversion}" aria-label="Editar"></button><button class="icono-btn rojo" data-borrar="${i.id_inversion}" aria-label="Eliminar"></button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vacio">Aún no registras inversiones.<br>Explora los <b>Tipos de inversión</b> y pulsa <b>Invertir</b>, o usa el botón "Nueva inversión".</div>';
  }

  $('#nueva').addEventListener('click', () => nuevaInversion());
  $('#lista').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-editar]');
    const bo = e.target.closest('[data-borrar]');
    const ga = e.target.closest('[data-ganancias]');
    if (ed) {
      const i = lista.find((x) => String(x.id_inversion) === ed.dataset.editar);
      const v = await modal({ titulo: 'Editar inversión', campos: campos(i) });
      if (v && await intentar(api(`/inversiones/${i.id_inversion}`, { method: 'PUT', cuerpo: v }), 'Inversión actualizada')) cargar();
    } else if (bo) {
      if (await confirmar('¿Eliminar esta inversión y su historial de ganancias? Los ingresos que ya se registraron por ella se conservan.') && await intentar(api(`/inversiones/${bo.dataset.borrar}`, { method: 'DELETE' }), 'Inversión eliminada')) cargar();
    } else if (ga) {
      gananciasDe(lista.find((x) => String(x.id_inversion) === ga.dataset.ganancias));
    }
  });

  // ---------- Ganancias de una inversión (se reflejan en Ingresos) ----------
  async function gananciasDe(inv) {
    const fondo = document.createElement('div');
    fondo.className = 'ap-modal-fondo';
    document.body.appendChild(fondo);
    const cerrar = () => { fondo.remove(); cargar(); };

    async function pintar() {
      const filas = await api(`/inversiones/${inv.id_inversion}/rendimientos`);
      const sugerido = Math.round((inv.valor_actual ?? inv.monto_invertido) * ((inv.tasa_rendimiento_anual ?? 0) / 100) / 12);
      const total = filas.reduce((t, f) => t + f.monto, 0);
      fondo.innerHTML = `<div class="ap-modal ancho"><h3>Ganancias de "${esc(inv.nombre)}"</h3>
        <p class="sub">Cada ganancia que registres se suma automáticamente a tus <b>Ingresos</b> del mes de su fecha (categoría "Rendimientos").</p>
        <div class="kpis" style="margin-bottom:14px"><div class="kpi verde"><small>Total cobrado</small><b>${dinero(total)}</b></div><div class="kpi"><small>Sugerido por mes</small><b>${sugerido ? dinero(sugerido) : '—'}</b><em>${inv.tasa_rendimiento_anual ? `según ${inv.tasa_rendimiento_anual}% E.A.` : 'agrega la tasa de la inversión'}</em></div></div>
        <div class="acciones-plan" style="margin-bottom:14px"><button class="boton-ap principal chico" data-nueva>+ Registrar ganancia</button>${sugerido ? `<button class="boton-ap suave chico" data-sugerida="${sugerido}">Registrar la del mes (${dinero(sugerido)})</button>` : ''}</div>
        ${filas.length ? `<div class="tabla-caja"><table class="tabla" style="min-width:0"><thead><tr><th>Fecha</th><th>Nota</th><th class="num">Ganancia</th><th></th></tr></thead><tbody>${filas.map((f) => `<tr><td>${fecha(f.fecha)}</td><td>${esc(f.nota || '—')}</td><td class="num"><b class="pos">${dinero(f.monto)}</b></td><td class="acciones-fila"><button class="icono-btn" data-editar="${f.id_rendimiento}" aria-label="Editar"></button><button class="icono-btn rojo" data-borrar="${f.id_rendimiento}" aria-label="Eliminar"></button></td></tr>`).join('')}</tbody></table></div>` : '<div class="vacio">Aún no registras ganancias de esta inversión.</div>'}
        <div class="acciones-plan" style="margin-top:16px;justify-content:flex-end"><button class="boton-ap suave" data-cerrar>Cerrar</button></div></div>`;
      fondo.__filas = filas;
    }

    const camposGanancia = (g = {}) => [
      { k: 'monto', label: 'Monto de la ganancia', tipo: 'number', valor: g.monto, req: true, min: 1, step: 100 },
      { k: 'fecha', label: 'Fecha en que la recibiste', tipo: 'date', valor: g.fecha || hoy(), req: true, ayuda: 'El ingreso se registrará en el mes de esta fecha.' },
      { k: 'nota', label: 'Nota (opcional)', valor: g.nota, placeholder: 'Ej. Intereses de octubre' },
    ];

    fondo.addEventListener('click', async (e) => {
      if (e.target === fondo || e.target.closest('[data-cerrar]')) return cerrar();
      const nueva = e.target.closest('[data-nueva]');
      const sug = e.target.closest('[data-sugerida]');
      const ed = e.target.closest('[data-editar]');
      const bo = e.target.closest('[data-borrar]');
      if (nueva) {
        const v = await modal({ titulo: 'Registrar ganancia', campos: camposGanancia(), textoOk: 'Registrar' });
        if (v && await intentar(api(`/inversiones/${inv.id_inversion}/rendimientos`, { method: 'POST', cuerpo: v }))) pintar();
      } else if (sug) {
        if (await intentar(api(`/inversiones/${inv.id_inversion}/rendimientos`, { method: 'POST', cuerpo: { monto: Number(sug.dataset.sugerida), fecha: hoy(), nota: 'Ganancia estimada del mes' } }))) pintar();
      } else if (ed) {
        const g = fondo.__filas.find((x) => String(x.id_rendimiento) === ed.dataset.editar);
        const v = await modal({ titulo: 'Editar ganancia', campos: camposGanancia(g) });
        if (v && await intentar(api(`/inversiones/rendimientos/${g.id_rendimiento}`, { method: 'PUT', cuerpo: v }))) pintar();
      } else if (bo && await confirmar('¿Eliminar esta ganancia? También se quita el ingreso que generó.') && await intentar(api(`/inversiones/rendimientos/${bo.dataset.borrar}`, { method: 'DELETE' }))) pintar();
    });
    pintar().catch((err) => { aviso(err.message, 'error'); fondo.remove(); });
  }

  // ---------- Ganancias por mes ----------
  function gananciasMes() {
    const g = resumenGanancias;
    $('#gananciasMes').innerHTML = g.porMes.length
      ? `<div class="dos-col" style="grid-template-columns:1.2fr 1fr"><div class="tabla-caja"><table class="tabla" style="min-width:0"><thead><tr><th>Mes</th><th class="num">Ganancias</th><th class="num">Registros</th><th>Ingresos</th></tr></thead><tbody>${g.porMes.map((m) => `<tr><td><b>${m.mes}</b></td><td class="num"><b class="pos">${dinero(m.total)}</b></td><td class="num">${m.cantidad}</td><td><a href="ingresos-gastos.html#ingresos">Ya está en Ingresos</a></td></tr>`).join('')}</tbody></table></div>
        <div class="tabla-caja"><table class="tabla" style="min-width:0"><thead><tr><th>Inversión</th><th class="num">Total cobrado</th></tr></thead><tbody>${g.porInversion.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${dinero(x.total)}</td></tr>`).join('')}</tbody></table></div></div>`
      : '<div class="vacio">Cuando registres ganancias en tus inversiones, aquí verás cuánto te paga cada mes.</div>';
  }

  // ---------- Simulador ----------
  function simular() {
    const ini = Number($('#sInicial').value) || 0;
    const ap = Number($('#sAporte').value) || 0;
    const tasa = Number($('#sTasa').value) || 0;
    const anios = Math.max(1, Math.min(50, Number($('#sAnios').value) || 1));
    const r = Math.pow(1 + tasa / 100, 1 / 12) - 1;
    const tipo = tipos.find((t) => String(t.id_tipo_inversion) === $('#sTipo').value);
    $('#sNota').textContent = tipo ? `${tipo.nombre} · riesgo ${tipo.nivel_riesgo}. ${info(tipo).que ? info(tipo).que.split('. ')[0] + '.' : ''} La tasa es una referencia: puedes cambiarla.` : 'Simulación con la tasa que escribas.';

    let saldo = ini;
    const filas = [];
    for (let a = 1; a <= anios; a++) {
      for (let i = 0; i < 12; i++) saldo = saldo * (1 + r) + ap;
      const aportado = ini + ap * a * 12;
      filas.push({ a, aportado, valor: saldo, ganancia: saldo - aportado });
    }
    const fin = filas[filas.length - 1];
    $('#simResultado').innerHTML = `
      <div class="kpi"><small>Aportarías en total</small><b>${dinero(fin.aportado)}</b></div>
      <div class="kpi verde"><small>Valor proyectado</small><b>${dinero(fin.valor)}</b></div>
      <div class="kpi verde"><small>Ganado por intereses</small><b>${dinero(fin.ganancia)}</b></div>`;
    const mostrar = filas.length <= 10 ? filas : filas.filter((f, i) => i === 0 || f.a % Math.ceil(filas.length / 9) === 0 || i === filas.length - 1);
    const max = fin.valor || 1;
    $('#simTabla').innerHTML = `<div class="tabla-caja"><table class="tabla" style="min-width:0"><thead><tr><th>Año</th><th class="num">Aportado</th><th class="num">Valor</th><th class="num">Intereses</th><th style="min-width:120px"></th></tr></thead><tbody>${mostrar.map((f) => `<tr><td>${f.a}</td><td class="num">${dinero(f.aportado)}</td><td class="num"><b>${dinero(f.valor)}</b></td><td class="num pos">${dinero(f.ganancia)}</td><td><div class="progreso"><i style="width:${(f.valor / max) * 100}%"></i></div></td></tr>`).join('')}</tbody></table></div>`;
  }
  ['sInicial', 'sAporte', 'sTasa', 'sAnios'].forEach((id) => $('#' + id).addEventListener('input', simular));
  $('#sTipo').addEventListener('change', (e) => {
    const id = Number(e.target.value);
    const t = tipos.find((x) => x.id_tipo_inversion === id);
    if (t) { tipoActivo = id; $('#sTasa').value = tasaRef(t); dibujarTipos(); }
    simular();
  });

  // ---------- Carga ----------
  async function cargar() {
    try {
      [lista, resumenGanancias] = await Promise.all([api('/inversiones'), api('/inversiones/rendimientos')]);
      kpis(); tabla(); gananciasMes();
    } catch (e) { $('#lista').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
  }

  api('/inversiones/tipos').then((t) => {
    // Del menor al mayor riesgo, y por nombre dentro de cada nivel
    tipos = [...t].sort((a, b) => ['bajo', 'medio', 'alto'].indexOf(a.nivel_riesgo) - ['bajo', 'medio', 'alto'].indexOf(b.nivel_riesgo) || a.nombre.localeCompare(b.nombre, 'es'));
    $('#sTipo').innerHTML = '<option value="">Personalizado</option>' + tipos.map((x) => `<option value="${x.id_tipo_inversion}">${esc(x.nombre)}</option>`).join('');
    dibujarTipos();
    simular();
  });
  irAPestana = window.UI.pestanas();
  cargar();
})();
