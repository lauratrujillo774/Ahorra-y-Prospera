import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { generarNotificaciones } from '../../servicios/notificaciones.js';
import { errorServidor, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /notificaciones -> revisa recordatorios y devuelve las últimas
router.get('/', async (req, res) => {
    try {
        await generarNotificaciones(req.usuario.id_usuario);
        const [lista] = await connection.query(
            'SELECT id_notificacion, tipo, titulo, mensaje, leida, creada_en FROM notificaciones WHERE id_usuario = ? ORDER BY creada_en DESC, id_notificacion DESC LIMIT 40',
            [req.usuario.id_usuario]
        );
        res.json({ noLeidas: lista.filter((n) => !n.leida).length, notificaciones: lista });
    } catch (error) {
        errorServidor(res, 'Listando notificaciones', error);
    }
});

// POST /notificaciones/leer-todas
router.post('/leer-todas', async (req, res) => {
    try {
        await connection.query('UPDATE notificaciones SET leida = 1 WHERE id_usuario = ?', [req.usuario.id_usuario]);
        res.json({ message: 'Todas leídas' });
    } catch (error) {
        errorServidor(res, 'Marcando notificaciones', error);
    }
});

// POST /notificaciones/:id/leer
router.post('/:id/leer', async (req, res) => {
    try {
        const [r] = await connection.query('UPDATE notificaciones SET leida = 1 WHERE id_notificacion = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Notificación no encontrada')) return;
        res.json({ message: 'Leída' });
    } catch (error) {
        errorServidor(res, 'Marcando notificación', error);
    }
});

// DELETE /notificaciones/:id
router.delete('/:id', async (req, res) => {
    try {
        await connection.query('DELETE FROM notificaciones WHERE id_notificacion = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        res.json({ message: 'Eliminada' });
    } catch (error) {
        errorServidor(res, 'Eliminando notificación', error);
    }
});

export default router;
