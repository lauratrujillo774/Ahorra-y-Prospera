// Pagos programados: recordatorios de cuotas, facturas y suscripciones
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, fecha, hoy, $, intentar, confirmar, modal } = window.UI;
  let pagos = [];

  const etiquetaDias = (p) => (p.estado !== 'programado' ? '' : p.dias_restantes < 0 ? `<span class="pildora alta">Vencido hace ${-p.dias_restantes} d</span>` : p.dias_restantes === 0 ? '<span class="pildora alta">Vence hoy</span>' : p.dias_restantes <= p.dias_aviso ? `<span class="pildora media">En ${p.dias_restantes} d</span>` : `<span class="pildora">En ${p.dias_restantes} d</span>`);

  function dibujar() {
    $('#listaPagos').innerHTML = pagos.length
      ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Concepto</th><th>Fecha</th><th>Repite</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead><tbody>${pagos.map((p) => `
        <tr><td><b>${esc(p.concepto)}</b>${p.acreedor ? `<br><small class="texto-suave">Deuda: ${esc(p.acreedor)}</small>` : ''}</td><td>${fecha(p.fecha_pago)}</td><td>${p.frecuencia === 'unico' ? 'Una vez' : p.frecuencia}</td>
        <td class="num">${dinero(p.monto)}</td><td>${p.estado === 'programado' ? etiquetaDias(p) : `<span class="pildora">${p.estado}</span>`}</td>
        <td class="acciones-fila">${p.estado === 'programado' ? `<button class="mini verde" data-pagar="${p.id_pago_prog}">Pagado</button><button class="mini" data-omitir="${p.id_pago_prog}">Omitir</button>` : ''}<button class="icono-btn rojo" data-borrar="${p.id_pago_prog}" aria-label="Eliminar">🗑️</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vacio">No tienes pagos programados.<br>Programa tus cuotas y facturas para que te avisemos a tiempo.</div>';
  }

  async function cargar() {
    try { pagos = await api('/pagos'); dibujar(); }
    catch (e) { $('#listaPagos').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
  }

  $('#nuevoPago').addEventListener('click', async () => {
    let deudas = [];
    try { deudas = (await api('/deudas')).filter((d) => d.estado !== 'pagada'); } catch { /* sin deudas */ }
    const v = await modal({
      titulo: 'Programar un pago',
      campos: [
        { k: 'concepto', label: 'Concepto', req: true, placeholder: 'Ej. Cuota tarjeta, arriendo, internet' },
        { k: 'monto', label: 'Monto', tipo: 'number', req: true, min: 1, step: 1000 },
        { k: 'fecha_pago', label: 'Fecha del pago', tipo: 'date', valor: hoy(), req: true },
        { k: 'frecuencia', label: 'Se repite', tipo: 'select', valor: 'mensual', opciones: [{ valor: 'unico', texto: 'Una sola vez' }, { valor: 'semanal', texto: 'Cada semana' }, { valor: 'quincenal', texto: 'Cada 15 días' }, { valor: 'mensual', texto: 'Cada mes' }, { valor: 'anual', texto: 'Cada año' }] },
        { k: 'dias_aviso', label: 'Avisarme con cuántos días de anticipación', tipo: 'number', valor: 3, min: 0, max: 60 },
        { k: 'id_deuda', label: 'Pertenece a una deuda (opcional)', tipo: 'select', valor: '', opciones: [{ valor: '', texto: 'Ninguna' }, ...deudas.map((d) => ({ valor: d.id_deuda, texto: d.acreedor }))], ayuda: 'Al marcarlo como pagado, se abona a esa deuda.' },
      ],
      textoOk: 'Programar',
    });
    if (v && await intentar(api('/pagos', { method: 'POST', cuerpo: v }), 'Pago programado ✓')) cargar();
  });

  $('#listaPagos').addEventListener('click', async (e) => {
    const pagar = e.target.closest('[data-pagar]');
    const omitir = e.target.closest('[data-omitir]');
    const borrar = e.target.closest('[data-borrar]');
    if (pagar) {
      const p = pagos.find((x) => String(x.id_pago_prog) === pagar.dataset.pagar);
      let cats = [];
      try { cats = await api('/categorias?tipo=gasto'); } catch { /* sin categorías */ }
      const defecto = cats.find((c) => /servicios/i.test(c.nombre) && /(internet|luz|agua|gas|celular|plan|servicio)/i.test(p.concepto)) || cats.find((c) => c.nombre === 'Otros gastos');
      const v = await modal({
        titulo: `Marcar como pagado: ${p.concepto}`,
        descripcion: `Se registrará un gasto de <b>${dinero(p.monto)}</b> en tu sección de Gastos${p.id_deuda ? ' y se abonará a la deuda' : ''}.`,
        campos: [{ k: 'id_categoria', label: '¿En qué categoría de gasto lo registramos?', tipo: 'select', valor: defecto?.id_categoria ?? '', opciones: [{ valor: '', texto: 'Otros gastos' }, ...cats.map((c) => ({ valor: c.id_categoria, texto: c.nombre }))] }],
        textoOk: '✔ Pagado y registrar',
      });
      if (v && await intentar(api(`/pagos/${p.id_pago_prog}/pagar`, { method: 'POST', cuerpo: { id_categoria: v.id_categoria } }))) { cargar(); window.dispatchEvent(new Event('ap-deudas')); }
    }
    else if (omitir && await intentar(api(`/pagos/${omitir.dataset.omitir}/omitir`, { method: 'POST' }), 'Pago omitido')) cargar();
    else if (borrar && await confirmar('¿Eliminar este pago programado?') && await intentar(api(`/pagos/${borrar.dataset.borrar}`, { method: 'DELETE' }), 'Pago eliminado')) cargar();
  });

  cargar();
})();
