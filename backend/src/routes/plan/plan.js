import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { generarPlan } from '../../servicios/planFinanciero.js';
import { construirExcel } from '../../servicios/planExcel.js';
import { resumenExperto } from '../../servicios/asesorIA.js';
import { emitirEvento } from '../../servicios/n8n.js';

const router = Router();
router.use(requiereSesion);

const MAX_FILAS = 60;
const recortar = (lista) => (Array.isArray(lista) ? lista.slice(0, MAX_FILAS) : []);

function entradaDesdeCuerpo(cuerpo, usuario) {
    return {
        ingresos: recortar(cuerpo.ingresos),
        gastos: recortar(cuerpo.gastos),
        deudas: recortar(cuerpo.deudas),
        metas: recortar(cuerpo.metas),
        ahorroActual: cuerpo.ahorroActual,
        perfil: cuerpo.perfil || {},
        objetivo: cuerpo.objetivo || {},
        moneda: usuario.moneda,
    };
}

// GET /plan/datos -> datos guardados en la base de datos para rellenar el formulario
router.get('/datos', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        const [ingresos] = await connection.query(
            `SELECT COALESCE(c.nombre, 'Ingreso') AS fuente, SUM(i.monto) AS monto
               FROM ingresos i LEFT JOIN categorias c ON c.id_categoria = i.id_categoria
              WHERE i.id_usuario = ? AND i.fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01') GROUP BY fuente`, [id]);
        const [gastos] = await connection.query(
            `SELECT COALESCE(c.nombre, 'Gasto') AS categoria, SUM(g.monto) AS monto, MAX(g.es_necesidad) AS necesidad
               FROM gastos g LEFT JOIN categorias c ON c.id_categoria = g.id_categoria
              WHERE g.id_usuario = ? AND g.fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01') GROUP BY categoria`, [id]);
        const [deudas] = await connection.query(
            `SELECT acreedor, saldo_pendiente AS saldo, tasa_interes_anual AS tasa, cuota_mensual AS cuota
               FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'`, [id]);
        const [metas] = await connection.query(
            `SELECT nombre, monto_objetivo AS objetivo, monto_actual AS actual,
                    GREATEST(1, COALESCE(TIMESTAMPDIFF(MONTH, CURDATE(), fecha_limite), 12)) AS meses
               FROM metas_ahorro WHERE id_usuario = ? AND estado = 'activa'`, [id]);
        const [[ah]] = await connection.query(
            `SELECT (SELECT COALESCE(SUM(saldo), 0) FROM cuentas_ahorro WHERE id_usuario = ?) +
                    (SELECT COALESCE(SUM(monto_actual), 0) FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada') AS total`, [id, id]);
        res.json({
            ahorroActual: ah.total,
            ingresos: ingresos.map((x) => ({ fuente: x.fuente, monto: Number(x.monto) })),
            gastos: gastos.map((x) => ({ categoria: x.categoria, monto: Number(x.monto), tipo: x.necesidad ? 'necesidad' : 'deseo' })),
            deudas: deudas.map((x) => ({ acreedor: x.acreedor, saldo: Number(x.saldo ?? 0), tasa: Number(x.tasa ?? 0), cuota: Number(x.cuota ?? 0) })),
            metas: metas.map((x) => ({ nombre: x.nombre, objetivo: Number(x.objetivo), actual: Number(x.actual ?? 0), meses: Number(x.meses) })),
        });
    } catch (error) {
        console.error('Error leyendo datos del plan:', error.message);
        res.status(500).json({ message: 'No se pudieron leer tus datos' });
    }
});

// POST /plan/generar -> calcula el plan y guarda las recomendaciones
router.post('/generar', async (req, res) => {
    try {
        const entrada = entradaDesdeCuerpo(req.body, req.usuario);
        if (!entrada.ingresos.some((i) => Number(i.monto) > 0)) {
            return res.status(400).json({ message: 'Agrega al menos un ingreso mensual para generar tu plan' });
        }
        const plan = generarPlan(entrada);
        plan.resumenIA = await resumenExperto(plan, req.usuario.nombres);

        // Las recomendaciones quedan guardadas para la sección de IA financiera
        await connection.query('DELETE FROM recomendaciones_ia WHERE id_usuario = ? AND leida = 0', [req.usuario.id_usuario]);
        for (const r of plan.recomendaciones) {
            await connection.query(
                'INSERT INTO recomendaciones_ia (id_usuario, tipo, titulo, mensaje, prioridad) VALUES (?, ?, ?, ?, ?)',
                [req.usuario.id_usuario, r.tipo, r.titulo.slice(0, 120), r.mensaje, r.prioridad]
            );
        }
        emitirEvento('plan_generado', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, objetivo: plan.objetivo?.etiqueta, puntaje: plan.diagnostico.puntaje, nivel: plan.diagnostico.nivel, flujoLibre: plan.diagnostico.flujoLibre });
        res.json(plan);
    } catch (error) {
        console.error('Error generando el plan:', error.message);
        res.status(500).json({ message: 'No se pudo generar el plan' });
    }
});

// POST /plan/excel -> mismo plan, descargado como libro de Excel con fórmulas
router.post('/excel', async (req, res) => {
    try {
        const entrada = entradaDesdeCuerpo(req.body, req.usuario);
        if (!entrada.ingresos.some((i) => Number(i.monto) > 0)) {
            return res.status(400).json({ message: 'Agrega al menos un ingreso mensual para generar tu plan' });
        }
        const plan = generarPlan(entrada);
        const buffer = await construirExcel(plan, req.usuario);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="plan-financiero-ahorra-y-prospera.xlsx"');
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Error generando el Excel:', error.message);
        res.status(500).json({ message: 'No se pudo generar el Excel' });
    }
});

export default router;
