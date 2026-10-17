// Deudas y pagos: lista, alta, registro de pagos y eliminación (guarda en la base de datos)
(() => {
  const { api } = window.APSesion;
  const $ = (s, r = document) => r.querySelector(s);
  const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

  const mensaje = $('#mensaje');
  function avisar(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `mensaje-ap ver ${tipo}`;
  }

  async function cargar() {
    const listado = $('#listado');
    try {
      const deudas = await api('/deudas');
      const activas = deudas.filter((d) => d.estado !== 'pagada');
      const saldo = activas.reduce((t, d) => t + Number(d.saldo_pendiente), 0);
      const cuotas = activas.reduce((t, d) => t + Number(d.cuota_mensual || 0), 0);
      const pagado = deudas.reduce((t, d) => t + Number(d.total_pagado), 0);
      $('#resumen-deudas').innerHTML = `
        <div class="kpi"><small>Total que debes</small><b>${dinero(saldo)}</b><em>${activas.length} deuda(s) activa(s)</em></div>
        <div class="kpi"><small>Cuotas mensuales</small><b>${dinero(cuotas)}</b></div>
        <div class="kpi"><small>Ya pagado</small><b class="pos">${dinero(pagado)}</b><em>¡sigue así!</em></div>`;

      if (!deudas.length) {
        listado.innerHTML = '<div class="panel vacio">Aún no registras deudas. Si no tienes, ¡felicitaciones!</div>';
        return;
      }
      listado.innerHTML = deudas.map((d) => {
        const total = Number(d.monto_total);
        const avance = Math.min(100, Math.round((Number(d.total_pagado) / total) * 100));
        const pagada = d.estado === 'pagada';
        const vencida = !pagada && Number(d.vencida);
        return `<article class="panel deuda-tarjeta" data-id="${d.id_deuda}">
          <div class="deuda-cabecera">
            <div><h3>${esc(d.acreedor)}</h3>${d.descripcion ? `<p class="sub" style="margin:2px 0 0">${esc(d.descripcion)}</p>` : ''}</div>
            <span class="pildora ${pagada ? '' : vencida ? 'alta' : 'media'}">${pagada ? 'Pagada' : vencida ? 'Vencida' : 'Al día'}</span>
          </div>
          <div class="progreso" aria-label="Avance ${avance}%"><i style="width:${avance}%"></i></div>
          <div class="deuda-datos">
            <span>Avance: <b>${avance}%</b></span><span>Saldo: <b>${dinero(d.saldo_pendiente)}</b></span><span>Valor total: <b>${dinero(total)}</b></span>
            ${d.tasa_interes_anual != null ? `<span>Tasa: <b>${d.tasa_interes_anual}% E.A.</b></span>` : ''}
            ${d.cuota_mensual ? `<span>Cuota: <b>${dinero(d.cuota_mensual)}</b></span>` : ''}
            <span>Vence: <b>${fecha(d.fecha_vencimiento)}</b></span>
          </div>
          <div class="deuda-acciones">
            ${pagada ? '' : '<button class="mini verde" data-pagar>+ Registrar pago</button>'}
            <button class="mini rojo" data-borrar>Eliminar</button>
          </div></article>`;
      }).join('');
    } catch (e) {
      listado.innerHTML = `<div class="panel vacio">${esc(e.message)}</div>`;
    }
  }

  $('#form-deuda').addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.className = 'mensaje-ap';
    const cuerpo = {
      acreedor: $('#acreedor').value.trim(), monto_total: $('#monto_total').value, tasa_interes_anual: $('#tasa').value,
      cuota_mensual: $('#cuota').value, fecha_vencimiento: $('#vencimiento').value, descripcion: $('#descripcion').value.trim(),
    };
    if (!cuerpo.acreedor) return avisar('Escribe a quién le debes');
    if (!(Number(cuerpo.monto_total) > 0)) return avisar('Escribe el valor de la deuda');
    if (!cuerpo.fecha_vencimiento) return avisar('Indica la fecha final de pago');
    try {
      await api('/deudas', { method: 'POST', cuerpo });
      e.target.reset();
      avisar('Deuda registrada', 'ok');
      cargar();
    } catch (err) { avisar(err.message); }
  });

  $('#listado').addEventListener('click', async (e) => {
    const tarjeta = e.target.closest('[data-id]');
    if (!tarjeta) return;
    const id = tarjeta.dataset.id;
    try {
      if (e.target.closest('[data-pagar]')) {
        const v = await window.UI.modal({ titulo: 'Registrar pago', campos: [{ k: 'monto', label: '¿Cuánto pagaste?', tipo: 'number', req: true, min: 1, step: 1000 }, { k: 'fecha_pago', label: 'Fecha', tipo: 'date', valor: window.UI.hoy() }], textoOk: 'Registrar' });
        if (!v) return;
        const r = await api(`/deudas/${id}/pagos`, { method: 'POST', cuerpo: v });
        window.avisarApp(r.message);
        cargar();
      } else if (e.target.closest('[data-borrar]')) {
        if (!(await window.UI.confirmar('¿Eliminar esta deuda y su historial de pagos?'))) return;
        await api(`/deudas/${id}`, { method: 'DELETE' });
        window.avisarApp('Deuda eliminada');
        cargar();
      }
    } catch (err) { window.avisarApp(err.message); }
  });

  window.UI.pestanas();
  window.addEventListener('ap-deudas', cargar);
  cargar();
})();
