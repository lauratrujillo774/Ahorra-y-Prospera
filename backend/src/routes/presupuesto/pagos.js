import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { otorgarLogro, revisarLogrosMovimientos } from '../../servicios/logros.js';
import { alertarPagosProximos, evaluarAlertasFinancieras } from '../../servicios/alertas.js';
import { emitirEvento } from '../../servicios/n8n.js';
import { errorServidor, esFecha, hoy, numero, rechazar, texto } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

const SALTOS = { semanal: '7 DAY', quincenal: '15 DAY', mensual: '1 MONTH', anual: '1 YEAR' };

// GET /pagos -> pagos programados (próximos primero)
router.get('/', async (req, res) => {
    try {
        const [pagos] = await connection.query(
            `SELECT p.id_pago_prog, p.concepto, p.monto, p.fecha_pago, p.frecuencia, p.dias_aviso, p.estado, p.id_deuda,
                    d.acreedor, DATEDIFF(p.fecha_pago, CURDATE()) AS dias_restantes
               FROM pagos_programados p LEFT JOIN deudas d ON d.id_deuda = p.id_deuda
              WHERE p.id_usuario = ? ORDER BY p.estado = 'programado' DESC, p.fecha_pago`,
            [req.usuario.id_usuario]
        );
        res.json(pagos);
    } catch (error) {
        errorServidor(res, 'Listando pagos programados', error, 'No se pudieron cargar tus pagos');
    }
});

// POST /pagos
router.post('/', async (req, res) => {
    try {
        const concepto = texto(req.body.concepto, 120);
        const monto = numero(req.body.monto);
        const fecha = req.body.fecha_pago;
        const frecuencia = req.body.frecuencia || 'unico';
        const aviso = numero(req.body.dias_aviso) ?? 3;
        const deuda = numero(req.body.id_deuda);
        if (rechazar(res, !concepto, 'Escribe el concepto del pago')) return;
        if (rechazar(res, !(monto > 0), 'El monto debe ser mayor a cero')) return;
        if (rechazar(res, !esFecha(fecha), 'Elige la fecha del pago')) return;
        if (rechazar(res, !['unico', 'semanal', 'quincenal', 'mensual', 'anual'].includes(frecuencia), 'Frecuencia no válida')) return;
        if (rechazar(res, !(aviso >= 0 && aviso <= 60), 'Los días de aviso deben estar entre 0 y 60')) return;
        if (deuda) {
            const [d] = await connection.query('SELECT 1 FROM deudas WHERE id_deuda = ? AND id_usuario = ?', [deuda, req.usuario.id_usuario]);
            if (rechazar(res, !d.length, 'Deuda no válida')) return;
        }
        const [r] = await connection.query(
            'INSERT INTO pagos_programados (id_usuario, id_deuda, concepto, monto, fecha_pago, frecuencia, dias_aviso) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.usuario.id_usuario, deuda || null, concepto, monto, fecha, frecuencia, aviso]
        );
        await alertarPagosProximos(req.usuario.id_usuario);
        res.status(201).json({ id_pago_prog: r.insertId, message: 'Pago programado' });
    } catch (error) {
        errorServidor(res, 'Programando pago', error, 'No se pudo programar el pago');
    }
});

// POST /pagos/:id/pagar -> marca como pagado; si es recurrente programa el siguiente; si es de una deuda, registra el abono
router.post('/:id/pagar', async (req, res) => {
    try {
        const [filas] = await connection.query('SELECT * FROM pagos_programados WHERE id_pago_prog = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        const p = filas[0];
        if (rechazar(res, !p, 'Pago no encontrado')) return;
        if (rechazar(res, p.estado !== 'programado', 'Ese pago ya no está pendiente')) return;

        if (p.id_deuda) {
            const [d] = await connection.query('SELECT saldo_pendiente FROM deudas WHERE id_deuda = ?', [p.id_deuda]);
            const abono = Math.min(p.monto, d[0]?.saldo_pendiente ?? 0);
            if (abono > 0) {
                await connection.query('INSERT INTO pagos_deuda (id_deuda, monto, fecha_pago, nota) VALUES (?, ?, ?, ?)', [p.id_deuda, abono, hoy(), `Pago programado: ${p.concepto}`]);
                const [despues] = await connection.query('SELECT estado FROM deudas WHERE id_deuda = ?', [p.id_deuda]);
                if (despues[0]?.estado === 'pagada') await otorgarLogro(req.usuario.id_usuario, 'Libre de deudas');
            }
        }
        // El pago pasa a Gastos (categoría elegida o "Otros gastos")
        let idCategoria = numero(req.body.id_categoria);
        if (idCategoria) {
            const [cat] = await connection.query("SELECT 1 FROM categorias WHERE id_categoria = ? AND tipo = 'gasto' AND (id_usuario IS NULL OR id_usuario = ?)", [idCategoria, req.usuario.id_usuario]);
            if (!cat.length) idCategoria = null;
        }
        if (!idCategoria) {
            const [otros] = await connection.query("SELECT id_categoria FROM categorias WHERE nombre = 'Otros gastos' AND tipo = 'gasto' AND id_usuario IS NULL LIMIT 1");
            idCategoria = otros[0]?.id_categoria ?? null;
        }
        await connection.query(
            'INSERT INTO gastos (id_usuario, id_categoria, id_moneda, monto, descripcion, fecha, es_necesidad) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [req.usuario.id_usuario, idCategoria, req.usuario.id_moneda, p.monto, `Pago: ${p.concepto}`.slice(0, 255), hoy()]
        );
        await revisarLogrosMovimientos(req.usuario.id_usuario);
        await evaluarAlertasFinancieras(req.usuario.id_usuario);

        if (SALTOS[p.frecuencia]) {
            await connection.query(`UPDATE pagos_programados SET fecha_pago = DATE_ADD(fecha_pago, INTERVAL ${SALTOS[p.frecuencia]}) WHERE id_pago_prog = ?`, [p.id_pago_prog]);
        } else {
            await connection.query("UPDATE pagos_programados SET estado = 'pagado' WHERE id_pago_prog = ?", [p.id_pago_prog]);
        }
        emitirEvento('pago_realizado', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, concepto: p.concepto, monto: p.monto, deuda: !!p.id_deuda });
        res.json({ message: SALTOS[p.frecuencia] ? 'Pago registrado en tus gastos; se programó el siguiente' : 'Pago registrado en tus gastos' });
    } catch (error) {
        errorServidor(res, 'Pagando', error, 'No se pudo registrar el pago');
    }
});

// POST /pagos/:id/omitir
router.post('/:id/omitir', async (req, res) => {
    try {
        const [r] = await connection.query("UPDATE pagos_programados SET estado = 'omitido' WHERE id_pago_prog = ? AND id_usuario = ? AND estado = 'programado'", [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Pago no encontrado')) return;
        res.json({ message: 'Pago omitido' });
    } catch (error) {
        errorServidor(res, 'Omitiendo pago', error);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [r] = await connection.query('DELETE FROM pagos_programados WHERE id_pago_prog = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Pago no encontrado')) return;
        res.json({ message: 'Pago eliminado' });
    } catch (error) {
        errorServidor(res, 'Eliminando pago', error);
    }
});

export default router;
