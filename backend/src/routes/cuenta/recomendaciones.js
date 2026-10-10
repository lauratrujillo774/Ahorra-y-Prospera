import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { errorServidor } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /recomendaciones -> las que generó el asesor IA (las más urgentes primero)
router.get('/', async (req, res) => {
    try {
        const [lista] = await connection.query(
            `SELECT id_recomendacion, tipo, titulo, mensaje, prioridad, leida, generada_en FROM recomendaciones_ia
              WHERE id_usuario = ? ORDER BY leida, FIELD(prioridad, 'alta', 'media', 'baja'), generada_en DESC LIMIT 40`,
            [req.usuario.id_usuario]
        );
        res.json(lista.map((r) => ({ ...r, leida: !!r.leida })));
    } catch (error) {
        errorServidor(res, 'Listando recomendaciones', error);
    }
});

// POST /recomendaciones/:id/leer
router.post('/:id/leer', async (req, res) => {
    try {
        await connection.query('UPDATE recomendaciones_ia SET leida = 1 WHERE id_recomendacion = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        res.json({ message: 'Marcada como leída' });
    } catch (error) {
        errorServidor(res, 'Marcando recomendación', error);
    }
});

export default router;
