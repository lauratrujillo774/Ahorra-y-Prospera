import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { errorServidor, numero, rechazar, texto } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /cuentas -> cuentas de ahorro (banco, billetera, efectivo…)
router.get('/', async (req, res) => {
    try {
        const [cuentas] = await connection.query(
            'SELECT id_cuenta, nombre, entidad, saldo FROM cuentas_ahorro WHERE id_usuario = ? ORDER BY id_cuenta',
            [req.usuario.id_usuario]
        );
        res.json(cuentas);
    } catch (error) {
        errorServidor(res, 'Listando cuentas', error);
    }
});

router.post('/', async (req, res) => {
    try {
        const nombre = texto(req.body.nombre, 80);
        const saldo = numero(req.body.saldo) ?? 0;
        if (rechazar(res, !nombre, 'Ponle un nombre a la cuenta')) return;
        if (rechazar(res, Number.isNaN(saldo) || saldo < 0, 'El saldo no es válido')) return;
        const [r] = await connection.query(
            'INSERT INTO cuentas_ahorro (id_usuario, nombre, entidad, saldo) VALUES (?, ?, ?, ?)',
            [req.usuario.id_usuario, nombre, texto(req.body.entidad, 80), saldo]
        );
        res.status(201).json({ id_cuenta: r.insertId, message: 'Cuenta creada' });
    } catch (error) {
        errorServidor(res, 'Creando cuenta', error, 'No se pudo crear la cuenta');
    }
});

router.put('/:id', async (req, res) => {
    try {
        const nombre = texto(req.body.nombre, 80);
        const saldo = numero(req.body.saldo);
        if (rechazar(res, !nombre, 'Ponle un nombre a la cuenta')) return;
        if (rechazar(res, saldo === null || Number.isNaN(saldo) || saldo < 0, 'El saldo no es válido')) return;
        const [r] = await connection.query(
            'UPDATE cuentas_ahorro SET nombre = ?, entidad = ?, saldo = ? WHERE id_cuenta = ? AND id_usuario = ?',
            [nombre, texto(req.body.entidad, 80), saldo, req.params.id, req.usuario.id_usuario]
        );
        if (rechazar(res, !r.affectedRows, 'Cuenta no encontrada')) return;
        res.json({ message: 'Cuenta actualizada' });
    } catch (error) {
        errorServidor(res, 'Editando cuenta', error);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [r] = await connection.query('DELETE FROM cuentas_ahorro WHERE id_cuenta = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Cuenta no encontrada')) return;
        res.json({ message: 'Cuenta eliminada' });
    } catch (error) {
        errorServidor(res, 'Eliminando cuenta', error);
    }
});

export default router;
