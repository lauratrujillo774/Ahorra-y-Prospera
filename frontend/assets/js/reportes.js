// Reportes: eliges las secciones, descargas Excel, guardas un resumen en PDF y ves el historial
(() => {
  const { api, token } = window.APSesion;
  const { dinero, esc, fecha, $ } = window.UI;
  const mensaje = $('#mensaje');
  const NOMBRE = {
    completo: 'Reporte completo', ingresos: 'Ingresos', gastos: 'Gastos', balance: 'Balance mensual', presupuesto: 'Presupuestos', pagos: 'Pagos programados',
    ahorro: 'Metas de ahorro', cuentas: 'Cuentas de ahorro', inversiones: 'Inversiones', deudas: 'Deudas', retos: 'Retos y logros', educacion: 'Educación', recomendaciones: 'Recomendaciones IA',
  };
  const checks = () => [...document.querySelectorAll('input[name="seccion"]')];
  const elegidas = () => checks().filter((c) => c.checked).map((c) => c.value);

  function aviso(t, c = 'error') { mensaje.textContent = t; mensaje.className = `mensaje-ap ver ${c}`; }
  function contador() { $('#contador').textContent = `${elegidas().length} de ${checks().length} secciones elegidas`; }

  async function vistaPrevia() {
    try {
      const d = await api('/resumen');
      const u = window.APSesion.usuario() || {};
      $('#vistaPrevia').innerHTML = `<h2>Resumen financiero · ${esc(d.periodo.etiqueta)}</h2><p class="sub">${esc(u.nombres || '')} ${esc(u.apellidos || '')} · generado el ${fecha(new Date().toISOString().slice(0, 10))}</p>
        <div class="kpis" style="margin-bottom:16px">
          <div class="kpi"><small>Ingresos del mes</small><b>${dinero(d.mes.ingresos)}</b></div><div class="kpi"><small>Gastos del mes</small><b>${dinero(d.mes.gastos)}</b></div>
          <div class="kpi"><small>Ahorro en metas</small><b>${dinero(d.ahorroMetas)}</b></div><div class="kpi"><small>Inversiones</small><b>${dinero(d.inversiones.valor)}</b></div>
          <div class="kpi"><small>Deudas</small><b>${dinero(d.deudas)}</b></div><div class="kpi"><small>Patrimonio estimado</small><b>${dinero(d.patrimonio)}</b></div></div>
        <div class="tabla-caja"><table class="tabla"><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Balance</th></tr></thead><tbody>${d.serie.map((s) => `<tr><td>${s.etiqueta}</td><td class="num">${dinero(s.ingresos)}</td><td class="num">${dinero(s.gastos)}</td><td class="num"><b class="${s.ingresos - s.gastos < 0 ? 'neg' : 'pos'}">${dinero(s.ingresos - s.gastos)}</b></td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { $('#vistaPrevia').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
  }

  async function historial() {
    try {
      const h = await api('/exportaciones');
      $('#historial').innerHTML = h.length
        ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Fecha</th><th>Reporte</th><th>Formato</th><th>Periodo</th></tr></thead><tbody>${h.map((x) => `<tr><td>${fecha(x.creada_en.slice(0, 10))}</td><td>${NOMBRE[x.tipo_reporte] || x.tipo_reporte}</td><td>${x.formato.toUpperCase()}</td><td>${x.fecha_desde ? `${fecha(x.fecha_desde)} – ${fecha(x.fecha_hasta)}` : 'Todo'}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="vacio">Aún no has exportado reportes.</div>';
    } catch { /* sin historial */ }
  }

  document.addEventListener('change', (e) => { if (e.target.name === 'seccion') contador(); });
  $('#marcarTodo').addEventListener('click', () => { checks().forEach((c) => { c.checked = true; }); contador(); });
  $('#quitarTodo').addEventListener('click', () => { checks().forEach((c) => { c.checked = false; }); contador(); });

  // Descarga un reporte del servidor (Excel o PDF) con las secciones y fechas elegidas
  async function descargar(ruta, extension) {
    mensaje.className = 'mensaje-ap';
    const secciones = elegidas();
    if (!secciones.length) return aviso('Elige al menos una sección para el reporte');
    const desde = $('#desde').value;
    const hasta = $('#hasta').value;
    if (desde && hasta && desde > hasta) return aviso('La fecha inicial no puede ser posterior a la final');
    const boton = extension === 'pdf' ? $('#pdf') : $('#descargarExcel');
    const textoBoton = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Generando…';
    try {
      const API = location.port === '5000' || location.protocol === 'https:' ? '' : 'http://localhost:5000';
      const r = await fetch(API + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify({ secciones, fecha_desde: desde || null, fecha_hasta: hasta || null }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'No se pudo generar el reporte');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `${secciones.length === 1 ? 'reporte-' + secciones[0] : 'reporte-personalizado'}.${extension}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      window.UI.aviso(`Reporte ${extension.toUpperCase()} descargado ✓`);
      historial();
    } catch (err) { aviso(err.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor.' : err.message); }
    finally { boton.disabled = false; boton.textContent = textoBoton; }
  }

  $('#form').addEventListener('submit', (e) => { e.preventDefault(); descargar('/exportaciones', 'xlsx'); });
  $('#pdf').addEventListener('click', () => descargar('/exportaciones/pdf', 'pdf'));

  contador();
  vistaPrevia();
  historial();
})();
