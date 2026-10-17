// Retos financieros (progreso automático), logros y recompensas por puntos
(() => {
  const { api } = window.APSesion;
  const { esc, fecha, $, barra, intentar } = window.UI;
  const iconoLogro = { 'Primer paso': '', 'Ahorrador novato': '', 'Meta cumplida': '', 'Primero ahorro, luego gasto': '', 'Libre de deudas': '', 'Estudiante financiero': '', Inversionista: '', Constante: '' };
  // Qué mide cada reto, para que se entienda por qué avanza solo
  const COMO = {
    1: 'Avanza cada día que pasa sin registrar gastos en "Compras impulsivas". Si registras uno, vuelve a empezar la racha.',
    2: 'Avanza cuando haces aportes a tus metas de ahorro hasta sumar el 10% de lo que ingresa.',
    3: 'Avanza por cada semana en la que haces al menos un aporte a una meta de ahorro.',
    4: 'Avanza según lo que ahorras (metas y cuentas) frente a un mes de tus gastos.',
    5: 'Avanza cada vez que completas una lección en Educación financiera (3 en total).',
    6: 'Se completa cuando registras un pago a una deuda igual o mayor a su cuota.',
  };
  let retos = [];

  async function cargar() {
    try {
      const [r, l] = await Promise.all([api('/retos'), api('/logros')]);
      retos = r;
      $('#puntos').textContent = l.puntos;
      $('#puntosDetalle').textContent = `${l.puntosLogros} por logros · ${l.puntosRetos} por retos${l.recompensas.nivelActual ? ` · Nivel: ${l.recompensas.nivelActual.emoji} ${l.recompensas.nivelActual.nombre}` : ''}`;
      const ganados = l.logros.filter((x) => x.obtenido).length;
      $('#logrosCuenta').textContent = `${ganados} de ${l.logros.length} desbloqueados`;
      $('#logros').innerHTML = l.logros.map((x) => `<div class="logro ${x.obtenido ? 'ganado' : ''}"><div class="medalla">${iconoLogro[x.nombre] || ''}</div><b>${esc(x.nombre)}</b><small>${esc(x.descripcion)}</small><br><small><b>${x.puntos} pts</b>${x.obtenido ? ` · ${fecha(x.obtenido_en)}` : ' · bloqueado'}</small></div>`).join('');
      recompensas(l.recompensas);
      dibujar();
    } catch (e) { $('#retos').innerHTML = `<div class="panel vacio">${esc(e.message)}</div>`; }
  }

  function recompensas(rec) {
    $('#recompensas').innerHTML = rec.niveles.map((n) => {
      const falta = Math.max(0, n.puntos - rec.puntos.total);
      return `<article class="panel recompensa ${n.reclamada ? 'reclamada' : n.alcanzado ? '' : 'bloqueada'}">
        <div class="medalla">${n.emoji}</div><h3>${esc(n.nombre)}</h3><p class="sub" style="margin:0">${n.puntos} puntos</p>
        <p style="margin:0;font-size:14px">${esc(n.premio)}</p>
        ${n.reclamada ? '<span class="estado-pill cumplida">Reclamada</span>'
          : n.disponible ? `<button class="boton-ap principal chico" data-reclamar="${n.clave}">Reclamar recompensa</button>`
            : `${barra(Math.min(100, (rec.puntos.total / n.puntos) * 100))}<small class="texto-suave">Te faltan ${falta} puntos</small>`}
      </article>`;
    }).join('');
  }

  function dibujar() {
    $('#retos').innerHTML = retos.map((r) => {
      const enCurso = r.estado === 'en_curso';
      const hecho = r.estado === 'completado';
      return `<article class="panel meta-tarjeta" data-id="${r.id_reto}">
        <div class="deuda-cabecera"><h3>${esc(r.titulo)}</h3><span class="etiqueta-mini">${r.puntos} pts</span></div>
        <p class="sub" style="margin:0">${esc(r.descripcion)}</p>
        <div class="texto-suave">Duración: ${r.duracion_dias} días${COMO[r.id_reto] ? `<br>${esc(COMO[r.id_reto])}` : ''}</div>
        ${enCurso ? `${barra(r.progreso)}<div class="meta-cifras"><span><b>${Math.round(r.progreso)}%</b> completado (automático)</span><span>${r.dias_restantes} día(s) restantes</span></div>
          <div class="deuda-acciones"><button class="mini rojo" data-abandonar>Abandonar reto</button></div>`
          : hecho ? '<span class="estado-pill cumplida">Completado</span><div class="deuda-acciones"><button class="mini" data-unirse>Repetir reto</button></div>'
            : `<div class="deuda-acciones"><button class="mini verde" data-unirse>¡Aceptar el reto!</button></div>${r.estado === 'abandonado' ? '<div class="texto-suave">No se completó antes. ¡Puedes intentarlo otra vez!</div>' : ''}`}
      </article>`;
    }).join('');
  }

  $('#retos').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-id]');
    if (!t) return;
    const id = t.dataset.id;
    if (e.target.closest('[data-unirse]')) {
      if (await intentar(api(`/retos/${id}/unirse`, { method: 'POST' }))) cargar();
    } else if (e.target.closest('[data-abandonar]')) {
      if (await intentar(api(`/retos/${id}/abandonar`, { method: 'POST' }), 'Reto abandonado')) cargar();
    }
  });

  $('#recompensas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-reclamar]');
    if (b && await intentar(api(`/logros/recompensas/${b.dataset.reclamar}/reclamar`, { method: 'POST' }))) cargar();
  });

  window.UI.pestanas();
  cargar();
})();
