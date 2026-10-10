import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { estadoRecompensas } from '../../servicios/logros.js';
import { actualizarRetos } from '../../servicios/retos.js';
import { errorServidor } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// GET /resumen -> todo lo que necesita el panel principal
router.get('/', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        await actualizarRetos(id);
        const recompensas = await estadoRecompensas(id);
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = ahora.getMonth() + 1;

        const [resumenes] = await connection.query(
            'SELECT anio, mes, ingresos, gastos FROM vista_resumen_mensual WHERE id_usuario = ? ORDER BY anio DESC, mes DESC LIMIT 12', [id]
        );
        const buscar = (a, m) => resumenes.find((r) => r.anio === a && r.mes === m) || { ingresos: 0, gastos: 0 };
        const actual = buscar(anio, mes);
        const previoFecha = new Date(anio, mes - 2, 1);
        const previo = buscar(previoFecha.getFullYear(), previoFecha.getMonth() + 1);

        const serie = [];
        for (let i = 5; i >= 0; i--) {
            const f = new Date(anio, mes - 1 - i, 1);
            const r = buscar(f.getFullYear(), f.getMonth() + 1);
            serie.push({ etiqueta: MESES[f.getMonth()], ingresos: r.ingresos, gastos: r.gastos });
        }

        const [[balance]] = await connection.query('SELECT total_ingresos, total_gastos, balance FROM vista_balance_usuario WHERE id_usuario = ?', [id]);
        const [[ahorro]] = await connection.query("SELECT COALESCE(SUM(monto_actual), 0) AS total FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada'", [id]);
        const [[cuentas]] = await connection.query('SELECT COALESCE(SUM(saldo), 0) AS total FROM cuentas_ahorro WHERE id_usuario = ?', [id]);
        const [[inversion]] = await connection.query(
            "SELECT COALESCE(SUM(COALESCE(valor_actual, monto_invertido)), 0) AS valor, COALESCE(SUM(monto_invertido), 0) AS invertido FROM inversiones WHERE id_usuario = ? AND estado = 'activa'", [id]
        );
        const [[deudas]] = await connection.query("SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'", [id]);

        const [porCategoria] = await connection.query(
            `SELECT COALESCE(c.nombre, 'Sin categoría') AS categoria, COALESCE(c.color, '#9E9E9E') AS color, SUM(g.monto) AS total
               FROM gastos g LEFT JOIN categorias c ON c.id_categoria = g.id_categoria
              WHERE g.id_usuario = ? AND YEAR(g.fecha) = ? AND MONTH(g.fecha) = ? GROUP BY c.nombre, c.color ORDER BY total DESC LIMIT 6`,
            [id, anio, mes]
        );
        const [recientes] = await connection.query(
            'SELECT tipo, categoria, monto, descripcion, fecha FROM vista_movimientos WHERE id_usuario = ? ORDER BY fecha DESC, id_movimiento DESC LIMIT 6', [id]
        );
        const [[meta]] = await connection.query(
            `SELECT nombre, monto_objetivo, monto_actual, porcentaje_avance, monto_faltante FROM vista_progreso_metas
              WHERE id_usuario = ? AND estado = 'activa' ORDER BY porcentaje_avance DESC LIMIT 1`, [id]
        ).then(([r]) => [r.length ? r : [null]]);
        const [proximos] = await connection.query(
            `SELECT concepto, monto, fecha_pago, DATEDIFF(fecha_pago, CURDATE()) AS dias FROM pagos_programados
              WHERE id_usuario = ? AND estado = 'programado' ORDER BY fecha_pago LIMIT 3`, [id]
        );
        const [[pres]] = await connection.query(
            'SELECT monto_total, umbral_alerta FROM presupuestos WHERE id_usuario = ? AND anio = ? AND mes = ?', [id, anio, mes]
        ).then(([r]) => [r.length ? r : [null]]);
        const [[logros]] = await connection.query('SELECT COUNT(*) AS n FROM usuario_logros WHERE id_usuario = ?', [id]);
        const [[recs]] = await connection.query('SELECT COUNT(*) AS n FROM recomendaciones_ia WHERE id_usuario = ? AND leida = 0', [id]);
        const [[consejo]] = await connection.query(
            'SELECT titulo, mensaje FROM recomendaciones_ia WHERE id_usuario = ? AND leida = 0 ORDER BY FIELD(prioridad, \'alta\', \'media\', \'baja\'), generada_en DESC LIMIT 1', [id]
        ).then(([r]) => [r.length ? r : [null]]);

        const tasaAhorro = actual.ingresos > 0 ? Math.round(((actual.ingresos - actual.gastos) / actual.ingresos) * 100) : null;
        const variacion = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

        res.json({
            periodo: { anio, mes, etiqueta: `${MESES[mes - 1]} ${anio}` },
            mes: { ingresos: actual.ingresos, gastos: actual.gastos, balance: actual.ingresos - actual.gastos, tasaAhorro,
                varIngresos: variacion(actual.ingresos, previo.ingresos), varGastos: variacion(actual.gastos, previo.gastos) },
            balanceTotal: balance?.balance ?? 0,
            ahorroMetas: ahorro.total, saldoCuentas: cuentas.total,
            inversiones: { valor: inversion.valor, invertido: inversion.invertido },
            deudas: deudas.total,
            patrimonio: (balance?.balance ?? 0) + inversion.valor - deudas.total,
            serie, porCategoria, recientes, metaDestacada: meta, proximosPagos: proximos,
            presupuesto: pres ? { total: pres.monto_total, umbral: pres.umbral_alerta, usado: actual.gastos, porcentaje: Math.round((actual.gastos / pres.monto_total) * 100) } : null,
            logros: logros.n, recompensas, recomendacionesPendientes: recs.n, consejo,
        });
    } catch (error) {
        errorServidor(res, 'Armando el resumen', error, 'No se pudo cargar tu panel');
    }
});

export default router;
