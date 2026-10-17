// Panel principal: resumen real de las finanzas del usuario
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, fecha, $, barra, vacio } = window.UI;
  let grafica = null;

  const variacion = (v, bueno) => (v === null ? '<em>—</em>' : v === 0 ? '<em>= igual que el mes anterior</em>' : `<em class="${(v >= 0) === bueno ? '' : 'mal'}">${v >= 0 ? '↑' : '↓'} ${Math.abs(v)}% vs. mes anterior</em>`);

  const tarjeta = (tono, titulo, valor, nota, enlace) => `<a class="stat-tarjeta ${tono}" ${enlace ? `href="${enlace}"` : ''}>
      <div class="stat-cab"><small>${titulo}</small></div><b>${valor}</b>${nota}</a>`;

  function tarjetas(d) {
    const m = d.mes;
    // Arriba solo lo esencial del mes; el resto vive en la pestaña Patrimonio
    $('#stats').innerHTML =
      tarjeta(m.balance < 0 ? 'rojo' : 'verde', 'Balance del mes', dinero(m.balance),
        `<em class="${m.balance < 0 ? 'mal' : ''}">${m.tasaAhorro === null ? 'Sin ingresos aún' : (m.tasaAhorro < 0 ? 'Gastas más de lo que ganas' : `Ahorras el ${m.tasaAhorro}% de tus ingresos`)}</em>`) +
      tarjeta('verde', 'Ingresos del mes', dinero(m.ingresos), variacion(m.varIngresos, true), 'ingresos-gastos.html#ingresos') +
      tarjeta('ambar', 'Gastos del mes', dinero(m.gastos), variacion(m.varGastos, false), 'ingresos-gastos.html#gastos');
    $('#patrimonio').innerHTML =
      tarjeta('verde', 'Ahorrado en metas', dinero(d.ahorroMetas), `<em>${d.logros} logro(s)</em>`, 'ahorros.html') +
      tarjeta('verde', 'Inversiones', dinero(d.inversiones.valor),
        `<em class="${d.inversiones.valor < d.inversiones.invertido ? 'mal' : ''}">${d.inversiones.invertido ? `${dinero(d.inversiones.valor - d.inversiones.invertido)} de ganancia` : 'Aún no invierto'}</em>`, 'inversiones.html') +
      tarjeta(d.deudas ? 'rojo' : 'verde', 'Deudas pendientes', dinero(d.deudas),
        `<em class="${d.deudas ? 'mal' : ''}">${d.deudas ? 'Ver mis deudas →' : '¡Sin deudas!'}</em>`, 'deudas.html') +
      `<div class="patrimonio-total"><span>Patrimonio estimado</span><b>${dinero(d.patrimonio)}</b><small>Balance acumulado + inversiones − deudas</small></div>`;
  }

  // Puntos de retos y logros, nivel y recompensa lista para reclamar
  function puntos(d) {
    const rec = d.recompensas;
    const caja = $('#puntosCard');
    if (!rec) { caja.hidden = true; return; }
    const nivel = rec.nivelActual;
    const sig = rec.siguiente;
    const pct = sig ? Math.min(100, Math.round(((rec.puntos.total - (nivel?.puntos || 0)) / (sig.puntos - (nivel?.puntos || 0))) * 100)) : 100;
    const lista = rec.niveles.filter((n) => n.disponible);
    caja.innerHTML = `<div class="encabezado-panel"><div><h2>Tus puntos y recompensas</h2><p class="sub" style="margin:0">Ganas puntos con tus logros y retos completados.</p></div><a class="texto-suave" href="retos.html">Ver retos y logros →</a></div>
      <div class="puntos-fila"><div class="puntos-grande"><b>${rec.puntos.total}</b><small>puntos</small></div>
        <div style="flex:1;min-width:240px"><div class="meta-cifras"><span>${nivel ? `<b>${nivel.emoji} ${esc(nivel.nombre)}</b>` : 'Aún sin nivel'}</span><span>${sig ? `Faltan <b>${rec.faltan}</b> pts para ${sig.emoji} ${esc(sig.nombre)}` : '¡Nivel máximo!'}</span></div>${barra(pct)}</div></div>
      ${lista.length ? `<div class="mensaje-ap ver ok sugerencia" style="margin-top:14px"><span>¡Tienes ${lista.length} recompensa(s) por reclamar! ${lista.map((n) => esc(n.premio)).join(' · ')}</span><a class="boton-ap principal chico" href="retos.html">Reclamar</a></div>` : ''}`;
  }

  // Relación entre lo que entra y lo que se va gastando en el mes
  function relacion(d) {
    const { ingresos, gastos } = d.mes;
    const caja = $('#relacion');
    if (!ingresos) {
      caja.innerHTML = '<div class="encabezado-panel"><h2>Ingresos vs. lo que gastas</h2></div>' + vacio('Aún no registras ingresos este mes.<br><a href="ingresos-gastos.html#ingresos">Registra tu ingreso</a> para ver cuánto te queda.');
      return;
    }
    const pct = Math.round((gastos / ingresos) * 100);
    const queda = ingresos - gastos;
    const clase = pct >= 100 ? 'exceso' : pct >= 80 ? 'aviso' : '';
    const mensaje = pct >= 100 ? 'Ya gastaste todos tus ingresos de este mes.'
      : pct >= 80 ? `Te queda poco: solo el ${100 - pct}% de tus ingresos. Te avisamos por la campanita y por correo.`
        : pct >= 60 ? 'Vas a buen ritmo, pero cuida los gastos que no son necesarios.' : '¡Muy bien! Estás gastando por debajo de tus ingresos.';
    caja.innerHTML = `<div class="encabezado-panel"><div><h2>Ingresos vs. lo que gastas</h2><p class="sub" style="margin:0">${d.periodo.etiqueta}</p></div><a class="texto-suave" href="presupuesto.html">Ver presupuesto →</a></div>
      <div class="relacion-barra" role="img" aria-label="Has gastado el ${pct}% de tus ingresos"><i class="${clase}" style="width:${Math.min(100, pct)}%"></i></div>
      <div class="relacion-cifras"><span>Gastado: <b>${dinero(gastos)}</b> (${pct}%)</span><span>Ingresos: <b>${dinero(ingresos)}</b></span><span class="${queda < 0 ? 'neg' : 'pos'}">${queda < 0 ? 'Te pasaste por' : 'Te queda'}: <b>${dinero(Math.abs(queda))}</b></span></div>
      <p class="sub" style="margin:10px 0 0">${mensaje}</p>`;
  }

  function dibujarGrafica(serie) {
    const luz = document.body.classList.contains('light');
    const tinta = luz ? '#4b6358' : '#a3b8ad';
    const cont = $('#grafica');
    if (!window.Chart) { cont.parentElement.innerHTML = vacio('No se pudo cargar la gráfica (revisa tu conexión a internet).'); return; }
    if (grafica) grafica.destroy();
    grafica = new window.Chart(cont, {
      type: 'bar',
      data: {
        labels: serie.map((s) => s.etiqueta),
        datasets: [
          { label: 'Ingresos', data: serie.map((s) => s.ingresos), backgroundColor: '#16a34a', borderRadius: 6 },
          { label: 'Gastos', data: serie.map((s) => s.gastos), backgroundColor: '#f59e0b', borderRadius: 6 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: tinta, font: { size: 13 } } },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${dinero(c.parsed.y)}` } } },
        scales: { x: { grid: { display: false }, ticks: { color: tinta, font: { size: 12 } } },
          y: { grid: { color: luz ? '#10231a14' : '#ffffff12' }, ticks: { color: tinta, font: { size: 12 }, callback: (v) => dinero(v) } } },
      },
    });
  }

  function dibujar(d) {
    tarjetas(d);
    relacion(d);
    puntos(d);
    dibujarGrafica(d.serie);

    const meta = d.metaDestacada;
    $('#meta').innerHTML = `<div class="encabezado-panel"><h2>Meta destacada</h2><a class="texto-suave" href="ahorros.html">Ver todas →</a></div>` + (meta
      ? `<h3 style="font-size:18px">${esc(meta.nombre)}</h3><div class="meta-cifras" style="margin:10px 0"><span><b>${dinero(meta.monto_actual)}</b> ahorrado</span><span>Meta: <b>${dinero(meta.monto_objetivo)}</b></span></div>
         ${barra(meta.porcentaje_avance)}<p class="sub" style="margin-top:12px">Llevas el <b>${meta.porcentaje_avance}%</b>. Te faltan <b>${dinero(meta.monto_faltante)}</b>.</p>
         <a class="boton-ap suave chico" href="ahorros.html">Aportar a mi meta</a>`
      : `${vacio('Aún no tienes metas de ahorro.<br>Crea una y empieza a avanzar.')}<div style="text-align:center"><a class="boton-ap principal chico" href="ahorros.html">Crear mi primera meta</a></div>`);

    $('#recientes').innerHTML = d.recientes.length
      ? d.recientes.map((r) => `<div class="mov"><div class="mov-ic ${r.tipo}">${r.tipo === 'ingreso' ? '↑' : '↓'}</div><div><b>${esc(r.descripcion || r.categoria || (r.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))}</b><small>${esc(r.categoria || 'Sin categoría')} · ${fecha(r.fecha)}</small></div><strong class="${r.tipo}">${r.tipo === 'ingreso' ? '+' : '-'}${dinero(r.monto)}</strong></div>`).join('')
      : vacio('Todavía no registras movimientos.<br><a href="ingresos-gastos.html#gastos">Registra tu primer gasto</a> o <a href="ingresos-gastos.html#ingresos">ingreso</a>.');

    const totalCat = d.porCategoria.reduce((t, c) => t + c.total, 0);
    $('#categorias').innerHTML = d.porCategoria.length
      ? d.porCategoria.map((c) => `<div class="cat-fila"><div class="linea"><span class="chip-cat"><i style="background:${esc(c.color)}"></i>${esc(c.categoria)}</span><b>${dinero(c.total)}</b></div>${barra(totalCat ? (c.total / totalCat) * 100 : 0)}</div>`).join('')
      : vacio('Sin gastos este mes.');

    const p = d.presupuesto;
    $('#presupuesto').innerHTML = p
      ? `<div class="linea" style="display:flex;justify-content:space-between;font-size:14px"><span>Presupuesto del mes</span><b>${dinero(p.usado)} de ${dinero(p.total)} (${p.porcentaje}%)</b></div>${barra(p.porcentaje, p.porcentaje >= 100 ? 'exceso' : p.porcentaje >= p.umbral ? 'aviso' : '')}`
      : `<p class="sub" style="margin:0">Aún no defines un presupuesto este mes. <a href="presupuesto.html">Crear presupuesto</a></p>`;
    $('#pagos').innerHTML = d.proximosPagos.length
      ? '<h3 style="font-size:15px;margin-bottom:6px">Próximos pagos</h3>' + d.proximosPagos.map((x) => `<div class="mov" style="grid-template-columns:1fr auto"><div><b>${esc(x.concepto)}</b><small>${x.dias < 0 ? `Venció hace ${-x.dias} día(s)` : x.dias === 0 ? 'Vence hoy' : `En ${x.dias} día(s)`} · ${fecha(x.fecha_pago)}</small></div><strong>${dinero(x.monto)}</strong></div>`).join('')
      : '';

    $('#asesor').innerHTML = `<div class="encabezado-panel"><h2>Tu asesor IA</h2></div>` + (d.consejo
      ? `<h3 style="font-size:16px">${esc(d.consejo.titulo)}</h3><p class="sub">${esc(d.consejo.mensaje)}</p><a class="boton-ap suave chico" href="plan-financiero.html#recomendaciones">Ver las ${d.recomendacionesPendientes} recomendaciones</a>`
      : `<p class="sub">Genera tu plan financiero y tu asesor te dirá qué hacer primero con tu dinero.</p><a class="boton-ap principal chico" href="plan-financiero.html">Generar mi plan</a>`);
  }

  async function cargar() {
    try { dibujar(await api('/resumen')); }
    catch (e) { $('#stats').innerHTML = `<div class="panel vacio">${esc(e.message)}</div>`; }
  }
  window.addEventListener('ap-tema', () => { if (grafica) cargar(); });
  window.UI.pestanas();
  cargar();
})();
