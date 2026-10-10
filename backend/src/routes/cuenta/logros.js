import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { estadoRecompensas, NIVELES } from '../../servicios/logros.js';
import { actualizarRetos } from '../../servicios/retos.js';
import { emitirEvento } from '../../servicios/n8n.js';
import { errorServidor, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /logros -> catálogo de insignias, cuáles tiene el usuario y sus puntos
router.get('/', async (req, res) => {
    try {
        const [logros] = await connection.query(
            `SELECT l.id_logro, l.nombre, l.descripcion, l.puntos, ul.obtenido_en, (ul.id_usuario IS NOT NULL) AS obtenido
               FROM logros l LEFT JOIN usuario_logros ul ON ul.id_logro = l.id_logro AND ul.id_usuario = ?
              ORDER BY obtenido DESC, l.id_logro`,
            [req.usuario.id_usuario]
        );
        await actualizarRetos(req.usuario.id_usuario);
        const rec = await estadoRecompensas(req.usuario.id_usuario);
        res.json({ puntos: rec.puntos.total, puntosLogros: rec.puntos.logros, puntosRetos: rec.puntos.retos, recompensas: rec, logros: logros.map((l) => ({ ...l, obtenido: !!l.obtenido })) });
    } catch (error) {
        errorServidor(res, 'Listando logros', error, 'No se pudieron cargar tus logros');
    }
});

// POST /logros/recompensas/:nivel/reclamar -> canjea la recompensa de un nivel alcanzado
router.post('/recompensas/:nivel/reclamar', async (req, res) => {
    try {
        const nivel = NIVELES.find((n) => n.clave === req.params.nivel);
        if (rechazar(res, !nivel, 'Recompensa no encontrada')) return;
        const rec = await estadoRecompensas(req.usuario.id_usuario);
        if (rechazar(res, rec.puntos.total < nivel.puntos, `Aún te faltan ${nivel.puntos - rec.puntos.total} puntos para este nivel`)) return;
        const [r] = await connection.query('INSERT IGNORE INTO recompensas_usuario (id_usuario, nivel) VALUES (?, ?)', [req.usuario.id_usuario, nivel.clave]);
        if (rechazar(res, !r.affectedRows, 'Ya reclamaste esta recompensa')) return;
        await connection.query("INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'logro', ?, ?)", [req.usuario.id_usuario, `${nivel.emoji} Recompensa reclamada: ${nivel.nombre}`, nivel.premio + '.']);
        emitirEvento('recompensa_reclamada', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, nivel: nivel.nombre, premio: nivel.premio });
        res.json({ message: `${nivel.emoji} ¡Recompensa reclamada! ${nivel.premio}` });
    } catch (error) {
        errorServidor(res, 'Reclamando recompensa', error, 'No se pudo reclamar la recompensa');
    }
});

export default router;
