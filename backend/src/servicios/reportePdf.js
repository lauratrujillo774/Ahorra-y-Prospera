import PDFDocument from 'pdfkit';
import { connection } from '../config/mysql/dbmysql.js';

const VERDE = '#15803d';
const VERDE_OSCURO = '#0b3d2e';
const VERDE_CLARO = '#f0fdf4';
const GRIS = '#4b6358';
const LINEA = '#d7e7dc';

// Cada sección devuelve { titulo, columnas: [{ t, ancho (peso), alinear, tipo }], filas: [[...]] , total? }
const SECCIONES = {
    async ingresos(id, _u, rango, params) {
        const [f] = await connection.query(`SELECT m.fecha, COALESCE(c.nombre, 'Sin categoría') AS categoria, m.descripcion, m.monto FROM ingresos m LEFT JOIN categorias c ON c.id_categoria = m.id_categoria WHERE m.id_usuario = ? ${rango} ORDER BY m.fecha DESC, m.id_ingreso DESC`, [id, ...params]);
        return { titulo: 'Ingresos', columnas: [{ t: 'Fecha', w: 1.2 }, { t: 'Categoría', w: 2 }, { t: 'Descripción', w: 3 }, { t: 'Monto', w: 1.6, alinear: 'right', tipo: 'dinero' }], filas: f.map((x) => [x.fecha, x.categoria, x.descripcion || '', x.monto]), totalCol: 3 };
    },
    async gastos(id, _u, rango, params) {
        const [f] = await connection.query(`SELECT m.fecha, COALESCE(c.nombre, 'Sin categoría') AS categoria, m.descripcion, m.monto FROM gastos m LEFT JOIN categorias c ON c.id_categoria = m.id_categoria WHERE m.id_usuario = ? ${rango} ORDER BY m.fecha DESC, m.id_gasto DESC`, [id, ...params]);
        return { titulo: 'Gastos', columnas: [{ t: 'Fecha', w: 1.2 }, { t: 'Categoría', w: 2 }, { t: 'Descripción', w: 3 }, { t: 'Monto', w: 1.6, alinear: 'right', tipo: 'dinero' }], filas: f.map((x) => [x.fecha, x.categoria, x.descripcion || '', x.monto]), totalCol: 3 };
    },
    async balance(id) {
        const [f] = await connection.query("SELECT CONCAT(anio, '-', LPAD(mes, 2, '0')) AS periodo, ingresos, gastos FROM vista_resumen_mensual WHERE id_usuario = ? ORDER BY anio DESC, mes DESC", [id]);
        return { titulo: 'Balance mensual', columnas: [{ t: 'Mes', w: 1.5 }, { t: 'Ingresos', w: 2, alinear: 'right', tipo: 'dinero' }, { t: 'Gastos', w: 2, alinear: 'right', tipo: 'dinero' }, { t: 'Balance', w: 2, alinear: 'right', tipo: 'dinero' }], filas: f.map((x) => [x.periodo, x.ingresos, x.gastos, x.ingresos - x.gastos]) };
    },
    async presupuesto(id) {
        const [f] = await connection.query(`SELECT CONCAT(p.anio, '-', LPAD(p.mes, 2, '0')) AS periodo, c.nombre AS categoria, pc.monto_limite, p.monto_total FROM presupuestos p LEFT JOIN presupuesto_categorias pc ON pc.id_presupuesto = p.id_presupuesto LEFT JOIN categorias c ON c.id_categoria = pc.id_categoria WHERE p.id_usuario = ? ORDER BY p.anio DESC, p.mes DESC, c.nombre`, [id]);
        return { titulo: 'Presupuestos', columnas: [{ t: 'Mes', w: 1.4 }, { t: 'Categoría', w: 2.6 }, { t: 'Límite', w: 2, alinear: 'right', tipo: 'dinero' }, { t: 'Total del mes', w: 2, alinear: 'right', tipo: 'dinero' }], filas: f.map((x) => [x.periodo, x.categoria || '(total del mes)', x.monto_limite ?? '', x.monto_total]) };
    },
    async pagos(id) {
        const [f] = await connection.query('SELECT concepto, monto, fecha_pago, frecuencia, estado FROM pagos_programados WHERE id_usuario = ? ORDER BY fecha_pago', [id]);
        return { titulo: 'Pagos programados', columnas: [{ t: 'Concepto', w: 3 }, { t: 'Monto', w: 1.8, alinear: 'right', tipo: 'dinero' }, { t: 'Fecha', w: 1.4 }, { t: 'Repite', w: 1.2 }, { t: 'Estado', w: 1.2 }], filas: f.map((x) => [x.concepto, x.monto, x.fecha_pago, x.frecuencia, x.estado]) };
    },
    async ahorro(id) {
        const [f] = await connection.query('SELECT nombre, monto_objetivo, monto_actual, porcentaje_avance, estado FROM vista_progreso_metas WHERE id_usuario = ?', [id]);
        return { titulo: 'Metas de ahorro', columnas: [{ t: 'Meta', w: 3 }, { t: 'Objetivo', w: 2, alinear: 'right', tipo: 'dinero' }, { t: 'Ahorrado', w: 2, alinear: 'right', tipo: 'dinero' }, { t: 'Avance', w: 1, alinear: 'right', tipo: 'pct' }, { t: 'Estado', w: 1.3 }], filas: f.map((x) => [x.nombre, x.monto_objetivo, x.monto_actual, x.porcentaje_avance, x.estado]) };
    },
    async cuentas(id) {
        const [f] = await connection.query('SELECT nombre, entidad, saldo FROM cuentas_ahorro WHERE id_usuario = ?', [id]);
        return { titulo: 'Cuentas de ahorro', columnas: [{ t: 'Cuenta', w: 3 }, { t: 'Entidad', w: 2.5 }, { t: 'Saldo', w: 2, alinear: 'right', tipo: 'dinero' }], filas: f.map((x) => [x.nombre, x.entidad || '', x.saldo]), totalCol: 2 };
    },
    async inversiones(id) {
        const [f] = await connection.query('SELECT nombre, tipo, nivel_riesgo, monto_invertido, valor_actual, rendimiento_pct FROM vista_rendimiento_inversiones WHERE id_usuario = ?', [id]);
        return { titulo: 'Inversiones', columnas: [{ t: 'Inversión', w: 2.4 }, { t: 'Tipo', w: 2.4 }, { t: 'Riesgo', w: 1 }, { t: 'Invertido', w: 1.8, alinear: 'right', tipo: 'dinero' }, { t: 'Valor actual', w: 1.8, alinear: 'right', tipo: 'dinero' }, { t: 'Rend.', w: 1, alinear: 'right', tipo: 'pct' }], filas: f.map((x) => [x.nombre, x.tipo, x.nivel_riesgo, x.monto_invertido, x.valor_actual ?? x.monto_invertido, x.rendimiento_pct]) };
    },
    async deudas(id) {
        const [f] = await connection.query('SELECT acreedor, monto_total, total_pagado, saldo_pendiente, fecha_vencimiento, estado FROM vista_estado_deudas WHERE id_usuario = ?', [id]);
        return { titulo: 'Deudas', columnas: [{ t: 'Acreedor', w: 2.4 }, { t: 'Valor total', w: 1.8, alinear: 'right', tipo: 'dinero' }, { t: 'Pagado', w: 1.8, alinear: 'right', tipo: 'dinero' }, { t: 'Saldo', w: 1.8, alinear: 'right', tipo: 'dinero' }, { t: 'Vence', w: 1.4 }, { t: 'Estado', w: 1.1 }], filas: f.map((x) => [x.acreedor, x.monto_total, x.total_pagado, x.saldo_pendiente, x.fecha_vencimiento, x.estado]) };
    },
    async retos(id) {
        const [f] = await connection.query('SELECT rf.titulo, ur.estado, ur.progreso, rf.puntos FROM usuario_retos ur JOIN retos_financieros rf ON rf.id_reto = ur.id_reto WHERE ur.id_usuario = ? ORDER BY ur.fecha_inicio DESC', [id]);
        const [l] = await connection.query('SELECT l.nombre, l.puntos, ul.obtenido_en FROM usuario_logros ul JOIN logros l ON l.id_logro = ul.id_logro WHERE ul.id_usuario = ? ORDER BY ul.obtenido_en DESC', [id]);
        return [
            { titulo: 'Retos', columnas: [{ t: 'Reto', w: 4 }, { t: 'Estado', w: 1.6 }, { t: 'Progreso', w: 1.2, alinear: 'right', tipo: 'pct' }, { t: 'Puntos', w: 1, alinear: 'right' }], filas: f.map((x) => [x.titulo, x.estado, x.progreso, x.puntos]) },
            { titulo: 'Logros obtenidos', columnas: [{ t: 'Logro', w: 4 }, { t: 'Puntos', w: 1, alinear: 'right' }, { t: 'Fecha', w: 2 }], filas: l.map((x) => [x.nombre, x.puntos, String(x.obtenido_en).slice(0, 10)]) },
        ];
    },
    async educacion(id) {
        const [f] = await connection.query('SELECT c.titulo, c.tema, c.nivel, COALESCE(p.porcentaje, 0) AS porcentaje FROM contenido_educativo c LEFT JOIN progreso_educativo p ON p.id_contenido = c.id_contenido AND p.id_usuario = ? WHERE c.publicado = 1 ORDER BY c.tema, c.id_contenido', [id]);
        return { titulo: 'Educación financiera', columnas: [{ t: 'Lección', w: 4 }, { t: 'Tema', w: 1.6 }, { t: 'Nivel', w: 1.4 }, { t: 'Avance', w: 1, alinear: 'right', tipo: 'pct' }], filas: f.map((x) => [x.titulo, x.tema, x.nivel, x.porcentaje]) };
    },
    async recomendaciones(id) {
        const [f] = await connection.query('SELECT titulo, prioridad, mensaje FROM recomendaciones_ia WHERE id_usuario = ? ORDER BY generada_en DESC LIMIT 30', [id]);
        return { titulo: 'Recomendaciones de la IA', columnas: [{ t: 'Recomendación', w: 2.4 }, { t: 'Prioridad', w: 1, }, { t: 'Detalle', w: 5 }], filas: f.map((x) => [x.titulo, x.prioridad, x.mensaje]) };
    },
};

export const SECCIONES_PDF = Object.keys(SECCIONES);

export async function construirPdf({ usuario, secciones, desde, hasta }) {
    const id = usuario.id_usuario;
    const simbolo = usuario.simbolo_moneda || '$';
    const dinero = (n) => (n === '' || n === null || n === undefined ? '' : `${n < 0 ? '-' : ''}${simbolo}${Math.abs(Math.round(Number(n))).toLocaleString('es-CO')}`);
    const rango = [desde ? 'AND m.fecha >= ?' : '', hasta ? 'AND m.fecha <= ?' : ''].join(' ');
    const params = [desde, hasta].filter(Boolean);

    // Resumen general del mes
    const [[mes]] = await connection.query(
        `SELECT COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS ingresos,
                COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS gastos,
                COALESCE((SELECT SUM(monto_actual) FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada'), 0) AS ahorro,
                COALESCE((SELECT SUM(COALESCE(valor_actual, monto_invertido)) FROM inversiones WHERE id_usuario = ? AND estado = 'activa'), 0) AS inversiones,
                COALESCE((SELECT SUM(saldo_pendiente) FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'), 0) AS deudas`, [id, id, id, id, id]
    );

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: 'Reporte financiero - Ahorra y Prospera', Author: 'Ahorra y Prospera' } });
    const trozos = [];
    doc.on('data', (t) => trozos.push(t));
    const terminado = new Promise((ok) => doc.on('end', ok));

    const ancho = doc.page.width - 80;
    const salto = () => { if (doc.y > doc.page.height - 90) doc.addPage(); };

    // Encabezado
    doc.rect(0, 0, doc.page.width, 78).fill(VERDE_OSCURO);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Ahorra y Prospera', 40, 22);
    doc.font('Helvetica').fontSize(11).fillColor('#bbf7d0').text('Reporte financiero', 40, 48);
    doc.fillColor('#ffffff').fontSize(10).text(new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }), 40, 26, { width: ancho, align: 'right' });
    doc.fillColor('#ffffff').fontSize(10).text(`${usuario.nombres} ${usuario.apellidos}`, 40, 46, { width: ancho, align: 'right' });
    doc.fillColor('#000000');
    doc.y = 96;

    // Resumen del mes (tarjetas)
    doc.font('Helvetica-Bold').fontSize(13).fillColor(VERDE_OSCURO).text('Resumen del mes actual', 40, doc.y);
    doc.moveDown(0.4);
    const tarjetas = [['Ingresos', mes.ingresos], ['Gastos', mes.gastos], ['Balance', mes.ingresos - mes.gastos], ['Ahorro en metas', mes.ahorro], ['Inversiones', mes.inversiones], ['Deudas', mes.deudas]];
    const wt = (ancho - 20) / 3;
    const y0 = doc.y;
    tarjetas.forEach(([t, v], i) => {
        const x = 40 + (i % 3) * (wt + 10);
        const y = y0 + Math.floor(i / 3) * 52;
        doc.roundedRect(x, y, wt, 44, 6).fillAndStroke(VERDE_CLARO, LINEA);
        doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(t, x + 10, y + 8, { width: wt - 20 });
        doc.fillColor(v < 0 ? '#b91c1c' : VERDE_OSCURO).font('Helvetica-Bold').fontSize(13).text(dinero(v), x + 10, y + 22, { width: wt - 20 });
    });
    doc.y = y0 + 112;
    if (desde || hasta) {
        doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(9).text(`Periodo de ingresos y gastos: ${desde || 'inicio'} a ${hasta || 'hoy'}`, 40, doc.y);
        doc.moveDown(0.6);
    }

    // Tabla genérica
    function tabla(bloque) {
        const cols = bloque.columnas;
        const totalPeso = cols.reduce((t, c) => t + c.w, 0);
        const anchos = cols.map((c) => (c.w / totalPeso) * ancho);
        salto();
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(VERDE_OSCURO).text(bloque.titulo, 40, doc.y);
        doc.moveDown(0.4);

        const cabecera = () => {
            const y = doc.y;
            doc.rect(40, y, ancho, 20).fill(VERDE);
            let x = 40;
            cols.forEach((c, i) => { doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(c.t, x + 5, y + 6, { width: anchos[i] - 10, align: c.alinear || 'left', lineBreak: false }); x += anchos[i]; });
            doc.y = y + 20;
        };
        if (!bloque.filas.length) {
            doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(10).text('Sin registros.', 40, doc.y);
            return;
        }
        cabecera();
        const formato = (v, c) => (c.tipo === 'dinero' ? dinero(v) : c.tipo === 'pct' ? `${Math.round(Number(v) || 0)}%` : String(v ?? ''));
        bloque.filas.forEach((fila, n) => {
            const textos = fila.map((v, i) => formato(v, cols[i]));
            doc.font('Helvetica').fontSize(9);
            const alto = Math.max(18, ...textos.map((t, i) => doc.heightOfString(t, { width: anchos[i] - 10 }) + 8));
            if (doc.y + alto > doc.page.height - 60) { doc.addPage(); cabecera(); }
            const y = doc.y;
            if (n % 2) doc.rect(40, y, ancho, alto).fill('#f6fbf7');
            let x = 40;
            textos.forEach((t, i) => { doc.fillColor('#10231a').font('Helvetica').fontSize(9).text(t, x + 5, y + 4, { width: anchos[i] - 10, align: cols[i].alinear || 'left' }); x += anchos[i]; });
            doc.moveTo(40, y + alto).lineTo(40 + ancho, y + alto).strokeColor(LINEA).lineWidth(0.5).stroke();
            doc.y = y + alto;
        });
        if (bloque.totalCol !== undefined) {
            const total = bloque.filas.reduce((t, f) => t + (Number(f[bloque.totalCol]) || 0), 0);
            if (doc.y + 22 > doc.page.height - 60) doc.addPage();
            const y = doc.y;
            doc.rect(40, y, ancho, 22).fill('#dcfce7');
            doc.fillColor(VERDE_OSCURO).font('Helvetica-Bold').fontSize(10).text('TOTAL', 45, y + 6);
            doc.text(dinero(total), 40, y + 6, { width: ancho - 5, align: 'right' });
            doc.y = y + 22;
        }
    }

    for (const clave of SECCIONES_PDF.filter((s) => secciones.includes(s))) {
        const r = await SECCIONES[clave](id, usuario, rango, params);
        for (const bloque of Array.isArray(r) ? r : [r]) tabla(bloque);
    }

    // Pie con numeración de páginas
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(GRIS).font('Helvetica').fontSize(8)
            .text(`Ahorra y Prospera · Documento educativo, no constituye asesoría financiera · Página ${i + 1} de ${paginas.count}`, 40, doc.page.height - 30, { width: ancho, align: 'center', lineBreak: false });
    }
    doc.end();
    await terminado;
    return Buffer.concat(trozos);
}
