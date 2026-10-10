import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { evaluarAlertasFinancieras, notificarPresupuestoGenerado } from '../../servicios/alertas.js';
import { heredarPresupuesto } from '../../servicios/presupuestoMensual.js';
import { errorServidor, numero, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

function periodo(req, res) {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    if (!(anio >= 2000 && anio <= 2100 && mes >= 1 && mes <= 12)) {
        res.status(400).json({ message: 'Periodo no válido' });
        return null;
    }
    return { anio, mes };
}

async function leerPresupuesto(idUsuario, anio, mes) {
    const [pres] = await connection.query(
        'SELECT id_presupuesto, monto_total, umbral_alerta, generado_automaticamente FROM presupuestos WHERE id_usuario = ? AND anio = ? AND mes = ?',
        [idUsuario, anio, mes]
    );
    // Gasto del mes por categoría (con o sin límite) para poder comparar
    const [gastado] = await connection.query(
        `SELECT g.id_categoria, COALESCE(c.nombre, 'Sin categoría') AS categoria, COALESCE(c.color, '#9E9E9E') AS color, SUM(g.monto) AS gastado
           FROM gastos g LEFT JOIN categorias c ON c.id_categoria = g.id_categoria
          WHERE g.id_usuario = ? AND YEAR(g.fecha) = ? AND MONTH(g.fecha) = ? GROUP BY g.id_categoria, c.nombre, c.color`,
        [idUsuario, anio, mes]
    );
    const totalGastado = gastado.reduce((t, g) => t + g.gastado, 0);
    if (!pres.length) return { existe: false, anio, mes, totalGastado, categorias: gastado.map((g) => ({ ...g, monto_limite: null })) };

    const [limites] = await connection.query(
        `SELECT pc.id_categoria, c.nombre AS categoria, c.color, pc.monto_limite FROM presupuesto_categorias pc
           JOIN categorias c ON c.id_categoria = pc.id_categoria WHERE pc.id_presupuesto = ?`,
        [pres[0].id_presupuesto]
    );
    const mapa = new Map(gastado.map((g) => [g.id_categoria, g.gastado]));
    const categorias = limites.map((l) => ({ ...l, gastado: mapa.get(l.id_categoria) || 0 }));
    for (const g of gastado) {
        if (!limites.some((l) => l.id_categoria === g.id_categoria)) categorias.push({ ...g, monto_limite: null });
    }
    const asignado = limites.reduce((t, l) => t + l.monto_limite, 0);
    return {
        existe: true, anio, mes, ...pres[0], asignado, porAsignar: pres[0].monto_total - asignado, generado_automaticamente: !!pres[0].generado_automaticamente,
        totalGastado, porcentaje: pres[0].monto_total ? Math.round((totalGastado / pres[0].monto_total) * 100) : 0, categorias,
    };
}

// GET /presupuestos/historial -> todos los presupuestos guardados, mes a mes
router.get('/historial', async (req, res) => {
    try {
        const [meses] = await connection.query(
            `SELECT p.anio, p.mes, p.monto_total, p.umbral_alerta, p.generado_automaticamente AS ia,
                    COALESCE(SUM(pc.monto_limite), 0) AS asignado, COUNT(pc.id_categoria) AS categorias
               FROM presupuestos p LEFT JOIN presupuesto_categorias pc ON pc.id_presupuesto = p.id_presupuesto
              WHERE p.id_usuario = ? GROUP BY p.id_presupuesto ORDER BY p.anio DESC, p.mes DESC LIMIT 36`,
            [req.usuario.id_usuario]
        );
        const total = meses.reduce((t, m) => t + m.monto_total, 0);
        res.json({
            meses: meses.map((m) => ({ ...m, ia: !!m.ia, porAsignar: m.monto_total - m.asignado })),
            resumen: { cantidad: meses.length, promedio: meses.length ? Math.round(total / meses.length) : 0, ultimo: meses[0]?.monto_total ?? 0 },
        });
    } catch (error) {
        errorServidor(res, 'Leyendo historial de presupuestos', error, 'No se pudo cargar tu presupuesto general');
    }
});

// GET /presupuestos/:anio/:mes
router.get('/:anio/:mes', async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const ahora = new Date();
        const heredadoDe = (p.anio === ahora.getFullYear() && p.mes === ahora.getMonth() + 1)
            ? await heredarPresupuesto(req.usuario.id_usuario, p.anio, p.mes) : null;
        res.json({ ...(await leerPresupuesto(req.usuario.id_usuario, p.anio, p.mes)), heredadoDe });
    } catch (error) {
        errorServidor(res, 'Leyendo presupuesto', error, 'No se pudo cargar el presupuesto');
    }
});

// PUT /presupuestos/:anio/:mes  { monto_total, umbral_alerta, limites: [{id_categoria, monto_limite}] }
router.put('/:anio/:mes', async (req, res) => {
    const conexion = await connection.getConnection();
    try {
        const p = periodo(req, res);
        if (!p) return;
        const total = numero(req.body.monto_total);
        const umbral = numero(req.body.umbral_alerta) ?? 80;
        const limites = Array.isArray(req.body.limites) ? req.body.limites.slice(0, 40) : [];
        if (rechazar(res, !(total > 0), 'El presupuesto total debe ser mayor a cero')) return;
        if (rechazar(res, !(umbral >= 1 && umbral <= 100), 'La alerta debe estar entre 1% y 100%')) return;
        const asignado = limites.reduce((t, l) => t + (numero(l.monto_limite) > 0 ? numero(l.monto_limite) : 0), 0);
        if (rechazar(res, asignado > total, `Los límites por categoría suman ${Math.round(asignado).toLocaleString('es-CO')} y superan el presupuesto total. Aumenta el total o reduce algún límite.`)) return;

        await conexion.beginTransaction();
        await conexion.query(
            `INSERT INTO presupuestos (id_usuario, anio, mes, monto_total, umbral_alerta, generado_automaticamente)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE monto_total = VALUES(monto_total), umbral_alerta = VALUES(umbral_alerta),
                                     generado_automaticamente = VALUES(generado_automaticamente)`,
            [req.usuario.id_usuario, p.anio, p.mes, total, umbral, req.body.generado ? 1 : 0]
        );
        const [[{ id_presupuesto: id }]] = await conexion.query(
            'SELECT id_presupuesto FROM presupuestos WHERE id_usuario = ? AND anio = ? AND mes = ?', [req.usuario.id_usuario, p.anio, p.mes]
        );
        await conexion.query('DELETE FROM presupuesto_categorias WHERE id_presupuesto = ?', [id]);
        for (const l of limites) {
            const monto = numero(l.monto_limite);
            if (!(monto > 0)) continue;
            const [cat] = await conexion.query(
                "SELECT 1 FROM categorias WHERE id_categoria = ? AND tipo = 'gasto' AND (id_usuario IS NULL OR id_usuario = ?)", [l.id_categoria, req.usuario.id_usuario]
            );
            if (cat.length) await conexion.query('INSERT INTO presupuesto_categorias (id_presupuesto, id_categoria, monto_limite) VALUES (?, ?, ?)', [id, l.id_categoria, monto]);
        }
        await conexion.commit();
        if (req.body.generado) {
            const [nombres] = await connection.query('SELECT id_categoria, nombre FROM categorias WHERE id_categoria IN (?)', [limites.map((l) => l.id_categoria).concat(0)]);
            const filas = limites.filter((l) => numero(l.monto_limite) > 0).map((l) => ({ nombre: nombres.find((n) => n.id_categoria === Number(l.id_categoria))?.nombre || 'Categoría', valor: numero(l.monto_limite) }));
            await notificarPresupuestoGenerado(req.usuario.id_usuario, { anio: p.anio, mes: p.mes, total, umbral, filas });
        }
        await evaluarAlertasFinancieras(req.usuario.id_usuario);
        res.json({ message: req.body.generado ? 'Presupuesto guardado. Te enviamos el resumen por correo y a la campanita.' : 'Presupuesto guardado' });
    } catch (error) {
        await conexion.rollback().catch(() => {});
        errorServidor(res, 'Guardando presupuesto', error, 'No se pudo guardar el presupuesto');
    } finally {
        conexion.release();
    }
});

// GET /presupuestos/:anio/:mes/sugerido -> presupuesto inteligente según tus últimos 3 meses
router.get('/:anio/:mes/sugerido', async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const [promedios] = await connection.query(
            `SELECT g.id_categoria, c.nombre AS categoria, ROUND(SUM(g.monto) / 3) AS promedio
               FROM gastos g JOIN categorias c ON c.id_categoria = g.id_categoria
              WHERE g.id_usuario = ? AND g.fecha >= DATE_SUB(DATE(CONCAT(?, '-', ?, '-01')), INTERVAL 3 MONTH)
                AND g.fecha < DATE(CONCAT(?, '-', ?, '-01'))
              GROUP BY g.id_categoria, c.nombre ORDER BY promedio DESC`,
            [req.usuario.id_usuario, p.anio, p.mes, p.anio, p.mes]
        );
        const [[ing]] = await connection.query(
            `SELECT ROUND(COALESCE(SUM(monto), 0) / 3) AS promedio FROM ingresos
              WHERE id_usuario = ? AND fecha >= DATE_SUB(DATE(CONCAT(?, '-', ?, '-01')), INTERVAL 3 MONTH) AND fecha < DATE(CONCAT(?, '-', ?, '-01'))`,
            [req.usuario.id_usuario, p.anio, p.mes, p.anio, p.mes]
        );
        // Cada categoría con un 5% de margen; se reserva el 10% de los ingresos para ahorrar
        const limites = promedios.map((x) => ({ id_categoria: x.id_categoria, categoria: x.categoria, monto_limite: Math.round(x.promedio * 1.05) }));
        const total = limites.reduce((t, l) => t + l.monto_limite, 0);
        res.json({ ingresoPromedio: ing.promedio, ahorroSugerido: Math.round(ing.promedio * 0.1), monto_total: total, limites, hayHistorial: limites.length > 0 });
    } catch (error) {
        errorServidor(res, 'Sugiriendo presupuesto', error, 'No se pudo calcular el presupuesto sugerido');
    }
});

// Reparto de referencia (% del gasto total) para las categorías del sistema; las propias reciben una parte pequeña
const PESOS = { Vivienda: 28, 'Alimentación': 18, Transporte: 10, 'Servicios públicos': 8, Salud: 6, 'Educación': 6, Entretenimiento: 8, Ropa: 4, 'Tecnología': 4, 'Compras impulsivas': 3, 'Otros gastos': 5 };

// GET /presupuestos/:anio/:mes/sugerido-ia -> presupuesto sugerido según tus ingresos mensuales
router.get('/:anio/:mes/sugerido-ia', async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const id = req.usuario.id_usuario;
        const [[mesActual]] = await connection.query(
            'SELECT COALESCE(SUM(monto), 0) AS total FROM ingresos WHERE id_usuario = ? AND YEAR(fecha) = ? AND MONTH(fecha) = ?', [id, p.anio, p.mes]
        );
        let ingreso = mesActual.total;
        let fuente = 'mes';
        if (!(ingreso > 0)) {
            const [[prom]] = await connection.query(
                `SELECT COALESCE(SUM(monto), 0) / 3 AS total FROM ingresos WHERE id_usuario = ?
                  AND fecha >= DATE_SUB(DATE(CONCAT(?, '-', ?, '-01')), INTERVAL 3 MONTH) AND fecha < DATE(CONCAT(?, '-', ?, '-01'))`,
                [id, p.anio, p.mes, p.anio, p.mes]
            );
            ingreso = Math.round(prom.total);
            fuente = 'promedio';
        }
        if (!(ingreso > 0)) {
            return res.json({ hayIngresos: false, message: 'Aún no tienes ingresos registrados. Regístralos en Ingresos o llena el presupuesto manualmente.' });
        }

        const [[usuario]] = await connection.query('SELECT porcentaje_ahorro_meta FROM usuarios WHERE id_usuario = ?', [id]);
        const ahorroPct = Math.min(50, Math.max(10, Number(usuario.porcentaje_ahorro_meta) || 10));
        const total = Math.round((ingreso * (100 - ahorroPct)) / 100 / 1000) * 1000;

        const [cats] = await connection.query(
            "SELECT id_categoria, nombre, (id_usuario IS NOT NULL) AS propia FROM categorias WHERE tipo = 'gasto' AND activa = 1 AND (id_usuario IS NULL OR id_usuario = ?)", [id]
        );
        const [hist] = await connection.query(
            `SELECT id_categoria, SUM(monto) AS total FROM gastos WHERE id_usuario = ? AND id_categoria IS NOT NULL
              AND fecha >= DATE_SUB(DATE(CONCAT(?, '-', ?, '-01')), INTERVAL 3 MONTH) AND fecha < DATE(CONCAT(?, '-', ?, '-01')) GROUP BY id_categoria`,
            [id, p.anio, p.mes, p.anio, p.mes]
        );
        const totalHist = hist.reduce((t, h) => t + h.total, 0);
        const baseDefecto = cats.map((c) => (c.propia ? 3 : PESOS[c.nombre] ?? 3));
        const sumaDefecto = baseDefecto.reduce((t, w) => t + w, 0);
        // Con historial: mitad según lo que ya gastas, mitad según el reparto recomendado
        const pesos = cats.map((c, i) => {
            const porDefecto = baseDefecto[i] / sumaDefecto;
            const h = totalHist ? (hist.find((x) => x.id_categoria === c.id_categoria)?.total || 0) / totalHist : 0;
            return totalHist ? 0.5 * porDefecto + 0.5 * h : porDefecto;
        });
        const sumaPesos = pesos.reduce((t, w) => t + w, 0);
        let limites = cats.map((c, i) => ({ id_categoria: c.id_categoria, categoria: c.nombre, monto_limite: Math.round((total * pesos[i]) / sumaPesos / 1000) * 1000 }))
            .filter((l) => l.monto_limite > 0);
        // El redondeo no debe pasar el total
        let exceso = limites.reduce((t, l) => t + l.monto_limite, 0) - total;
        for (let i = 0; exceso > 0 && i < limites.length; i = (i + 1) % limites.length) {
            const rebaja = Math.min(1000, exceso);
            if (limites[i].monto_limite > rebaja) { limites[i].monto_limite -= rebaja; exceso -= rebaja; }
        }
        res.json({
            hayIngresos: true, ingresoBase: ingreso, fuenteIngreso: fuente, ahorroPct, monto_total: total, limites,
            explicacion: `Con ingresos de ${Math.round(ingreso).toLocaleString('es-CO')}${fuente === 'promedio' ? ' (promedio de tus últimos 3 meses)' : ' este mes'}, separé el ${ahorroPct}% para ahorrar y repartí el resto entre tus categorías según una distribución sana${totalHist ? ' ajustada a lo que realmente gastas' : ''}.`,
        });
    } catch (error) {
        errorServidor(res, 'Sugiriendo presupuesto con IA', error, 'No se pudo calcular la sugerencia');
    }
});

export default router;
