// Plan financiero IA: formulario de datos, generación del plan y descarga en Excel
(() => {
  const { api, token } = window.APSesion;
  const $ = (s, r = document) => r.querySelector(s);
  const CLAVE = 'ap-plan-form';

  const dinero = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CO');
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leer = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };

  const mensaje = $('#mensajePlan');
  function avisar(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `mensaje-ap ver ${tipo}`;
  }

  // ---------- Filas dinámicas ----------
  const plantillas = {
    ingreso: (d = {}) => `<div class="fila-dato ingreso" data-tipo="ingreso">
      <div class="campo-ap"><label>Fuente</label><input data-c="fuente" value="${esc(d.fuente || '')}" placeholder="Salario, negocio…"></div>
      <div class="campo-ap"><label>Monto al mes</label><input type="number" min="0" step="1000" data-c="monto" value="${d.monto ?? ''}"></div>
      <button type="button" class="quitar" aria-label="Quitar">✕</button></div>`,
    gasto: (d = {}) => `<div class="fila-dato gasto" data-tipo="gasto">
      <div class="campo-ap"><label>Categoría</label><input data-c="categoria" value="${esc(d.categoria || '')}" placeholder="Vivienda, comida…"></div>
      <div class="campo-ap"><label>Monto al mes</label><input type="number" min="0" step="1000" data-c="monto" value="${d.monto ?? ''}"></div>
      <div class="campo-ap"><label>Tipo</label><select data-c="tipo"><option value="necesidad" ${d.tipo !== 'deseo' ? 'selected' : ''}>Necesidad</option><option value="deseo" ${d.tipo === 'deseo' ? 'selected' : ''}>Deseo</option></select></div>
      <button type="button" class="quitar" aria-label="Quitar">✕</button></div>`,
    deuda: (d = {}) => `<div class="fila-dato deuda" data-tipo="deuda">
      <div class="campo-ap"><label>Acreedor</label><input data-c="acreedor" value="${esc(d.acreedor || '')}" placeholder="Banco, tarjeta…"></div>
      <div class="campo-ap"><label>Saldo pendiente</label><input type="number" min="0" step="1000" data-c="saldo" value="${d.saldo ?? ''}"></div>
      <div class="campo-ap"><label>Tasa E.A. %</label><input type="number" min="0" max="999" step="0.1" data-c="tasa" value="${d.tasa ?? ''}"></div>
      <div class="campo-ap"><label>Cuota mensual</label><input type="number" min="0" step="1000" data-c="cuota" value="${d.cuota ?? ''}"></div>
      <button type="button" class="quitar" aria-label="Quitar">✕</button></div>`,
    meta: (d = {}) => `<div class="fila-dato meta" data-tipo="meta">
      <div class="campo-ap"><label>Meta</label><input data-c="nombre" value="${esc(d.nombre || '')}" placeholder="Viaje, moto, estudio…"></div>
      <div class="campo-ap"><label>Objetivo</label><input type="number" min="0" step="1000" data-c="objetivo" value="${d.objetivo ?? ''}"></div>
      <div class="campo-ap"><label>Ya ahorrado</label><input type="number" min="0" step="1000" data-c="actual" value="${d.actual ?? ''}"></div>
      <div class="campo-ap"><label>Plazo (meses)</label><input type="number" min="1" max="600" data-c="meses" value="${d.meses ?? 12}"></div>
      <button type="button" class="quitar" aria-label="Quitar">✕</button></div>`,
  };
  const contenedores = { ingreso: $('#filas-ingresos'), gasto: $('#filas-gastos'), deuda: $('#filas-deudas'), meta: $('#filas-metas') };

  function agregarFila(tipo, datos) {
    contenedores[tipo].insertAdjacentHTML('beforeend', plantillas[tipo](datos));
  }
  function vaciar() { Object.values(contenedores).forEach((c) => { c.innerHTML = ''; }); }

  document.addEventListener('click', (e) => {
    const agregar = e.target.closest('[data-agregar]');
    if (agregar) agregarFila(agregar.dataset.agregar);
    const quitar = e.target.closest('.quitar');
    if (quitar) { quitar.closest('.fila-dato').remove(); guardarBorrador(); }
  });
  document.addEventListener('input', (e) => { if (e.target.closest('#formulario-plan')) guardarBorrador(); });

  // ---------- Para qué se busca el plan ----------
  const OBJETIVOS = {
    general: { meta: false, ayuda: 'Un plan general equilibra deudas, fondo de emergencia, metas e inversión según tu situación.' },
    emergencia: { meta: false, ayuda: 'Prioriza reunir 3 a 6 meses de gastos esenciales antes de asumir riesgos.' },
    deudas: { meta: false, ayuda: 'Destina más dinero a pagar tus deudas, empezando por la de mayor interés.' },
    vivienda: { meta: true, ayuda: 'Indica cuánto necesitas para la cuota inicial y en cuántos meses: el plan lo convierte en una meta de ahorro.' },
    vehiculo: { meta: true, ayuda: 'Indica cuánto necesitas reunir y en qué plazo para el vehículo.' },
    viaje: { meta: true, ayuda: 'Indica el costo del viaje y cuándo lo harás.' },
    educacion: { meta: true, ayuda: 'Indica el costo de los estudios y el plazo.' },
    retiro: { meta: false, ayuda: 'Da más peso a la inversión de largo plazo para tu retiro.' },
    invertir: { meta: false, ayuda: 'Da más peso a la inversión (después de cuidar tu fondo de emergencia y tus deudas caras).' },
    emprender: { meta: true, ayuda: 'Indica cuánto capital necesitas para tu negocio y en qué plazo.' },
    otro: { meta: true, ayuda: 'Describe tu objetivo, cuánto cuesta y en cuántos meses lo quieres lograr.' },
  };
  function mostrarObjetivo() {
    const o = OBJETIVOS[$('#objTipo').value] || OBJETIVOS.general;
    document.querySelectorAll('[data-obj="meta"]').forEach((el) => { el.hidden = !o.meta; });
    $('#objAyuda').textContent = o.ayuda;
  }
  $('#objTipo').addEventListener('change', mostrarObjetivo);
  mostrarObjetivo();

  // ---------- Leer / guardar el formulario ----------
  function leerFilas(tipo) {
    return [...contenedores[tipo].querySelectorAll('.fila-dato')].map((fila) => {
      const o = {};
      fila.querySelectorAll('[data-c]').forEach((i) => { o[i.dataset.c] = i.type === 'number' ? (i.value === '' ? 0 : Number(i.value)) : i.value.trim(); });
      return o;
    }).filter((o) => Object.values(o).some((v) => v));
  }
  function leerFormulario() {
    return {
      perfil: {
        edad: Number($('#edad').value), dependientes: Number($('#dependientes').value), ingresoEstable: $('#ingresoEstable').value === '1',
        riesgo: $('#riesgo').value, horizonte: Number($('#horizonte').value),
      },
      objetivo: { tipo: $('#objTipo').value, nombre: $('#objNombre').value.trim(), monto: Number($('#objMonto').value) || 0, meses: Number($('#objMeses').value) || 12 },
      ahorroActual: Number($('#ahorroActual').value) || 0,
      ingresos: leerFilas('ingreso'), gastos: leerFilas('gasto'), deudas: leerFilas('deuda'), metas: leerFilas('meta'),
    };
  }
  function ponerFormulario(f) {
    $('#edad').value = f.perfil?.edad ?? 30;
    $('#dependientes').value = f.perfil?.dependientes ?? 0;
    $('#ingresoEstable').value = f.perfil?.ingresoEstable === false ? '0' : '1';
    $('#riesgo').value = f.perfil?.riesgo ?? 'moderado';
    $('#horizonte').value = f.perfil?.horizonte ?? 5;
    $('#ahorroActual').value = f.ahorroActual ?? 0;
    $('#objTipo').value = f.objetivo?.tipo || 'general';
    $('#objNombre').value = f.objetivo?.nombre || '';
    $('#objMonto').value = f.objetivo?.monto || '';
    $('#objMeses').value = f.objetivo?.meses || 24;
    mostrarObjetivo();
    vaciar();
    (f.ingresos?.length ? f.ingresos : [{}]).forEach((d) => agregarFila('ingreso', d));
    (f.gastos?.length ? f.gastos : [{}]).forEach((d) => agregarFila('gasto', d));
    (f.deudas || []).forEach((d) => agregarFila('deuda', d));
    (f.metas || []).forEach((d) => agregarFila('meta', d));
  }
  function guardarBorrador() { try { localStorage.setItem(CLAVE, JSON.stringify(leerFormulario())); } catch { /* sin almacenamiento */ } }

  // ---------- Datos propios del usuario (base de datos + movimientos del navegador) ----------
  const TIPO_NECESIDAD = /vivienda|arriendo|alquiler|servicio|aliment|mercado|transporte|salud|educaci|seguro/i;
  async function datosGuardados() {
    let db = { ingresos: [], gastos: [], deudas: [], metas: [] };
    try { db = await api('/plan/datos'); } catch { /* sin conexión: se usan los datos del navegador */ }

    // Movimientos registrados en las pantallas de Ingresos y Gastos (guardados en este navegador)
    const mov = leer('ap-movements', []);
    const mes = new Date().toISOString().slice(0, 7);
    const acumular = (tipo, campo) => {
      const mapa = {};
      mov.filter((m) => m.type === tipo && String(m.iso || '').startsWith(mes)).forEach((m) => {
        const k = m.cat || m.name || 'Otros';
        mapa[k] = (mapa[k] || 0) + Number(m.value || 0);
      });
      return Object.entries(mapa).map(([k, v]) => ({ [campo]: k, monto: v }));
    };
    const ingresos = db.ingresos.length ? db.ingresos : acumular('ingreso', 'fuente');
    const gastos = db.gastos.length
      ? db.gastos
      : acumular('gasto', 'categoria').map((g) => ({ ...g, tipo: TIPO_NECESIDAD.test(g.categoria) ? 'necesidad' : 'deseo' }));
    const metasLocales = leer('ap-goals', []).filter((g) => g.target).map((g) => ({ nombre: g.name, objetivo: g.target, actual: g.saved || 0, meses: 12 }));
    const metas = db.metas.length ? db.metas : metasLocales;
    const ahorroLocal = db.ahorroActual ?? mov.filter((m) => m.type === 'ahorro').reduce((t, m) => t + Number(m.value || 0), 0);
    return { ingresos, gastos, deudas: db.deudas, metas, ahorroActual: ahorroLocal };
  }

  $('#cargarDatos').addEventListener('click', async () => {
    const d = await datosGuardados();
    const actual = leerFormulario();
    ponerFormulario({ ...actual, ...d, perfil: actual.perfil, ahorroActual: d.ahorroActual || actual.ahorroActual });
    guardarBorrador();
    window.avisarApp(d.ingresos.length || d.gastos.length || d.deudas.length ? 'Datos cargados' : 'Aún no tienes movimientos guardados; completa el formulario');
  });

  // ---------- Resultados ----------
  const pildora = (p) => `<span class="pildora ${p}">${p}</span>`;
  const iconoRec = { ahorro: '', gasto: '', inversion: '', deuda: '', presupuesto: '', general: '' };

  function tabla(cabeceras, filas, pie) {
    return `<div class="tabla-caja"><table class="tabla"><thead><tr>${cabeceras.map((c, i) => `<th class="${i ? 'num' : ''}">${c}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody>
      ${pie ? `<tfoot><tr>${pie.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  }

  function dibujar(p) {
    const d = p.diagnostico;
    const color = d.puntaje >= 80 ? '#16a34a' : d.puntaje >= 60 ? '#65a30d' : d.puntaje >= 40 ? '#f59e0b' : '#dc2626';
    const claseNivel = d.puntaje >= 60 ? '' : d.puntaje >= 40 ? 'medio' : 'mal';
    const barra = (nombre, ideal, actual) => {
      const pct = ideal ? Math.min(100, (actual / ideal) * 100) : 0;
      return `<div class="barra-regla"><div class="linea"><span>${nombre}</span><span>${dinero(actual)} de ${dinero(ideal)} ideal</span></div>
        <div class="pista"><i class="${actual > ideal && nombre !== 'Ahorro (20%)' ? 'exceso' : ''}" style="width:${pct}%"></i></div></div>`;
    };
    const r = p.capacidad.reparto;

    const presupuesto = tabla(['Categoría', 'Tipo', 'Actual', 'Recomendado', 'Diferencia'],
      p.presupuesto.map((x) => [esc(x.categoria), x.tipo === 'deseo' ? 'Deseo' : 'Necesidad', dinero(x.actual), dinero(x.recomendado),
        `<span class="${x.recomendado - x.actual < 0 ? 'pos' : ''}">${dinero(x.recomendado - x.actual)}</span>`]),
      [`TOTAL`, '', dinero(p.presupuesto.reduce((t, x) => t + x.actual, 0)), dinero(p.presupuesto.reduce((t, x) => t + x.recomendado, 0)),
        dinero(p.presupuesto.reduce((t, x) => t + x.recomendado - x.actual, 0))]);

    const dp = p.deudas;
    const deudasHtml = dp.hay ? `
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi"><small>Pago extra mensual sugerido</small><b>${dinero(dp.extraMensual)}</b><em>a la deuda más cara</em></div>
        <div class="kpi"><small>Libre de deudas en</small><b>${dp.conPlan.meses} meses</b><em>pagando solo mínimos: ${dp.soloMinimos.meses} meses</em></div>
        <div class="kpi"><small>Intereses que te ahorras</small><b class="pos">${dinero(dp.ahorroIntereses)}</b><em>vs. pagar solo mínimos</em></div>
      </div>
      ${tabla(['Orden de pago (avalancha)', 'Tasa E.A.', 'Se paga en el mes'], dp.conPlan.orden.map((o, i) => [`${i + 1}. ${esc(o.nombre)}`, `${o.tasa}%`, o.mesPagada ?? '—']))}`
      : '<p class="sub">No registraste deudas. ¡Excelente! Mantén tu crédito sano y evita endeudarte por compras de deseo.</p>';

    const f = p.fondo;
    const metasHtml = p.metas.length
      ? tabla(['Meta', 'Objetivo', 'Falta', 'Cuota requerida', 'Cuota del plan', 'Estado'],
        p.metas.map((m) => [esc(m.nombre), dinero(m.objetivo), dinero(m.faltan), dinero(m.cuotaRequerida), dinero(m.cuotaAsignada),
          `<span class="pildora ${m.estado === 'Ampliar plazo' ? 'media' : ''}">${m.estado}${m.estado === 'Ampliar plazo' && m.mesesReales ? ` (~${m.mesesReales} m)` : ''}</span>`]))
      : '<p class="sub">No agregaste metas. Crea una (viaje, vivienda, estudio…) para darle propósito a tu ahorro.</p>';

    const inv = p.inversion;
    const invHtml = `
      <p class="sub">Perfil <b>${inv.perfil}</b> · horizonte ${inv.horizonte} años · rendimiento ponderado esperado <b>${inv.rendimientoEsperado}% E.A.</b> (supuesto de referencia) · aporte mensual <b>${dinero(inv.aporteMensual)}</b></p>
      ${tabla(['Producto', 'Riesgo', '% del aporte', 'Aporte mensual'], inv.distribucion.filter((x) => x.porcentaje > 0).map((x) => [esc(x.producto), x.riesgo, `${x.porcentaje}%`, dinero(x.aporte)]))}
      <h3 style="margin:18px 0 8px">Cuánto podría crecer</h3>
      ${tabla(['Plazo', 'Aportado', 'Valor proyectado', 'Sin invertir'], inv.proyeccion.map((x) => [`${x.anios} ${x.anios === 1 ? 'año' : 'años'}`, dinero(x.aportado), `<b class="pos">${dinero(x.valor)}</b>`, dinero(x.enColchon)]))}`;

    const proy = tabla(['Mes', 'Fondo emergencia', 'Metas', 'Inversión', 'Deuda pendiente', 'Patrimonio'],
      p.proyeccion12.map((x) => [`Mes ${x.mes}`, dinero(x.fondo), dinero(x.metas), dinero(x.inversion), dinero(x.deuda), `<b>${dinero(x.patrimonio)}</b>`]));

    $('#resultado').innerHTML = `
      <section class="panel"><div class="cabecera-resultado">
        <div class="puntaje" style="--p:${d.puntaje};--color:${color}"><div><b>${d.puntaje}</b><small>de 100</small></div></div>
        <div><span class="etiqueta-nivel ${claseNivel}">Salud financiera: ${d.nivel}</span>
          <h2 style="margin-top:10px">Tu diagnóstico</h2>
          <p style="margin:0 0 4px"><span class="pildora">Plan para: ${esc(p.objetivo?.etiqueta || "Plan general")}</span></p>
          <p class="sub" style="margin:0">Así está tu situación hoy y hacia dónde puedes llevarla.</p></div></div>
        <div class="kpis" style="margin-top:20px">
          <div class="kpi"><small>Ingresos</small><b>${dinero(d.ingresoTotal)}</b></div>
          <div class="kpi"><small>Gastos</small><b>${dinero(d.gastosTotal)}</b><em>necesidades ${dinero(d.necesidades)} · deseos ${dinero(d.deseos)}</em></div>
          <div class="kpi"><small>Cuotas de deudas</small><b>${dinero(d.cuotasDeuda)}</b><em>${d.relacionDeuda}% de tus ingresos</em></div>
          <div class="kpi ${d.flujoLibre < 0 ? 'alerta' : ''}"><small>Flujo libre mensual</small><b>${dinero(d.flujoLibre)}</b><em>tasa de ahorro ${d.tasaAhorro}%</em></div>
          <div class="kpi"><small>Fondo de emergencia</small><b>${f.mesesCubiertos} meses</b><em>meta ${f.mesesMeta} meses (${dinero(f.meta)})</em></div>
        </div>
        ${p.resumenIA ? `<div class="resumen-ia" style="margin-top:20px"><h3>Resumen de tu asesor</h3>${esc(p.resumenIA)}</div>` : ''}
      </section>

      <section class="panel"><h2>Recomendaciones de tu asesor</h2><p class="sub">Ordenadas por prioridad.</p>
        <div class="recomendaciones">${[...p.recomendaciones].sort((a, b) => ['alta', 'media', 'baja'].indexOf(a.prioridad) - ['alta', 'media', 'baja'].indexOf(b.prioridad))
          .map((x) => `<div class="recomendacion ${x.prioridad}"><div class="icono-rec">${iconoRec[x.tipo] || ''}</div><div><h4>${esc(x.titulo)} ${pildora(x.prioridad)}</h4><p>${esc(x.mensaje)}</p></div></div>`).join('')}</div></section>

      <section class="panel"><h2>¿Cómo repartir tu dinero cada mes?</h2>
        <p class="sub">Capacidad de ahorro mensual: <b>${dinero(p.capacidad.total)}</b>${p.capacidad.recorteSugerido ? ` (incluye ${dinero(p.capacidad.recorteSugerido)} que sale de recortar gastos de deseo)` : ''}.</p>
        <div class="reparto">
          <div class="kpi"><small>Pago extra de deudas</small><b>${dinero(r.deuda)}</b></div>
          <div class="kpi"><small>Fondo de emergencia</small><b>${dinero(r.fondo)}</b></div>
          <div class="kpi"><small>Metas de ahorro</small><b>${dinero(r.metas)}</b></div>
          <div class="kpi"><small>Inversión</small><b>${dinero(r.inversion)}</b></div></div>
        <h3 style="margin:22px 0 12px">Regla 50 / 30 / 20</h3>
        <div class="barras-regla">${barra('Necesidades + cuotas (50%)', p.regla503020.necesidades.ideal, p.regla503020.necesidades.actual)}
          ${barra('Deseos (30%)', p.regla503020.deseos.ideal, p.regla503020.deseos.actual)}${barra('Ahorro (20%)', p.regla503020.ahorro.ideal, p.regla503020.ahorro.actual)}</div></section>

      <section class="panel"><h2>Presupuesto recomendado</h2><p class="sub">Tu gasto actual frente al sugerido. Solo se ajustan los gastos de deseo.</p>${presupuesto}</section>
      <section class="panel"><h2>Plan para salir de deudas</h2>${deudasHtml}</section>
      <section class="panel"><h2>Fondo de emergencia y metas</h2>
        <p class="sub">Fondo meta: <b>${dinero(f.meta)}</b> (${f.mesesMeta} meses de gastos esenciales) · tienes <b>${dinero(f.actual)}</b> · aporte mensual <b>${dinero(f.aporteMensual)}</b>${f.mesesParaCompletar ? ` → completo en ~${f.mesesParaCompletar} meses` : ''}.</p>${metasHtml}</section>
      <section class="panel"><h2>Plan de inversión</h2>${invHtml}</section>
      <section class="panel"><h2>Tu próximo año, mes a mes</h2>${proy}</section>
      <div class="acciones-plan"><button class="boton-ap principal" type="button" id="descargar2">Descargar plan en Excel</button>
        <button class="boton-ap suave" type="button" onclick="window.print()">Imprimir / guardar PDF</button></div>`;
    $('#resultado').classList.add('ver');
    $('#descargar2').addEventListener('click', descargar);
    $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Acciones ----------
  async function generar() {
    mensaje.className = 'mensaje-ap';
    const boton = $('#generar');
    boton.disabled = true;
    boton.textContent = 'Analizando tus finanzas…';
    try {
      const plan = await api('/plan/generar', { method: 'POST', cuerpo: leerFormulario() });
      guardarBorrador();
      dibujar(plan);
    } catch (e) {
      avisar(e.message);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Generar mi plan con IA';
    }
  }

  async function descargar() {
    mensaje.className = 'mensaje-ap';
    try {
      const API = location.port === '5000' || location.protocol === 'https:' ? '' : 'http://localhost:5000';
      const respuesta = await fetch(API + '/plan/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify(leerFormulario()),
      });
      if (!respuesta.ok) throw new Error((await respuesta.json().catch(() => ({}))).message || 'No se pudo generar el Excel');
      const url = URL.createObjectURL(await respuesta.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plan-financiero-ahorra-y-prospera.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      window.avisarApp('Excel descargado');
    } catch (e) {
      avisar(e.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor.' : e.message);
    }
  }

  $('#generar').addEventListener('click', generar);
  $('#descargar').addEventListener('click', descargar);

  // ---------- Inicio: borrador guardado o datos del usuario ----------
  (async () => {
    const borrador = leer(CLAVE, null);
    if (borrador && (borrador.ingresos?.length || borrador.gastos?.length)) { ponerFormulario(borrador); return; }
    const d = await datosGuardados();
    ponerFormulario({ ...d, perfil: {} });
  })();
})();
