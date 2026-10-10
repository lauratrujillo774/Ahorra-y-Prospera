import { Router } from 'express';
import ExcelJS from 'exceljs';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { construirPdf } from '../../servicios/reportePdf.js';
import { emitirEvento } from '../../servicios/n8n.js';
import { errorServidor, esFecha, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// Secciones que se pueden incluir en un reporte (cada una puede generar varias hojas)
export const SECCIONES = ['ingresos', 'gastos', 'balance', 'presupuesto', 'pagos', 'ahorro', 'cuentas', 'inversiones', 'deudas', 'retos', 'educacion', 'recomendaciones'];
const DINERO = '"$"#,##0;[Red]-"$"#,##0';

function hoja(libro, nombre, columnas, filas, totalColumna) {
    const h = libro.addWorksheet(nombre.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    h.columns = columnas.map(([titulo, clave, ancho, formato]) => ({ header: titulo, key: clave, width: ancho, style: formato ? { numFmt: formato } : {} }));
    filas.forEach((f) => h.addRow(f));
    const cab = h.getRow(1);
    cab.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    cab.height = 22;
    if (totalColumna && filas.length) {
        const col = h.getColumn(totalColumna).letter;
        const t = h.addRow({});
        t.getCell(1).value = 'TOTAL';
        t.getCell(totalColumna).value = { formula: `SUM(${col}2:${col}${filas.length + 1})` };
        t.eachCell((c) => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; });
        t.getCell(totalColumna).numFmt = DINERO;
    }
    h.properties.tabColor = { argb: 'FF15803D' };
    return h;
}

const SI_NO = (v) => (v ? 'Sí' : 'No');

// Cada sección sabe armar sus hojas
const CONSTRUIR = {
    async ingresos(libro, id, rango, params) {
        const [f] = await connection.query(
            `SELECT m.fecha, COALESCE(c.nombre, 'Sin categoría') AS categoria, m.descripcion, m.monto FROM ingresos m LEFT JOIN categorias c ON c.id_categoria = m.id_categoria
              WHERE m.id_usuario = ? ${rango} ORDER BY m.fecha DESC, m.id_ingreso DESC`, [id, ...params]
        );
        hoja(libro, 'Ingresos', [['Fecha', 'fecha', 14], ['Categoría', 'categoria', 24], ['Descripción', 'descripcion', 36], ['Monto', 'monto', 16, DINERO]], f, 4);
    },
    async gastos(libro, id, rango, params) {
        const [f] = await connection.query(
            `SELECT m.fecha, COALESCE(c.nombre, 'Sin categoría') AS categoria, m.descripcion, m.monto FROM gastos m LEFT JOIN categorias c ON c.id_categoria = m.id_categoria
              WHERE m.id_usuario = ? ${rango} ORDER BY m.fecha DESC, m.id_gasto DESC`, [id, ...params]
        );
        hoja(libro, 'Gastos', [['Fecha', 'fecha', 14], ['Categoría', 'categoria', 24], ['Descripción', 'descripcion', 36], ['Monto', 'monto', 16, DINERO]], f, 4);
    },
    async balance(libro, id) {
        const [f] = await connection.query("SELECT CONCAT(anio, '-', LPAD(mes, 2, '0')) AS periodo, ingresos, gastos FROM vista_resumen_mensual WHERE id_usuario = ? ORDER BY anio DESC, mes DESC", [id]);
        const h = hoja(libro, 'Balance mensual', [['Mes', 'periodo', 14], ['Ingresos', 'ingresos', 18, DINERO], ['Gastos', 'gastos', 18, DINERO], ['Balance', 'balance', 18, DINERO]], f);
        f.forEach((_, i) => { h.getCell(i + 2, 4).value = { formula: `B${i + 2}-C${i + 2}` }; h.getCell(i + 2, 4).numFmt = DINERO; });
    },
    async presupuesto(libro, id) {
        const [p] = await connection.query(
            `SELECT CONCAT(anio, '-', LPAD(mes, 2, '0')) AS periodo, monto_total, umbral_alerta, IF(generado_automaticamente = 1, 'IA', 'Manual') AS origen FROM presupuestos WHERE id_usuario = ? ORDER BY anio DESC, mes DESC`, [id]
        );
        hoja(libro, 'Presupuestos', [['Mes', 'periodo', 14], ['Presupuesto total', 'monto_total', 20, DINERO], ['Aviso al (%)', 'umbral_alerta', 14], ['Origen', 'origen', 12]], p);
        const [l] = await connection.query(
            `SELECT CONCAT(p.anio, '-', LPAD(p.mes, 2, '0')) AS periodo, c.nombre AS categoria, pc.monto_limite FROM presupuesto_categorias pc
               JOIN presupuestos p ON p.id_presupuesto = pc.id_presupuesto JOIN categorias c ON c.id_categoria = pc.id_categoria
              WHERE p.id_usuario = ? ORDER BY p.anio DESC, p.mes DESC, c.nombre`, [id]
        );
        hoja(libro, 'Límites por categoría', [['Mes', 'periodo', 14], ['Categoría', 'categoria', 26], ['Límite', 'monto_limite', 18, DINERO]], l);
    },
    async pagos(libro, id) {
        const [f] = await connection.query(
            `SELECT concepto, monto, fecha_pago, frecuencia, dias_aviso, estado FROM pagos_programados WHERE id_usuario = ? ORDER BY fecha_pago`, [id]
        );
        hoja(libro, 'Pagos programados', [['Concepto', 'concepto', 30], ['Monto', 'monto', 16, DINERO], ['Fecha', 'fecha_pago', 14], ['Repite', 'frecuencia', 12], ['Días de aviso', 'dias_aviso', 14], ['Estado', 'estado', 12]], f, 2);
    },
    async ahorro(libro, id) {
        const [m] = await connection.query('SELECT nombre, monto_objetivo, monto_actual, porcentaje_avance, fecha_limite, estado FROM vista_progreso_metas WHERE id_usuario = ?', [id]);
        hoja(libro, 'Metas de ahorro', [['Meta', 'nombre', 28], ['Objetivo', 'monto_objetivo', 16, DINERO], ['Ahorrado', 'monto_actual', 16, DINERO], ['Avance %', 'porcentaje_avance', 12], ['Fecha límite', 'fecha_limite', 14], ['Estado', 'estado', 12]], m);
        const [a] = await connection.query(
            `SELECT ap.fecha, mt.nombre AS meta, ap.monto, ap.nota FROM aportes_ahorro ap JOIN metas_ahorro mt ON mt.id_meta = ap.id_meta WHERE mt.id_usuario = ? ORDER BY ap.fecha DESC`, [id]
        );
        hoja(libro, 'Aportes a metas', [['Fecha', 'fecha', 14], ['Meta', 'meta', 28], ['Monto', 'monto', 16, DINERO], ['Nota', 'nota', 30]], a, 3);
    },
    async cuentas(libro, id) {
        const [f] = await connection.query('SELECT nombre, entidad, saldo FROM cuentas_ahorro WHERE id_usuario = ?', [id]);
        hoja(libro, 'Cuentas de ahorro', [['Cuenta', 'nombre', 28], ['Entidad', 'entidad', 24], ['Saldo', 'saldo', 18, DINERO]], f, 3);
    },
    async inversiones(libro, id) {
        const [f] = await connection.query('SELECT nombre, tipo, nivel_riesgo, monto_invertido, valor_actual, ganancia, rendimiento_pct, estado FROM vista_rendimiento_inversiones WHERE id_usuario = ?', [id]);
        hoja(libro, 'Inversiones', [['Inversión', 'nombre', 28], ['Tipo', 'tipo', 28], ['Riesgo', 'nivel_riesgo', 10], ['Invertido', 'monto_invertido', 16, DINERO], ['Valor actual', 'valor_actual', 16, DINERO], ['Ganancia', 'ganancia', 16, DINERO], ['Rendimiento %', 'rendimiento_pct', 14], ['Estado', 'estado', 12]], f);
        const [g] = await connection.query(
            `SELECT r.fecha, i.nombre AS inversion, r.monto, r.nota FROM rendimientos_inversion r JOIN inversiones i ON i.id_inversion = r.id_inversion WHERE i.id_usuario = ? ORDER BY r.fecha DESC`, [id]
        );
        hoja(libro, 'Ganancias de inversiones', [['Fecha', 'fecha', 14], ['Inversión', 'inversion', 28], ['Ganancia', 'monto', 16, DINERO], ['Nota', 'nota', 30]], g, 3);
    },
    async deudas(libro, id) {
        const [f] = await connection.query('SELECT acreedor, monto_total, total_pagado, saldo_pendiente, fecha_vencimiento, estado FROM vista_estado_deudas WHERE id_usuario = ?', [id]);
        hoja(libro, 'Deudas', [['Acreedor', 'acreedor', 28], ['Valor total', 'monto_total', 16, DINERO], ['Pagado', 'total_pagado', 16, DINERO], ['Saldo', 'saldo_pendiente', 16, DINERO], ['Vence', 'fecha_vencimiento', 14], ['Estado', 'estado', 12]], f);
        const [p] = await connection.query(
            `SELECT pd.fecha_pago, d.acreedor, pd.monto, pd.nota FROM pagos_deuda pd JOIN deudas d ON d.id_deuda = pd.id_deuda WHERE d.id_usuario = ? ORDER BY pd.fecha_pago DESC`, [id]
        );
        hoja(libro, 'Pagos de deudas', [['Fecha', 'fecha_pago', 14], ['Deuda', 'acreedor', 28], ['Monto', 'monto', 16, DINERO], ['Nota', 'nota', 30]], p, 3);
    },
    async retos(libro, id) {
        const [r] = await connection.query(
            `SELECT rf.titulo, ur.estado, ur.progreso, ur.fecha_inicio, ur.fecha_fin, rf.puntos FROM usuario_retos ur JOIN retos_financieros rf ON rf.id_reto = ur.id_reto WHERE ur.id_usuario = ? ORDER BY ur.fecha_inicio DESC`, [id]
        );
        hoja(libro, 'Retos', [['Reto', 'titulo', 34], ['Estado', 'estado', 14], ['Progreso %', 'progreso', 12], ['Inicio', 'fecha_inicio', 14], ['Fin', 'fecha_fin', 14], ['Puntos', 'puntos', 10]], r);
        const [l] = await connection.query(
            `SELECT l.nombre, l.descripcion, l.puntos, ul.obtenido_en FROM logros l LEFT JOIN usuario_logros ul ON ul.id_logro = l.id_logro AND ul.id_usuario = ? ORDER BY ul.obtenido_en IS NULL, l.id_logro`, [id]
        );
        hoja(libro, 'Logros', [['Logro', 'nombre', 30], ['Descripción', 'descripcion', 46], ['Puntos', 'puntos', 10], ['Obtenido', 'obtenido_en', 20]], l);
    },
    async educacion(libro, id) {
        const [f] = await connection.query(
            `SELECT c.titulo, c.tema, c.nivel, COALESCE(p.porcentaje, 0) AS porcentaje, COALESCE(p.completado, 0) AS completado FROM contenido_educativo c
               LEFT JOIN progreso_educativo p ON p.id_contenido = c.id_contenido AND p.id_usuario = ? WHERE c.publicado = 1 ORDER BY c.tema, c.id_contenido`, [id]
        );
        hoja(libro, 'Educación', [['Lección', 'titulo', 44], ['Tema', 'tema', 16], ['Nivel', 'nivel', 14], ['Avance %', 'porcentaje', 12], ['Completada', 'completado', 12]], f.map((x) => ({ ...x, completado: SI_NO(x.completado) })));
    },
    async recomendaciones(libro, id) {
        const [f] = await connection.query('SELECT titulo, tipo, prioridad, mensaje, generada_en FROM recomendaciones_ia WHERE id_usuario = ? ORDER BY generada_en DESC', [id]);
        hoja(libro, 'Recomendaciones IA', [['Recomendación', 'titulo', 40], ['Tipo', 'tipo', 14], ['Prioridad', 'prioridad', 12], ['Detalle', 'mensaje', 70], ['Fecha', 'generada_en', 20]], f);
    },
};

// El historial guarda una sola categoría de reporte: la de la sección si fue una, o "completo"
const TIPO_HISTORIAL = { ingresos: 'ingresos', gastos: 'gastos', balance: 'balance', presupuesto: 'presupuesto', pagos: 'pagos', ahorro: 'ahorro', cuentas: 'cuentas', inversiones: 'inversiones', deudas: 'deudas', retos: 'retos', educacion: 'educacion', recomendaciones: 'recomendaciones' };

// POST /exportaciones { secciones: [...], fecha_desde, fecha_hasta } -> Excel con las secciones elegidas
router.post('/', async (req, res) => {
    try {
        let secciones = Array.isArray(req.body.secciones) ? req.body.secciones.filter((s) => SECCIONES.includes(s)) : [];
        if (!secciones.length && req.body.tipo_reporte) secciones = req.body.tipo_reporte === 'completo' ? [...SECCIONES] : SECCIONES.filter((s) => s === req.body.tipo_reporte);
        if (rechazar(res, !secciones.length, 'Elige al menos una sección para el reporte')) return;
        const desde = esFecha(req.body.fecha_desde) ? req.body.fecha_desde : null;
        const hasta = esFecha(req.body.fecha_hasta) ? req.body.fecha_hasta : null;
        if (rechazar(res, desde && hasta && desde > hasta, 'La fecha inicial no puede ser posterior a la final')) return;
        const id = req.usuario.id_usuario;
        const rango = [desde ? 'AND m.fecha >= ?' : '', hasta ? 'AND m.fecha <= ?' : ''].join(' ');
        const params = [desde, hasta].filter(Boolean);

        const libro = new ExcelJS.Workbook();
        libro.creator = 'Ahorra y Prospera';
        for (const seccion of SECCIONES.filter((s) => secciones.includes(s))) await CONSTRUIR[seccion](libro, id, rango, params);

        const tipo = secciones.length === 1 ? TIPO_HISTORIAL[secciones[0]] : 'completo';
        await connection.query('INSERT INTO exportaciones (id_usuario, formato, tipo_reporte, fecha_desde, fecha_hasta) VALUES (?, ?, ?, ?, ?)', [id, 'excel', tipo, desde, hasta]);
        const buffer = await libro.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-${secciones.length === 1 ? secciones[0] : 'personalizado'}.xlsx"`);
        emitirEvento('reporte_generado', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, formato: 'excel', secciones });
        res.send(Buffer.from(buffer));
    } catch (error) {
        errorServidor(res, 'Exportando', error, 'No se pudo generar el reporte');
    }
});

// POST /exportaciones/pdf { secciones, fecha_desde, fecha_hasta } -> descarga el reporte en PDF
router.post('/pdf', async (req, res) => {
    try {
        const secciones = Array.isArray(req.body.secciones) ? req.body.secciones.filter((x) => SECCIONES.includes(x)) : [];
        if (rechazar(res, !secciones.length, 'Elige al menos una sección para el reporte')) return;
        const desde = esFecha(req.body.fecha_desde) ? req.body.fecha_desde : null;
        const hasta = esFecha(req.body.fecha_hasta) ? req.body.fecha_hasta : null;
        if (rechazar(res, desde && hasta && desde > hasta, 'La fecha inicial no puede ser posterior a la final')) return;
        const pdf = await construirPdf({ usuario: req.usuario, secciones, desde, hasta });
        const tipo = secciones.length === 1 ? TIPO_HISTORIAL[secciones[0]] : 'completo';
        await connection.query("INSERT INTO exportaciones (id_usuario, formato, tipo_reporte, fecha_desde, fecha_hasta) VALUES (?, 'pdf', ?, ?, ?)", [req.usuario.id_usuario, tipo, desde, hasta]);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-${secciones.length === 1 ? secciones[0] : 'personalizado'}.pdf"`);
        emitirEvento('reporte_generado', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, formato: 'pdf', secciones });
        res.send(pdf);
    } catch (error) {
        errorServidor(res, 'Generando PDF', error, 'No se pudo generar el PDF');
    }
});

// GET /exportaciones -> historial
router.get('/', async (req, res) => {
    try {
        const [lista] = await connection.query(
            'SELECT id_exportacion, formato, tipo_reporte, fecha_desde, fecha_hasta, creada_en FROM exportaciones WHERE id_usuario = ? ORDER BY creada_en DESC LIMIT 15', [req.usuario.id_usuario]
        );
        res.json(lista);
    } catch (error) {
        errorServidor(res, 'Listando exportaciones', error);
    }
});

export default router;
