import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { actualizarRetos } from '../../servicios/retos.js';
import { errorServidor, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /retos -> catálogo con el estado del usuario en cada reto
router.get('/', async (req, res) => {
    try {
        await actualizarRetos(req.usuario.id_usuario);
        const [retos] = await connection.query(
            `SELECT r.id_reto, r.titulo, r.descripcion, r.tipo, r.monto_meta, r.duracion_dias, r.puntos,
                    ur.id_usuario_reto, ur.fecha_inicio, ur.fecha_fin, ur.progreso, ur.estado,
                    CASE WHEN ur.estado = 'en_curso' THEN GREATEST(0, DATEDIFF(DATE_ADD(ur.fecha_inicio, INTERVAL r.duracion_dias DAY), CURDATE())) END AS dias_restantes
               FROM retos_financieros r
               LEFT JOIN usuario_retos ur ON ur.id_reto = r.id_reto AND ur.id_usuario = ?
                    AND ur.id_usuario_reto = (SELECT MAX(x.id_usuario_reto) FROM usuario_retos x WHERE x.id_reto = r.id_reto AND x.id_usuario = ?)
              WHERE r.activo = 1 ORDER BY r.id_reto`,
            [req.usuario.id_usuario, req.usuario.id_usuario]
        );
        res.json(retos);
    } catch (error) {
        errorServidor(res, 'Listando retos', error, 'No se pudieron cargar los retos');
    }
});

// POST /retos/:id/unirse
router.post('/:id/unirse', async (req, res) => {
    try {
        const [reto] = await connection.query('SELECT duracion_dias FROM retos_financieros WHERE id_reto = ? AND activo = 1', [req.params.id]);
        if (rechazar(res, !reto.length, 'Reto no encontrado')) return;
        const [curso] = await connection.query("SELECT 1 FROM usuario_retos WHERE id_usuario = ? AND id_reto = ? AND estado = 'en_curso'", [req.usuario.id_usuario, req.params.id]);
        if (rechazar(res, curso.length, 'Ya estás en este reto')) return;
        await connection.query(
            'INSERT INTO usuario_retos (id_usuario, id_reto, fecha_inicio, fecha_fin) VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))',
            [req.usuario.id_usuario, req.params.id, reto[0].duracion_dias]
        );
        await actualizarRetos(req.usuario.id_usuario);
        res.status(201).json({ message: '¡Reto aceptado! Tu progreso se actualiza solo con lo que hagas en la app 💪' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya aceptaste este reto hoy. Vuelve a intentarlo mañana.' });
        errorServidor(res, 'Uniéndose a reto', error, 'No se pudo aceptar el reto');
    }
});

// POST /retos/:id/abandonar -> el progreso es automático; solo se puede abandonar un reto
router.post('/:id/abandonar', async (req, res) => {
    try {
        const [r] = await connection.query("UPDATE usuario_retos SET estado = 'abandonado' WHERE id_usuario = ? AND id_reto = ? AND estado = 'en_curso'", [req.usuario.id_usuario, req.params.id]);
        if (rechazar(res, !r.affectedRows, 'No tienes ese reto en curso')) return;
        res.json({ message: 'Reto abandonado' });
    } catch (error) {
        errorServidor(res, 'Abandonando reto', error, 'No se pudo abandonar el reto');
    }
});

export default router;
