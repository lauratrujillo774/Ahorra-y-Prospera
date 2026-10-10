// IA financiera: recomendaciones guardadas por el asesor
(() => {
  const { api } = window.APSesion;
  const { esc, fecha, $ } = window.UI;
  const ICONO = { ahorro: '🐷', gasto: '✂️', inversion: '📈', deuda: '💳', presupuesto: '📊', general: '💡' };

  async function cargar() {
    try {
      const lista = await api('/recomendaciones');
      const pendientes = lista.filter((r) => !r.leida).length;
      $('#cuenta').textContent = lista.length ? `${pendientes} por revisar` : '';
      $('#recs').innerHTML = lista.length
        ? lista.map((r) => `<div class="recomendacion ${r.prioridad}" style="${r.leida ? 'opacity:.6' : ''}"><div class="icono-rec">${ICONO[r.tipo] || '💡'}</div>
            <div><h4>${esc(r.titulo)} <span class="pildora ${r.prioridad}">${r.prioridad}</span></h4><p>${esc(r.mensaje)}</p>
            <p style="margin-top:6px;font-size:12px">${fecha(r.generada_en.slice(0, 10))} ${r.leida ? '· leída' : `· <a href="#" data-leer="${r.id_recomendacion}">Marcar como leída</a>`}</p></div></div>`).join('')
        : '<div class="vacio">Todavía no tienes recomendaciones.<br>Genera tu <a href="plan-financiero.html">Plan Financiero IA</a> y aparecerán aquí.</div>';
    } catch (e) { $('#recs').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
  }

  $('#recs').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-leer]');
    if (!a) return;
    e.preventDefault();
    await api(`/recomendaciones/${a.dataset.leer}/leer`, { method: 'POST' });
    cargar();
  });
  window.UI.pestanas();
  cargar();
})();
