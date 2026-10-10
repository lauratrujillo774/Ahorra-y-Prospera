import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';

const router = Router();

// GET /salud -> comprueba que el servidor y la base de datos responden
router.get('/', async (req, res) => {
    try {
        await connection.query('SELECT 1');
        res.json({ servidor: 'ok', baseDeDatos: 'ok' });
    } catch (error) {
        res.status(500).json({ servidor: 'ok', baseDeDatos: 'error', message: error.message });
    }
});

export default router;
