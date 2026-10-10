// Ingresos y gastos en una sola página (pestañas): lista del mes, alta, edición y borrado
(() => {
  const { api } = window.APSesion;
  const { dinero, esc, fecha, hoy, mesActual, intentar, confirmar, modal, cargarCategorias } = window.UI;

  function iniciar(raiz) {
    const tipo = raiz.dataset.tipo; // 'ingreso' | 'gasto'
    const esGasto = tipo === 'gasto';
    const ruta = esGasto ? '/gastos' : '/ingresos';
    const r = (n) => raiz.querySelector(`[data-r="${n}"]`);
    let editando = null;
    let datos = { total: 0, movimientos: [] };

    const avisarForm = (t, c = 'error') => { r('mensaje').textContent = t; r('mensaje').className = `mensaje-ap ver ${c}`; };

    function kpis() {
      const lista = datos.movimientos;
      const porCat = {};
      lista.forEach((m) => { const k = m.categoria || 'Sin categoría'; porCat[k] = (porCat[k] || 0) + m.monto; });
      const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
      const marcados = lista.filter((m) => m.extra === 1).reduce((t, m) => t + m.monto, 0);
      r('kpis').innerHTML = `
        <div class="kpi ${esGasto ? 'rojo' : 'verde'}"><small>Total del mes</small><b>${dinero(datos.total)}</b><em>${lista.length} movimiento(s)</em></div>
        <div class="kpi"><small>${esGasto ? 'Categoría con más gasto' : 'Principal fuente'}</small><b style="font-size:18px">${top ? esc(top[0]) : '—'}</b><em>${top ? dinero(top[1]) : 'Sin datos'}</em></div>
        <div class="kpi"><small>${esGasto ? 'Gastos de necesidad' : 'Ingresos fijos'}</small><b>${dinero(marcados)}</b><em>${esGasto ? `${datos.total ? Math.round((marcados / datos.total) * 100) : 0}% del total` : 'se repiten cada mes'}</em></div>`;
    }

    function lista() {
      const filas = datos.movimientos;
      r('lista').innerHTML = filas.length
        ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th class="num">Monto</th><th></th></tr></thead><tbody>${filas.map((m) => `
          <tr><td>${fecha(m.fecha)}</td><td>${esc(m.descripcion || '—')}${m.extra === 1 ? ` <span class="pildora">${esGasto ? 'necesidad' : 'fijo'}</span>` : ''}</td>
          <td><span class="chip-cat"><i style="background:${esc(m.color || '#9E9E9E')}"></i>${esc(m.categoria || 'Sin categoría')}</span></td>
          <td class="num"><b class="${esGasto ? 'neg' : 'pos'}">${esGasto ? '-' : '+'}${dinero(m.monto)}</b></td>
          <td class="acciones-fila"><button class="icono-btn" data-editar="${m.id}" title="Editar" aria-label="Editar">✏️</button><button class="icono-btn rojo" data-borrar="${m.id}" title="Eliminar" aria-label="Eliminar">🗑️</button></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="vacio">No hay ${esGasto ? 'gastos' : 'ingresos'} en este mes.<br>Usa el formulario para registrar el primero.</div>`;
    }

    async function cargar() {
      try {
        datos = await api(`${ruta}?mes=${r('mes').value}`);
        kpis();
        lista();
      } catch (e) { r('lista').innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
    }

    function limpiarFormulario() {
      editando = null;
      r('form').reset();
      r('fecha').value = hoy();
      r('tituloForm').textContent = esGasto ? 'Nuevo gasto' : 'Nuevo ingreso';
      r('guardar').textContent = 'Guardar';
      r('cancelar').hidden = true;
      r('mensaje').className = 'mensaje-ap';
    }

    r('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      r('mensaje').className = 'mensaje-ap';
      const cuerpo = { monto: r('monto').value, descripcion: r('descripcion').value, id_categoria: r('categoria').value, fecha: r('fecha').value, extra: r('extra').checked };
      if (!(Number(cuerpo.monto) > 0)) return avisarForm('Escribe un monto mayor a cero');
      if (!cuerpo.fecha) return avisarForm('Elige la fecha');
      const res = await intentar(api(editando ? `${ruta}/${editando}` : ruta, { method: editando ? 'PUT' : 'POST', cuerpo }), editando ? 'Cambios guardados ✓' : `${esGasto ? 'Gasto' : 'Ingreso'} registrado ✓`);
      if (res) { limpiarFormulario(); cargar(); }
    });
    r('cancelar').addEventListener('click', limpiarFormulario);

    r('lista').addEventListener('click', async (e) => {
      const editar = e.target.closest('[data-editar]');
      const borrar = e.target.closest('[data-borrar]');
      if (editar) {
        const m = datos.movimientos.find((x) => String(x.id) === editar.dataset.editar);
        editando = m.id;
        r('monto').value = m.monto; r('descripcion').value = m.descripcion || ''; r('fecha').value = m.fecha; r('extra').checked = m.extra === 1;
        r('categoria').value = m.id_categoria || '';
        r('tituloForm').textContent = 'Editar movimiento';
        r('guardar').textContent = 'Guardar cambios';
        r('cancelar').hidden = false;
        r('form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (borrar && await confirmar('¿Eliminar este registro? No se puede deshacer.')) {
        if (await intentar(api(`${ruta}/${borrar.dataset.borrar}`, { method: 'DELETE' }), 'Eliminado')) cargar();
      }
    });

    r('nuevaCategoria').addEventListener('click', async () => {
      const v = await modal({ titulo: 'Nueva categoría', campos: [{ k: 'nombre', label: 'Nombre', req: true }, { k: 'color', label: 'Color', tipo: 'color', valor: '#15803d' }], textoOk: 'Crear' });
      if (!v) return;
      const res = await intentar(api('/categorias', { method: 'POST', cuerpo: { nombre: v.nombre, tipo, color: v.color } }), 'Categoría creada ✓');
      if (res) await cargarCategorias(r('categoria'), tipo, res.id_categoria);
    });

    r('mes').value = mesActual();
    r('mes').addEventListener('change', cargar);
    r('fecha').value = hoy();
    cargarCategorias(r('categoria'), tipo);
    cargar();
    return cargar;
  }

  const recargas = [...document.querySelectorAll('[data-tipo]')].map(iniciar);
  window.UI.pestanas(() => recargas.forEach((c) => c()));
})();
