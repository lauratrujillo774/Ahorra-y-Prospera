// Educación financiera dinámica: para ti (según tu situación), lecciones y actividades (quiz) generadas con IA
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, $, barra, intentar, aviso } = window.UI;
  const TEMAS = { todos: 'Todos', ahorro: 'Ahorro', presupuesto: 'Presupuesto', inversiones: 'Inversiones', deudas: 'Deudas', general: 'General' };
  const ICONO = { curso: '🎓', articulo: '📄', guia: '🧭', consejo: '💡', video: '▶️' };
  const PROV = { gemini: 'Gemini', groq: 'Groq', anthropic: 'Claude' };
  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let lecciones = [];
  let filtro = 'todos';

  // ---------- Tarjeta de lección (se usa en "Para ti" y en "Lecciones") ----------
  const tarjeta = (l) => `
    <article class="panel leccion" data-id="${l.id_contenido}" tabindex="0" role="button" aria-label="Abrir ${esc(l.titulo)}">
      <div class="etiquetas"><span class="etiqueta-mini">${ICONO[l.tipo] || '📄'} ${l.tipo}</span><span class="etiqueta-mini">${l.nivel}</span>${l.completado ? '<span class="etiqueta-mini" style="background:#15803d;color:#fff">completada ✓</span>' : ''}</div>
      <h3>${esc(l.titulo)}</h3>${l.razon ? `<p class="sub" style="margin:0;color:#15803d;font-weight:600">💡 ${esc(l.razon)}</p>` : `<p class="sub" style="margin:0">${esc(l.resumen || '')}</p>`}${barra(l.porcentaje)}
    </article>`;

  const buscar = (id) => lecciones.find((x) => String(x.id_contenido) === String(id)) || recomendadasCache.find((x) => String(x.id_contenido) === String(id));
  let recomendadasCache = [];

  // ---------- Para ti ----------
  async function paraTi() {
    try {
      const d = await api('/educacion/personalizado');
      const s = d.situacion;
      $('#situacion').innerHTML = `
        <div class="kpi"><small>Ingresos del mes</small><b>${dinero(s.ingresos)}</b></div>
        <div class="kpi"><small>Gastos del mes</small><b>${dinero(s.gastos)}</b></div>
        <div class="kpi ${s.deudas ? 'rojo' : 'verde'}"><small>Deudas</small><b>${dinero(s.deudas)}</b></div>
        <div class="kpi ${s.mesesFondo < 3 ? 'rojo' : 'verde'}"><small>Fondo de emergencia</small><b>${s.mesesFondo} meses</b><em>meta: 3 a 6 meses</em></div>
        <div class="kpi"><small>Inversiones activas</small><b>${s.inversiones}</b></div>
        <div class="kpi ${s.tienePresupuesto ? 'verde' : ''}"><small>Presupuesto del mes</small><b>${s.tienePresupuesto ? 'Sí' : 'No'}</b></div>`;
      recomendadasCache = d.recomendados;
      $('#recomendadas').innerHTML = d.recomendados.length ? d.recomendados.map(tarjeta).join('') : '<div class="panel vacio">Aún no hay lecciones recomendadas.</div>';
    } catch (e) { $('#recomendadas').innerHTML = `<div class="panel vacio">${esc(e.message)}</div>`; }
  }

  $('#generarLeccion').addEventListener('click', async () => {
    const boton = $('#generarLeccion');
    boton.disabled = true;
    boton.textContent = '✦ Preparando tu lección…';
    try {
      const l = await api('/educacion/leccion-ia', { method: 'POST', cuerpo: { tema: $('#temaLeccion').value } });
      $('#leccionIA').innerHTML = `<div class="leccion-ia"><b>${esc(l.titulo)}</b>\n\n${md(l.texto)}</div>
        <p class="ayuda-ap" style="margin-top:8px">${l.modo === 'ia' ? `Generada con IA (${esc(PROV[l.proveedor] || l.proveedor)}) · te quedan ${l.restantes} de ${l.limite} consultas hoy.` : 'Lección armada con tus datos (la IA no está disponible o llegaste al límite de hoy).'} Es contenido educativo, no asesoría personalizada.</p>`;
    } catch (e) { aviso(e.message, 'error'); }
    finally { boton.disabled = false; boton.textContent = '✦ Generar mi lección'; }
  });

  // ---------- Lecciones ----------
  function dibujarLecciones() {
    const hechas = lecciones.filter((l) => l.completado).length;
    const pct = lecciones.length ? Math.round((hechas / lecciones.length) * 100) : 0;
    $('#resumen').textContent = `${hechas} de ${lecciones.length} lecciones completadas`;
    $('#progresoGeneral').innerHTML = barra(pct) + `<p class="sub" style="margin:10px 0 0">${pct === 100 ? '¡Completaste todo! 🎉' : 'Completa una lección para ganar el logro "Estudiante financiero".'}</p>`;
    $('#filtros').innerHTML = Object.entries(TEMAS).map(([k, t]) => `<button class="filtro ${k === filtro ? 'activo' : ''}" data-tema="${k}">${t}</button>`).join('');
    const visibles = lecciones.filter((l) => filtro === 'todos' || l.tema === filtro);
    $('#lecciones').innerHTML = visibles.length ? visibles.map(tarjeta).join('') : '<div class="panel vacio">No hay lecciones en este tema.</div>';
  }

  async function abrir(l) {
    if (!l) return;
    if (l.porcentaje === 0) { await api(`/educacion/${l.id_contenido}/progreso`, { method: 'PUT', cuerpo: { porcentaje: 25 } }).catch(() => {}); l.porcentaje = 25; }
    const fondo = document.createElement('div');
    fondo.className = 'ap-modal-fondo';
    fondo.innerHTML = `<div class="ap-modal ancho"><div class="etiquetas"><span class="etiqueta-mini">${l.tema}</span><span class="etiqueta-mini">${l.nivel}</span></div>
      <h3 style="margin-top:10px">${esc(l.titulo)}</h3><div class="lectura" style="margin:14px 0">${esc(l.contenido || l.resumen || 'Contenido próximamente.')}</div>
      ${l.url_recurso ? `<p><a href="${esc(l.url_recurso)}" target="_blank" rel="noopener">Ver recurso adicional ↗</a></p>` : ''}
      <div class="acciones-plan" style="justify-content:flex-end"><button class="boton-ap suave" data-cerrar>Cerrar</button>
      <button class="boton-ap principal" data-completar ${l.completado ? 'disabled' : ''}>${l.completado ? 'Completada ✓' : 'Marcar como completada'}</button></div></div>`;
    document.body.appendChild(fondo);
    fondo.addEventListener('click', async (e) => {
      if (e.target === fondo || e.target.closest('[data-cerrar]')) { fondo.remove(); recargar(); }
      if (e.target.closest('[data-completar]') && await intentar(api(`/educacion/${l.id_contenido}/progreso`, { method: 'PUT', cuerpo: { porcentaje: 100 } }))) { fondo.remove(); recargar(); }
    });
  }

  async function recargar() {
    try { lecciones = await api('/educacion'); dibujarLecciones(); paraTi(); }
    catch (e) { $('#lecciones').innerHTML = `<div class="panel vacio">${esc(e.message)}</div>`; }
  }

  $('#filtros').addEventListener('click', (e) => { const t = e.target.closest('[data-tema]'); if (t) { filtro = t.dataset.tema; dibujarLecciones(); } });
  for (const id of ['lecciones', 'recomendadas']) {
    $('#' + id).addEventListener('click', (e) => { const a = e.target.closest('[data-id]'); if (a) abrir(buscar(a.dataset.id)); });
    $('#' + id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = e.target.closest('[data-id]'); if (a) abrir(buscar(a.dataset.id)); } });
  }

  // ---------- Actividades (quiz) ----------
  let quiz = null;
  let paso = 0;
  let aciertos = 0;

  function pintarPregunta() {
    const p = quiz.preguntas[paso];
    const marcador = quiz.preguntas.map((_, i) => `<i class="${i < paso ? 'hecha' : i === paso ? 'hecha' : ''}"></i>`).join('');
    $('#quiz').innerHTML = `<div class="quiz-barra">${marcador}</div><p class="texto-suave" style="margin:0 0 6px">Pregunta ${paso + 1} de ${quiz.preguntas.length}</p>
      <p class="quiz-pregunta">${esc(p.pregunta)}</p>
      <div class="quiz-opciones">${p.opciones.map((o, i) => `<button class="quiz-opcion" data-op="${i}">${esc(o)}</button>`).join('')}</div>
      <div id="quizRetro" style="margin-top:14px"></div>`;
  }

  function pintarFinal() {
    const total = quiz.preguntas.length;
    const msg = aciertos === total ? '¡Perfecto! 🏆 Dominas este tema.' : aciertos >= 2 ? '¡Muy bien! 👏 Vas por buen camino.' : 'Sigue practicando 💪 Repasa las lecciones de este tema.';
    $('#quiz').innerHTML = `<div class="kpi verde" style="text-align:center"><small>Tu resultado</small><b style="font-size:40px">${aciertos} / ${total}</b><em>${msg}</em></div>
      <p class="ayuda-ap" style="margin-top:10px">${quiz.modo === 'ia' ? `Actividad generada con IA (${esc(PROV[quiz.proveedor] || quiz.proveedor)}) · te quedan ${quiz.restantes} de ${quiz.limite} consultas hoy.` : 'Actividad con preguntas preparadas.'}</p>
      <div class="acciones-plan" style="margin-top:14px"><button class="boton-ap principal" id="otraVez">Otra actividad</button></div>`;
  }

  $('#empezarQuiz').addEventListener('click', async () => {
    const boton = $('#empezarQuiz');
    boton.disabled = true;
    boton.textContent = 'Preparando…';
    try {
      quiz = await api('/educacion/quiz', { method: 'POST', cuerpo: { tema: $('#temaQuiz').value } });
      paso = 0; aciertos = 0;
      pintarPregunta();
    } catch (e) { aviso(e.message, 'error'); }
    finally { boton.disabled = false; boton.textContent = '▶ Empezar actividad'; }
  });

  $('#quiz').addEventListener('click', (e) => {
    if (e.target.id === 'otraVez') { $('#quiz').innerHTML = ''; $('#empezarQuiz').click(); return; }
    if (e.target.id === 'siguiente') { paso += 1; if (paso >= quiz.preguntas.length) pintarFinal(); else pintarPregunta(); return; }
    const op = e.target.closest('[data-op]');
    if (!op) return;
    const p = quiz.preguntas[paso];
    const elegida = Number(op.dataset.op);
    document.querySelectorAll('.quiz-opcion').forEach((b, i) => { b.disabled = true; if (i === p.correcta) b.classList.add('correcta'); else if (i === elegida) b.classList.add('incorrecta'); });
    if (elegida === p.correcta) aciertos += 1;
    $('#quizRetro').innerHTML = `<div class="mensaje-ap ver ${elegida === p.correcta ? 'ok' : 'error'}"><b>${elegida === p.correcta ? '¡Correcto!' : 'No exactamente.'}</b> ${esc(p.explicacion || '')}</div>
      <div class="acciones-plan" style="margin-top:12px"><button class="boton-ap principal chico" id="siguiente">${paso + 1 >= quiz.preguntas.length ? 'Ver resultado' : 'Siguiente →'}</button></div>`;
  });

  window.UI.pestanas();
  recargar();
})();
