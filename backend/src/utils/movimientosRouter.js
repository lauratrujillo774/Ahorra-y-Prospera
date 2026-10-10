import { Router } from 'express';
import { connection } from '../config/mysql/dbmysql.js';
import { requiereSesion } from '../middleware/sesion.js';
import { revisarLogrosMovimientos } from '../servicios/logros.js';
import { evaluarAlertasFinancieras } from '../servicios/alertas.js';
import { emitirEvento } from '../servicios/n8n.js';
import { esFecha, errorServidor, hoy, numero, rechazar, texto } from './validar.js';

// Crea las rutas CRUD de ingresos o de gastos (son casi iguales)
export function crearRouterMovimientos(tipo) {
    const esIngreso = tipo === 'ingreso';
    const tabla = esIngreso ? 'ingresos' : 'gastos';
    const clave = esIngreso ? 'id_ingreso' : 'id_gasto';
    const extra = esIngreso ? 'recurrente' : 'es_necesidad';
    const router = Router();
    router.use(requiereSesion);

    // GET /<tabla>?mes=AAAA-MM  -> movimientos del mes (o los más recientes) + total
    router.get('/', async (req, res) => {
        try {
            const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : null;
            const filtro = mes ? "AND DATE_FORMAT(m.fecha, '%Y-%m') = ?" : '';
            const params = mes ? [req.usuario.id_usuario, mes] : [req.usuario.id_usuario];
            const [filas] = await connection.query(
                `SELECT m.${clave} AS id, m.monto, m.descripcion, m.fecha, m.${extra} AS extra, m.id_categoria,
                        c.nombre AS categoria, c.icono, c.color
                   FROM ${tabla} m LEFT JOIN categorias c ON c.id_categoria = m.id_categoria
                  WHERE m.id_usuario = ? ${filtro} ORDER BY m.fecha DESC, m.${clave} DESC LIMIT 300`,
                params
            );
            const total = filas.reduce((t, f) => t + f.monto, 0);
            res.json({ total, movimientos: filas });
        } catch (error) {
            errorServidor(res, `Listando ${tabla}`, error, 'No se pudieron cargar los datos');
        }
    });

    async function validar(req, res) {
        const monto = numero(req.body.monto);
        const fecha = req.body.fecha || hoy();
        const idCategoria = numero(req.body.id_categoria);
        if (rechazar(res, !(monto > 0), 'El monto debe ser mayor a cero')) return null;
        if (rechazar(res, !esFecha(fecha), 'La fecha no es válida')) return null;
        if (idCategoria) {
            const [cat] = await connection.query(
                'SELECT id_categoria FROM categorias WHERE id_categoria = ? AND tipo = ? AND (id_usuario IS NULL OR id_usuario = ?)',
                [idCategoria, tipo, req.usuario.id_usuario]
            );
            if (rechazar(res, !cat.length, 'Categoría no válida')) return null;
        }
        return {
            monto, fecha, idCategoria: idCategoria || null, descripcion: texto(req.body.descripcion),
            extra: req.body.extra === true || req.body.extra === 1 || req.body.extra === '1' ? 1 : (req.body.extra === null || req.body.extra === undefined ? (esIngreso ? 0 : null) : 0),
        };
    }

    router.post('/', async (req, res) => {
        try {
            const d = await validar(req, res);
            if (!d) return;
            const [r] = await connection.query(
                `INSERT INTO ${tabla} (id_usuario, id_categoria, id_moneda, monto, descripcion, fecha, ${extra})
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.usuario.id_usuario, d.idCategoria, req.usuario.id_moneda, d.monto, d.descripcion, d.fecha, d.extra]
            );
            await revisarLogrosMovimientos(req.usuario.id_usuario);
            await evaluarAlertasFinancieras(req.usuario.id_usuario);
            if (process.env.N8N_WEBHOOK_URL) {
                const [[tot]] = await connection.query(
                    "SELECT COALESCE(SUM(monto), 0) AS ingresos FROM ingresos WHERE id_usuario = ? AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')", [req.usuario.id_usuario, d.fecha]
                );
                emitirEvento(esIngreso ? 'ingreso_registrado' : 'gasto_registrado', {
                    id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, monto: d.monto, descripcion: d.descripcion, fecha: d.fecha,
                    grande: !esIngreso && tot.ingresos > 0 && d.monto >= tot.ingresos * 0.2,
                });
            }
            res.status(201).json({ id: r.insertId, message: `${esIngreso ? 'Ingreso' : 'Gasto'} registrado` });
        } catch (error) {
            errorServidor(res, `Creando ${tipo}`, error, 'No se pudo guardar');
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const d = await validar(req, res);
            if (!d) return;
            const [r] = await connection.query(
                `UPDATE ${tabla} SET id_categoria = ?, monto = ?, descripcion = ?, fecha = ?, ${extra} = ?
                  WHERE ${clave} = ? AND id_usuario = ?`,
                [d.idCategoria, d.monto, d.descripcion, d.fecha, d.extra, req.params.id, req.usuario.id_usuario]
            );
            if (rechazar(res, !r.affectedRows, 'No se encontró el registro')) return;
            await evaluarAlertasFinancieras(req.usuario.id_usuario);
            res.json({ message: 'Actualizado' });
        } catch (error) {
            errorServidor(res, `Editando ${tipo}`, error, 'No se pudo actualizar');
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const [r] = await connection.query(`DELETE FROM ${tabla} WHERE ${clave} = ? AND id_usuario = ?`, [req.params.id, req.usuario.id_usuario]);
            if (rechazar(res, !r.affectedRows, 'No se encontró el registro')) return;
            res.json({ message: 'Eliminado' });
        } catch (error) {
            errorServidor(res, `Eliminando ${tipo}`, error, 'No se pudo eliminar');
        }
    });

    return router;
}
