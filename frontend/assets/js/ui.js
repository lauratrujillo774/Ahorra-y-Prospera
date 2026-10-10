// Utilidades de interfaz compartidas: dinero, avisos, ventanas emergentes y utilidades de formularios
(() => {
  const usuario = () => (window.APSesion && window.APSesion.usuario()) || {};

  const simbolo = () => usuario().simbolo_moneda || '$';
  const dinero = (n) => {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + simbolo() + Math.abs(v).toLocaleString('es-CO');
  };
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const mesActual = () => hoy().slice(0, 7);
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = (iso) => {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]} ${MESES_CORTOS[Number(p[1]) - 1]} ${p[0]}` : '—';
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function aviso(texto, tipo = 'ok') {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = texto;
    t.dataset.tipo = tipo;
    t.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  window.avisarApp = (texto) => aviso(texto);

  // Ejecuta una acción de la API mostrando el resultado; devuelve true si salió bien
  async function intentar(promesa, mensajeOk) {
    try {
      const r = await promesa;
      aviso(mensajeOk || r.message || 'Listo ✓');
      return r;
    } catch (e) {
      aviso(e.message, 'error');
      return null;
    }
  }

  // Ventana emergente con formulario: campos = [{ k, label, tipo, valor, opciones, req, ayuda, step, min, max }]
  function modal({ titulo, descripcion, campos = [], textoOk = 'Guardar', peligro = false }) {
    return new Promise((resolver) => {
      const fondo = document.createElement('div');
      fondo.className = 'ap-modal-fondo';
      const campo = (c) => {
        const id = 'mc_' + c.k;
        if (c.tipo === 'select') {
          return `<div class="campo-ap"><label for="${id}">${esc(c.label)}</label><select id="${id}">${c.opciones.map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(c.valor ?? '') ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select></div>`;
        }
        if (c.tipo === 'check') {
          return `<label class="check-ap"><input type="checkbox" id="${id}" ${c.valor ? 'checked' : ''}> ${esc(c.label)}</label>`;
        }
        return `<div class="campo-ap"><label for="${id}">${esc(c.label)}</label><input id="${id}" type="${c.tipo || 'text'}" value="${esc(c.valor ?? '')}" ${c.step ? `step="${c.step}"` : ''} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.max !== undefined ? `max="${c.max}"` : ''} ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}>${c.ayuda ? `<p class="ayuda-ap">${esc(c.ayuda)}</p>` : ''}</div>`;
      };
      fondo.innerHTML = `<div class="ap-modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <h3>${esc(titulo)}</h3>${descripcion ? `<p class="sub">${descripcion}</p>` : ''}
        <form novalidate>${campos.map(campo).join('')}<div class="mensaje-ap" role="alert"></div>
        <div class="acciones-plan" style="margin-top:18px;justify-content:flex-end">
          <button type="button" class="boton-ap suave" data-cancelar>Cancelar</button>
          <button type="submit" class="boton-ap ${peligro ? 'peligro' : 'principal'}">${esc(textoOk)}</button></div></form></div>`;
      document.body.appendChild(fondo);
      const cerrar = (valor) => { fondo.remove(); document.removeEventListener('keydown', teclas); resolver(valor); };
      const teclas = (e) => { if (e.key === 'Escape') cerrar(null); };
      document.addEventListener('keydown', teclas);
      fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(null); });
      $('[data-cancelar]', fondo).addEventListener('click', () => cerrar(null));
      $('form', fondo).addEventListener('submit', (e) => {
        e.preventDefault();
        const valores = {};
        for (const c of campos) {
          const el = document.getElementById('mc_' + c.k);
          valores[c.k] = c.tipo === 'check' ? el.checked : el.value.trim();
          if (c.req && !valores[c.k]) {
            const m = $('.mensaje-ap', fondo);
            m.textContent = `Completa: ${c.label}`;
            m.className = 'mensaje-ap ver error';
            el.focus();
            return;
          }
        }
        cerrar(valores);
      });
      const primero = $('input, select', fondo);
      if (primero) primero.focus();
      else $('button[type=submit]', fondo).focus();
    });
  }

  const confirmar = (texto, textoOk = 'Eliminar') => modal({ titulo: 'Confirmar', descripcion: esc(texto), textoOk, peligro: true }).then((v) => v !== null);

  // Rellena un <select> con categorías
  async function cargarCategorias(select, tipo, seleccionada) {
    const cats = await window.APSesion.api('/categorias?tipo=' + tipo);
    select.innerHTML = '<option value="">Sin categoría</option>' + cats.map((c) => `<option value="${c.id_categoria}" ${String(c.id_categoria) === String(seleccionada) ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
    return cats;
  }

  const barra = (pct, clase = '') => `<div class="progreso"><i class="${clase}" style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
  const vacio = (texto) => `<div class="vacio">${texto}</div>`;

  // Subsecciones: botones .pestanas [data-tab] que muestran el [data-panel] correspondiente (se recuerda en la URL)
  function pestanas(alCambiar) {
    const barra = document.querySelector('.pestanas');
    const paneles = [...document.querySelectorAll('[data-panel]')];
    if (!barra || !paneles.length) return () => {};
    const ir = (nombre, guardar = true) => {
      if (!paneles.some((p) => p.dataset.panel === nombre)) nombre = paneles[0].dataset.panel;
      barra.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('activa', b.dataset.tab === nombre));
      paneles.forEach((p) => { p.hidden = p.dataset.panel !== nombre; });
      if (guardar && history.replaceState) history.replaceState(null, '', location.pathname + '#' + nombre);
      if (alCambiar) alCambiar(nombre);
    };
    barra.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) ir(b.dataset.tab); });
    window.addEventListener('hashchange', () => ir(location.hash.slice(1), false));
    ir(location.hash.slice(1) || paneles[0].dataset.panel, false);
    return ir;
  }

  window.UI = { pestanas, dinero, esc, hoy, mesActual, fecha, $, $$, aviso, intentar, modal, confirmar, cargarCategorias, barra, vacio, simbolo };
})();
