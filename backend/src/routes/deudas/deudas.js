import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { otorgarLogro } from '../../servicios/logros.js';
import { emitirEvento } from '../../servicios/n8n.js';

const router = Router();
router.use(requiereSesion);

const dinero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

// GET /deudas -> deudas del usuario con el total pagado
router.get('/', async (req, res) => {
    try {
        const [deudas] = await connection.query(
            `SELECT d.id_deuda, d.acreedor, d.descripcion, d.monto_total, d.saldo_pendiente, d.tasa_interes_anual,
                    d.cuota_mensual, DATE_FORMAT(d.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
                    DATE_FORMAT(d.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento, d.estado,
                    COALESCE((SELECT SUM(p.monto) FROM pagos_deuda p WHERE p.id_deuda = d.id_deuda), 0) AS total_pagado,
                    (d.estado <> 'pagada' AND d.fecha_vencimiento < CURDATE()) AS vencida
               FROM deudas d WHERE d.id_usuario = ? ORDER BY d.estado = 'pagada', d.fecha_vencimiento`,
            [req.usuario.id_usuario]
        );
        res.json(deudas);
    } catch (error) {
        console.error('Error listando deudas:', error.message);
        res.status(500).json({ message: 'No se pudieron cargar tus deudas' });
    }
});

// POST /deudas
router.post('/', async (req, res) => {
    try {
        const acreedor = String(req.body.acreedor || '').trim();
        const montoTotal = dinero(req.body.monto_total);
        const tasa = req.body.tasa_interes_anual === '' || req.body.tasa_interes_anual == null ? null : dinero(req.body.tasa_interes_anual);
        const cuota = req.body.cuota_mensual === '' || req.body.cuota_mensual == null ? null : dinero(req.body.cuota_mensual);
        const inicio = req.body.fecha_inicio || new Date().toISOString().slice(0, 10);
        const vencimiento = req.body.fecha_vencimiento;

        if (!acreedor || acreedor.length > 100) return res.status(400).json({ message: 'Escribe a quién le debes' });
        if (!(montoTotal > 0)) return res.status(400).json({ message: 'El valor de la deuda debe ser mayor a cero' });
        if (tasa !== null && !(tasa >= 0 && tasa <= 999)) return res.status(400).json({ message: 'La tasa de interés no es válida' });
        if (cuota !== null && !(cuota >= 0)) return res.status(400).json({ message: 'La cuota mensual no es válida' });
        if (!esFecha(inicio) || !esFecha(vencimiento)) return res.status(400).json({ message: 'Indica la fecha de vencimiento' });
        if (vencimiento < inicio) return res.status(400).json({ message: 'El vencimiento no puede ser anterior al inicio' });

        const [resultado] = await connection.query(
            `INSERT INTO deudas (id_usuario, id_moneda, acreedor, descripcion, monto_total, saldo_pendiente,
                                 tasa_interes_anual, cuota_mensual, fecha_inicio, fecha_vencimiento, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'al_dia')`,
            [req.usuario.id_usuario, req.usuario.id_moneda, acreedor, String(req.body.descripcion || '').slice(0, 255) || null,
                montoTotal, montoTotal, tasa, cuota, inicio, vencimiento]
        );
        res.status(201).json({ id_deuda: resultado.insertId, message: 'Deuda registrada' });
    } catch (error) {
        console.error('Error creando deuda:', error.message);
        res.status(500).json({ message: 'No se pudo registrar la deuda' });
    }
});

// POST /deudas/:id/pagos -> registra un pago (un trigger actualiza el saldo y el estado)
router.post('/:id/pagos', async (req, res) => {
    try {
        const monto = dinero(req.body.monto);
        const fecha = req.body.fecha_pago || new Date().toISOString().slice(0, 10);
        if (!(monto > 0)) return res.status(400).json({ message: 'El pago debe ser mayor a cero' });
        if (!esFecha(fecha)) return res.status(400).json({ message: 'Fecha de pago no válida' });

        const [deuda] = await connection.query(
            'SELECT saldo_pendiente, estado FROM deudas WHERE id_deuda = ? AND id_usuario = ?',
            [req.params.id, req.usuario.id_usuario]
        );
        if (!deuda.length) return res.status(404).json({ message: 'Deuda no encontrada' });
        if (deuda[0].estado === 'pagada') return res.status(400).json({ message: 'Esa deuda ya está pagada' });
        if (monto > Number(deuda[0].saldo_pendiente)) {
            return res.status(400).json({ message: 'El pago no puede ser mayor al saldo pendiente' });
        }

        await connection.query(
            'INSERT INTO pagos_deuda (id_deuda, monto, fecha_pago, nota) VALUES (?, ?, ?, ?)',
            [req.params.id, monto, fecha, String(req.body.nota || '').slice(0, 255) || null]
        );
        const [despues] = await connection.query('SELECT estado FROM deudas WHERE id_deuda = ?', [req.params.id]);
        const liquidada = despues[0]?.estado === 'pagada';
        if (liquidada) {
            await otorgarLogro(req.usuario.id_usuario, 'Libre de deudas');
            emitirEvento('deuda_pagada', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, id_deuda: Number(req.params.id) });
        }
        res.status(201).json({ message: liquidada ? '¡Deuda pagada por completo! 🎉' : 'Pago registrado' });
    } catch (error) {
        console.error('Error registrando pago:', error.message);
        res.status(500).json({ message: 'No se pudo registrar el pago' });
    }
});

// DELETE /deudas/:id
router.delete('/:id', async (req, res) => {
    try {
        const [resultado] = await connection.query(
            'DELETE FROM deudas WHERE id_deuda = ? AND id_usuario = ?',
            [req.params.id, req.usuario.id_usuario]
        );
        if (!resultado.affectedRows) return res.status(404).json({ message: 'Deuda no encontrada' });
        res.json({ message: 'Deuda eliminada' });
    } catch (error) {
        console.error('Error eliminando deuda:', error.message);
        res.status(500).json({ message: 'No se pudo eliminar la deuda' });
    }
});

export default router;
