import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { otorgarLogro } from '../../servicios/logros.js';
import { emitirEvento } from '../../servicios/n8n.js';
import { errorServidor, esFecha, hoy, numero, rechazar, texto } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /metas -> metas con su avance
router.get('/', async (req, res) => {
    try {
        const [metas] = await connection.query(
            `SELECT m.id_meta, m.nombre, m.descripcion, m.monto_objetivo, m.monto_actual, m.fecha_inicio, m.fecha_limite,
                    m.estado, m.id_cuenta, c.nombre AS cuenta, v.porcentaje_avance, v.monto_faltante
               FROM metas_ahorro m
               JOIN vista_progreso_metas v ON v.id_meta = m.id_meta
               LEFT JOIN cuentas_ahorro c ON c.id_cuenta = m.id_cuenta
              WHERE m.id_usuario = ? ORDER BY m.estado = 'activa' DESC, m.fecha_limite IS NULL, m.fecha_limite`,
            [req.usuario.id_usuario]
        );
        res.json(metas);
    } catch (error) {
        errorServidor(res, 'Listando metas', error, 'No se pudieron cargar tus metas');
    }
});

// POST /metas
router.post('/', async (req, res) => {
    try {
        const nombre = texto(req.body.nombre, 100);
        const objetivo = numero(req.body.monto_objetivo);
        const limite = req.body.fecha_limite || null;
        const cuenta = numero(req.body.id_cuenta);
        if (rechazar(res, !nombre, 'Ponle un nombre a tu meta')) return;
        if (rechazar(res, !(objetivo > 0), 'El valor de la meta debe ser mayor a cero')) return;
        if (rechazar(res, limite && !esFecha(limite), 'La fecha límite no es válida')) return;
        if (cuenta) {
            const [c] = await connection.query('SELECT 1 FROM cuentas_ahorro WHERE id_cuenta = ? AND id_usuario = ?', [cuenta, req.usuario.id_usuario]);
            if (rechazar(res, !c.length, 'Cuenta no válida')) return;
        }
        const [r] = await connection.query(
            `INSERT INTO metas_ahorro (id_usuario, id_cuenta, nombre, descripcion, monto_objetivo, fecha_inicio, fecha_limite)
             VALUES (?, ?, ?, ?, ?, CURDATE(), ?)`,
            [req.usuario.id_usuario, cuenta || null, nombre, texto(req.body.descripcion), objetivo, limite]
        );
        res.status(201).json({ id_meta: r.insertId, message: 'Meta creada' });
    } catch (error) {
        errorServidor(res, 'Creando meta', error, 'No se pudo crear la meta');
    }
});

// PUT /metas/:id -> cambia datos o estado (activa, pausada, cancelada)
router.put('/:id', async (req, res) => {
    try {
        const nombre = texto(req.body.nombre, 100);
        const objetivo = numero(req.body.monto_objetivo);
        const estado = req.body.estado;
        if (rechazar(res, !nombre, 'Ponle un nombre a tu meta')) return;
        if (rechazar(res, !(objetivo > 0), 'El valor de la meta debe ser mayor a cero')) return;
        if (rechazar(res, estado && !['activa', 'pausada', 'cancelada'].includes(estado), 'Estado no válido')) return;
        const limite = req.body.fecha_limite || null;
        if (rechazar(res, limite && !esFecha(limite), 'La fecha límite no es válida')) return;
        const [r] = await connection.query(
            `UPDATE metas_ahorro SET nombre = ?, descripcion = ?, monto_objetivo = ?, fecha_limite = ?, estado = COALESCE(?, estado)
              WHERE id_meta = ? AND id_usuario = ?`,
            [nombre, texto(req.body.descripcion), objetivo, limite, estado || null, req.params.id, req.usuario.id_usuario]
        );
        if (rechazar(res, !r.affectedRows, 'Meta no encontrada')) return;
        res.json({ message: 'Meta actualizada' });
    } catch (error) {
        errorServidor(res, 'Editando meta', error, 'No se pudo actualizar la meta');
    }
});

// DELETE /metas/:id
router.delete('/:id', async (req, res) => {
    try {
        const [r] = await connection.query('DELETE FROM metas_ahorro WHERE id_meta = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Meta no encontrada')) return;
        res.json({ message: 'Meta eliminada' });
    } catch (error) {
        errorServidor(res, 'Eliminando meta', error);
    }
});

// GET /metas/:id/aportes
router.get('/:id/aportes', async (req, res) => {
    try {
        const [aportes] = await connection.query(
            `SELECT a.id_aporte, a.monto, a.fecha, a.nota FROM aportes_ahorro a
               JOIN metas_ahorro m ON m.id_meta = a.id_meta
              WHERE a.id_meta = ? AND m.id_usuario = ? ORDER BY a.fecha DESC, a.id_aporte DESC LIMIT 50`,
            [req.params.id, req.usuario.id_usuario]
        );
        res.json(aportes);
    } catch (error) {
        errorServidor(res, 'Listando aportes', error);
    }
});

// POST /metas/:id/aportes -> un trigger suma el aporte a la meta y la marca cumplida si llega al objetivo
router.post('/:id/aportes', async (req, res) => {
    try {
        const monto = numero(req.body.monto);
        const fecha = req.body.fecha || hoy();
        if (rechazar(res, !(monto > 0), 'El aporte debe ser mayor a cero')) return;
        if (rechazar(res, !esFecha(fecha), 'La fecha no es válida')) return;
        const [meta] = await connection.query('SELECT estado FROM metas_ahorro WHERE id_meta = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !meta.length, 'Meta no encontrada')) return;
        if (rechazar(res, meta[0].estado !== 'activa', 'Solo puedes aportar a metas activas')) return;

        await connection.query('INSERT INTO aportes_ahorro (id_meta, monto, fecha, nota) VALUES (?, ?, ?, ?)', [req.params.id, monto, fecha, texto(req.body.nota)]);
        await otorgarLogro(req.usuario.id_usuario, 'Ahorrador novato');
        const [despues] = await connection.query('SELECT estado FROM metas_ahorro WHERE id_meta = ?', [req.params.id]);
        const cumplida = despues[0]?.estado === 'cumplida';
        if (cumplida) {
            await otorgarLogro(req.usuario.id_usuario, 'Meta cumplida');
            emitirEvento('meta_cumplida', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, id_meta: Number(req.params.id) });
            await connection.query(
                "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'meta_ahorro', '¡Meta cumplida! 🎉', 'Alcanzaste el valor objetivo de una de tus metas de ahorro.')",
                [req.usuario.id_usuario]
            );
        }
        res.status(201).json({ message: cumplida ? '¡Meta cumplida! 🎉' : 'Aporte registrado', cumplida });
    } catch (error) {
        errorServidor(res, 'Registrando aporte', error, 'No se pudo registrar el aporte');
    }
});

// DELETE /metas/:id/aportes/:aporte
router.delete('/:id/aportes/:aporte', async (req, res) => {
    try {
        const [r] = await connection.query(
            `DELETE a FROM aportes_ahorro a JOIN metas_ahorro m ON m.id_meta = a.id_meta
              WHERE a.id_aporte = ? AND a.id_meta = ? AND m.id_usuario = ?`,
            [req.params.aporte, req.params.id, req.usuario.id_usuario]
        );
        if (rechazar(res, !r.affectedRows, 'Aporte no encontrado')) return;
        res.json({ message: 'Aporte eliminado' });
    } catch (error) {
        errorServidor(res, 'Eliminando aporte', error);
    }
});

export default router;
