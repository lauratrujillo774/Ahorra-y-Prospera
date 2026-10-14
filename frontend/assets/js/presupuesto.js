// Presupuesto: estado del mes, configuración con sugerencias de IA y presupuesto general (mes a mes)
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, $, barra, intentar, modal, aviso } = window.UI;
  const mensaje = $('#mensaje');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let categorias = [];
  let actual = null;

  const periodo = () => { const [a, m] = $('#mes').value.split('-').map(Number); return { a, m }; };
  const nombreMes = (a, m) => `${MESES[m - 1]} de ${a}`;
  const claseUso = (pct, umbral) => (pct >= 100 ? 'exceso' : pct >= umbral ? 'aviso' : '');
  const entradas = () => [...document.querySelectorAll('#limites [data-cat]')];
  const asignadoActual = () => entradas().reduce((t, i) => t + (Number(i.value) > 0 ? Number(i.value) : 0), 0);

  // ---------- Pestañas ----------
  function pestana(nombre) {
    document.querySelectorAll('.pestana').forEach((b) => b.classList.toggle('activa', b.dataset.tab === nombre));
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== nombre; });
    if (nombre === 'general') general();
    if (history.replaceState) history.replaceState(null, '', nombre === 'mes' ? location.pathname : `#${nombre}`);
  }
  document.querySelector('.pestanas').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) pestana(b.dataset.tab); });

  // ---------- Estado del mes (solo categorías con límite) ----------
  function estado(p) {
    if (!p.existe) {
      $('#estado').innerHTML = `<div class="vacio">Aún no tienes un presupuesto para este mes.<br>Configura uno abajo o pídele una sugerencia a la IA.</div>`;
      return;
    }
    const clase = claseUso(p.porcentaje, p.umbral_alerta);
    const conLimite = p.categorias.filter((c) => c.monto_limite);
    const filas = conLimite.map((c) => {
      const pct = Math.round((c.gastado / c.monto_limite) * 100);
      const disponible = c.monto_limite - c.gastado;
      return `<tr><td><span class="chip-cat"><i style="background:${esc(c.color || '#9E9E9E')}"></i>${esc(c.categoria)}</span></td>
        <td class="num">${dinero(c.monto_limite)}</td><td class="num">${dinero(c.gastado)}</td>
        <td class="num"><b class="${disponible < 0 ? 'neg' : 'pos'}">${dinero(disponible)}</b></td>
        <td style="min-width:140px">${barra(pct, claseUso(pct, p.umbral_alerta))}<small class="texto-suave">${pct}%</small></td></tr>`;
    }).join('');
    $('#estado').innerHTML = `
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi"><small>Presupuesto total</small><b>${dinero(p.monto_total)}</b><em>aviso al ${p.umbral_alerta}%</em></div>
        <div class="kpi ${p.porcentaje >= 100 ? 'rojo' : ''}"><small>Gastado</small><b>${dinero(p.totalGastado)}</b><em>${p.porcentaje}% del presupuesto</em></div>
        <div class="kpi ${p.monto_total - p.totalGastado < 0 ? 'rojo' : 'verde'}"><small>${p.monto_total - p.totalGastado < 0 ? 'Te pasaste por' : 'Te queda disponible'}</small><b>${dinero(Math.abs(p.monto_total - p.totalGastado))}</b></div>
        <div class="kpi"><small>Repartido en categorías</small><b>${dinero(p.asignado)}</b><em>${p.porAsignar >= 0 ? `por repartir: ${dinero(p.porAsignar)}` : ''}</em></div>
      </div>${barra(p.porcentaje, clase)}
      <p class="sub" style="margin:10px 0 16px">${p.porcentaje >= 100 ? '⚠️ Superaste tu presupuesto del mes.' : p.porcentaje >= p.umbral_alerta ? `⚠️ Ya usaste más del ${p.umbral_alerta}% (tu aviso).` : 'Vas dentro del presupuesto. ¡Sigue así!'}</p>
      ${filas ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Categoría</th><th class="num">Límite</th><th class="num">Gastado</th><th class="num">Disponible</th><th>Uso</th></tr></thead><tbody>${filas}</tbody></table></div>` : '<p class="sub">Aún no repartes el total en categorías: hazlo abajo.</p>'}`;
  }

  // ---------- Reparto del total entre categorías ----------
  function actualizarReparto() {
    const total = Number($('#total').value) || 0;
    const asignado = asignadoActual();
    const resto = total - asignado;
    $('#reparto').innerHTML = total
      ? `<div class="kpis"><div class="kpi"><small>Presupuesto total</small><b>${dinero(total)}</b></div>
          <div class="kpi"><small>Repartido en categorías</small><b>${dinero(asignado)}</b><em>${Math.round((asignado / total) * 100)}% del total</em></div>
          <div class="kpi ${resto < 0 ? 'rojo' : 'verde'}"><small>${resto < 0 ? 'Te pasaste por' : 'Por repartir'}</small><b>${dinero(Math.abs(resto))}</b><em>${resto < 0 ? 'Reduce algún límite o sube el total' : 'Aún sin asignar a una categoría'}</em></div></div>
         <div style="margin-top:10px">${barra(total ? (asignado / total) * 100 : 0, resto < 0 ? 'exceso' : '')}</div>`
      : '<p class="sub" style="margin:0">Escribe el presupuesto total (o genera uno con IA) para empezar a repartirlo.</p>';
    entradas().forEach((i) => {
      i.placeholder = total ? `Hasta ${dinero(Math.max(0, resto + (Number(i.value) || 0)))}` : 'Sin límite';
      const ayuda = i.parentElement.querySelector('.ayuda-ap');
      if (ayuda) ayuda.textContent = total && Number(i.value) > 0 ? `${Math.round((Number(i.value) / total) * 100)}% del total` : '';
    });
  }

  function formulario(p, sugerido) {
    const previos = new Map(entradas().filter((i) => i.value).map((i) => [Number(i.dataset.cat), i.value]));
    $('#total').value = sugerido ? sugerido.monto_total : (p.existe ? p.monto_total : $('#total').value);
    $('#umbral').value = p.existe ? p.umbral_alerta : ($('#umbral').value || 80);
    const limites = new Map();
    if (sugerido) sugerido.limites.forEach((l) => limites.set(l.id_categoria, l.monto_limite));
    else if (p.existe && !previos.size) p.categorias.forEach((c) => { if (c.monto_limite) limites.set(c.id_categoria, c.monto_limite); });
    else previos.forEach((v, k) => limites.set(k, v));
    $('#limites').innerHTML = categorias.map((c) => `<div class="campo-ap"><label for="lim_${c.id_categoria}">${esc(c.nombre)}${c.propia ? ' ⭐' : ''}</label><input type="number" min="0" step="1000" data-cat="${c.id_categoria}" id="lim_${c.id_categoria}" value="${limites.get(c.id_categoria) ?? ''}"><p class="ayuda-ap"></p></div>`).join('');
    actualizarReparto();
  }

  // Las categorías por llenar se muestran siempre, tenga o no presupuesto el mes
  const mostrarEditor = (ver) => { $('#editor').hidden = !ver; };

  async function cargarCategorias() { categorias = await api('/categorias?tipo=gasto'); }

  async function cargar() {
    const { a, m } = periodo();
    try {
      actual = await api(`/presupuestos/${a}/${m}`);
      $('#origen').textContent = actual.heredadoDe
        ? `Copiamos automáticamente tu presupuesto de ${nombreMes(actual.heredadoDe.anio, actual.heredadoDe.mes)}. Ajústalo o genera uno nuevo con IA.`
        : actual.existe ? `Presupuesto de ${nombreMes(a, m)}${actual.generado_automaticamente ? ' · generado con IA' : ''}. Cada mes se guarda aparte.` : 'Llénalo tú o pídele una sugerencia a la IA (con o sin ingresos registrados).';
      estado(actual);
      formulario(actual);
      mostrarEditor(true);
    } catch (e) { $('#estado').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
  }

  // ---------- Presupuesto general (mes a mes) ----------
  async function general() {
    try {
      const { meses, resumen } = await api('/presupuestos/historial');
      $('#generalKpis').innerHTML = `
        <div class="kpi"><small>Meses con presupuesto</small><b>${resumen.cantidad}</b></div>
        <div class="kpi"><small>Promedio mensual</small><b>${dinero(resumen.promedio)}</b></div>
        <div class="kpi"><small>Último presupuesto</small><b>${dinero(resumen.ultimo)}</b></div>`;
      $('#historial').innerHTML = meses.length
        ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Mes</th><th class="num">Presupuesto</th><th class="num">Repartido</th><th class="num">Por repartir</th><th>Categorías</th><th>Origen</th><th></th></tr></thead><tbody>${meses.map((x) => `
          <tr><td><b>${nombreMes(x.anio, x.mes)}</b></td><td class="num">${dinero(x.monto_total)}</td><td class="num">${dinero(x.asignado)}</td><td class="num">${dinero(x.porAsignar)}</td>
          <td>${x.categorias}</td><td><span class="pildora ${x.ia ? '' : 'media'}">${x.ia ? 'IA' : 'Manual'}</span></td>
          <td class="acciones-fila"><button class="mini verde" data-abrir="${x.anio}-${String(x.mes).padStart(2, '0')}">Abrir</button></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="vacio">Aún no has guardado presupuestos. Crea el de este mes y se irá guardando mes a mes.</div>';
    } catch (e) { $('#historial').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
  }
  $('#historial').addEventListener('click', (e) => {
    const b = e.target.closest('[data-abrir]');
    if (!b) return;
    $('#mes').value = b.dataset.abrir;
    pestana('mes');
    cargar();
  });

  // Muestra la explicación de una sugerencia con el botón para aplicarla de una vez
  function ofrecerSugerencia(texto) {
    const caja = $('#explicacion');
    caja.innerHTML = `<span>${esc(texto)}</span><button type="button" class="boton-ap principal chico" id="usarPresupuesto">✔ Usar este presupuesto</button>`;
    caja.className = 'mensaje-ap ver ok sugerencia';
  }
  $('#explicacion').addEventListener('click', (e) => {
    if (e.target.closest('#usarPresupuesto')) $('#form').requestSubmit();
  });

  // ---------- Modo manual ----------
  $('#manual').addEventListener('click', () => {
    mostrarEditor(true);
    $('#form').dataset.generado = '';
    $('#explicacion').className = 'mensaje-ap';
    $('#total').focus();
    $('#editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    aviso('Escribe tu presupuesto total y reparte los límites por categoría.');
  });

  // ---------- Sugerencias ----------
  $('#sugerirIA').addEventListener('click', async () => {
    const { a, m } = periodo();
    const boton = $('#sugerirIA');
    boton.disabled = true;
    boton.textContent = '✦ Analizando tus ingresos…';
    try {
      let s = await api(`/presupuestos/${a}/${m}/sugerido-ia`);
      if (!s.hayIngresos) {
        // Sin ingresos registrados se puede crear igual: la persona indica cuánto dinero tiene disponible
        const v = await modal({ titulo: 'Presupuesto sin ingresos registrados', descripcion: 'Aún no tienes ingresos en la app. Dinos cuánto dinero tienes disponible para este mes y armamos el presupuesto con ese valor.',
          campos: [{ k: 'ingreso', label: 'Dinero disponible este mes', tipo: 'number', min: 1, step: 1000, req: true, placeholder: 'Ej. 1500000' }], textoOk: 'Generar presupuesto' });
        const indicado = Number(v?.ingreso);
        if (!(indicado > 0)) return;
        s = await api(`/presupuestos/${a}/${m}/sugerido-ia?ingreso=${indicado}`);
      }
      formulario(actual, s);
      mostrarEditor(true);
      ofrecerSugerencia(s.explicacion + ' Puedes ajustarlo abajo antes de usarlo; al usarlo te enviamos el resumen a tu correo.');
      $('#form').dataset.generado = '1';
    } catch (e) { aviso(e.message, 'error'); }
    finally { boton.disabled = false; boton.textContent = '✦ Presupuesto sugerido por la IA'; }
  });

  $('#sugerir').addEventListener('click', async () => {
    const { a, m } = periodo();
    const s = await intentar(api(`/presupuestos/${a}/${m}/sugerido`), '');
    if (!s) return;
    if (!s.hayHistorial) { aviso('Aún no tienes gastos de los últimos 3 meses para sugerir un presupuesto', 'error'); return; }
    formulario(actual, s);
    mostrarEditor(true);
    ofrecerSugerencia('Según tus últimos 3 meses: cada categoría con un 5% de margen sobre tu promedio. Puedes ajustarlo abajo antes de usarlo.');
    $('#form').dataset.generado = '';
  });

  // ---------- Crear categoría (también aparece en Gastos) ----------
  $('#nuevaCategoria').addEventListener('click', async () => {
    const v = await modal({ titulo: 'Nueva categoría', descripcion: 'Aparecerá aquí para ponerle un límite y también en la sección Gastos.',
      campos: [{ k: 'nombre', label: 'Nombre', req: true, placeholder: 'Ej. Mascotas, Gimnasio, Regalos' }, { k: 'color', label: 'Color', tipo: 'color', valor: '#15803d' }], textoOk: 'Crear categoría' });
    if (!v) return;
    if (await intentar(api('/categorias', { method: 'POST', cuerpo: { nombre: v.nombre, tipo: 'gasto', color: v.color } }), 'Categoría creada ✓')) {
      await cargarCategorias();
      formulario(actual);
      mostrarEditor(true);
    }
  });

  // ---------- Guardar ----------
  $('#form').addEventListener('input', actualizarReparto);
  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.className = 'mensaje-ap';
    const error = (t) => { mensaje.textContent = t; mensaje.className = 'mensaje-ap ver error'; };
    const total = Number($('#total').value);
    if (!(total > 0)) return error('Escribe el presupuesto total del mes');
    if (asignadoActual() > total) return error(`Los límites suman ${dinero(asignadoActual())} y superan tu presupuesto total de ${dinero(total)}. Reduce algún límite o sube el total.`);
    const limites = entradas().filter((i) => Number(i.value) > 0).map((i) => ({ id_categoria: Number(i.dataset.cat), monto_limite: Number(i.value) }));
    const { a, m } = periodo();
    const r = await intentar(api(`/presupuestos/${a}/${m}`, { method: 'PUT', cuerpo: { monto_total: total, umbral_alerta: $('#umbral').value, limites, generado: $('#form').dataset.generado === '1' } }));
    if (r) { $('#form').dataset.generado = ''; $('#explicacion').className = 'mensaje-ap'; $('#explicacion').innerHTML = ''; cargar(); }
  });

  $('#mes').value = window.UI.mesActual();
  $('#mes').addEventListener('change', cargar);
  cargarCategorias().then(cargar);
  if (location.hash === '#general') pestana('general');
})();
