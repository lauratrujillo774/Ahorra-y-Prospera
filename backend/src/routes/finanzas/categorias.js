import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { errorServidor, rechazar, texto } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /categorias?tipo=gasto -> las del sistema y las creadas por el usuario
router.get('/', async (req, res) => {
    try {
        const tipo = ['ingreso', 'gasto'].includes(req.query.tipo) ? req.query.tipo : null;
        const [filas] = await connection.query(
            `SELECT id_categoria, nombre, tipo, icono, color, (id_usuario IS NOT NULL) AS propia
               FROM categorias WHERE activa = 1 AND (id_usuario IS NULL OR id_usuario = ?) ${tipo ? 'AND tipo = ?' : ''}
              ORDER BY propia, id_categoria`,
            tipo ? [req.usuario.id_usuario, tipo] : [req.usuario.id_usuario]
        );
        res.json(filas);
    } catch (error) {
        errorServidor(res, 'Listando categorías', error);
    }
});

// POST /categorias -> categoría propia
router.post('/', async (req, res) => {
    try {
        const nombre = texto(req.body.nombre, 60);
        const tipo = req.body.tipo;
        const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color || '') ? req.body.color : '#15803D';
        if (rechazar(res, !nombre, 'Escribe el nombre de la categoría')) return;
        if (rechazar(res, !['ingreso', 'gasto'].includes(tipo), 'Tipo de categoría no válido')) return;
        const [r] = await connection.query(
            'INSERT INTO categorias (id_usuario, nombre, tipo, color) VALUES (?, ?, ?, ?)',
            [req.usuario.id_usuario, nombre, tipo, color]
        );
        res.status(201).json({ id_categoria: r.insertId, message: 'Categoría creada' });
    } catch (error) {
        errorServidor(res, 'Creando categoría', error, 'No se pudo crear la categoría');
    }
});

// DELETE /categorias/:id -> solo las propias
router.delete('/:id', async (req, res) => {
    try {
        const [r] = await connection.query('DELETE FROM categorias WHERE id_categoria = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Solo puedes eliminar tus propias categorías')) return;
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        errorServidor(res, 'Eliminando categoría', error);
    }
});

export default router;
