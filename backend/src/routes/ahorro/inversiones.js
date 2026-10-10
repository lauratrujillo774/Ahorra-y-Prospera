import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { otorgarLogro, revisarLogrosMovimientos } from '../../servicios/logros.js';
import { evaluarAlertasFinancieras } from '../../servicios/alertas.js';
import { emitirEvento } from '../../servicios/n8n.js';
import { errorServidor, esFecha, hoy, numero, rechazar, texto } from '../../utils/validar.js';

// Ganancias (intereses, dividendos, cupones) que paga cada inversión. Cada una se refleja como un ingreso del mes.
await connection.query(`CREATE TABLE IF NOT EXISTS rendimientos_inversion (
    id_rendimiento INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_inversion INT UNSIGNED NOT NULL,
    id_ingreso INT UNSIGNED NULL COMMENT 'Ingreso que se generó automáticamente',
    monto DECIMAL(15,2) NOT NULL,
    fecha DATE NOT NULL,
    nota VARCHAR(255) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rend_inversion (id_inversion, fecha),
    CONSTRAINT fk_rend_inversion FOREIGN KEY (id_inversion) REFERENCES inversiones (id_inversion) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

const router = Router();
router.use(requiereSesion);

async function categoriaRendimientos() {
    const [c] = await connection.query("SELECT id_categoria FROM categorias WHERE nombre = 'Rendimientos' AND tipo = 'ingreso' AND id_usuario IS NULL LIMIT 1");
    return c[0]?.id_categoria ?? null;
}

// GET /inversiones/tipos
router.get('/tipos', async (req, res) => {
    try {
        const [tipos] = await connection.query('SELECT id_tipo_inversion, nombre, descripcion, nivel_riesgo FROM tipos_inversion ORDER BY id_tipo_inversion');
        res.json(tipos);
    } catch (error) {
        errorServidor(res, 'Listando tipos de inversión', error);
    }
});

// GET /inversiones -> inversiones con su rendimiento
router.get('/', async (req, res) => {
    try {
        const [filas] = await connection.query(
            `SELECT i.id_inversion, i.nombre, i.id_tipo_inversion, v.tipo, v.nivel_riesgo, i.monto_invertido, i.valor_actual,
                    v.ganancia, v.rendimiento_pct, i.tasa_rendimiento_anual, i.fecha_inicio, i.fecha_vencimiento, i.estado, i.notas,
                    COALESCE((SELECT SUM(r.monto) FROM rendimientos_inversion r WHERE r.id_inversion = i.id_inversion), 0) AS ganancias_cobradas
               FROM inversiones i JOIN vista_rendimiento_inversiones v ON v.id_inversion = i.id_inversion
              WHERE i.id_usuario = ? ORDER BY i.estado = 'activa' DESC, i.fecha_inicio DESC`,
            [req.usuario.id_usuario]
        );
        res.json(filas);
    } catch (error) {
        errorServidor(res, 'Listando inversiones', error, 'No se pudieron cargar tus inversiones');
    }
});

async function leerCuerpo(req, res) {
    const nombre = texto(req.body.nombre, 100);
    const tipo = numero(req.body.id_tipo_inversion);
    const monto = numero(req.body.monto_invertido);
    const valor = numero(req.body.valor_actual);
    const tasa = numero(req.body.tasa_rendimiento_anual);
    const inicio = req.body.fecha_inicio || hoy();
    const vence = req.body.fecha_vencimiento || null;
    const estado = req.body.estado || 'activa';
    if (rechazar(res, !nombre, 'Ponle un nombre a la inversión')) return null;
    if (rechazar(res, !(monto > 0), 'El monto invertido debe ser mayor a cero')) return null;
    if (rechazar(res, valor !== null && !(valor >= 0), 'El valor actual no es válido')) return null;
    if (rechazar(res, tasa !== null && !(tasa >= -100 && tasa <= 999), 'La tasa no es válida')) return null;
    if (rechazar(res, !esFecha(inicio) || (vence && !esFecha(vence)), 'Las fechas no son válidas')) return null;
    if (rechazar(res, !['activa', 'finalizada', 'retirada'].includes(estado), 'Estado no válido')) return null;
    const [t] = await connection.query('SELECT 1 FROM tipos_inversion WHERE id_tipo_inversion = ?', [tipo]);
    if (rechazar(res, !t.length, 'Elige un tipo de inversión')) return null;
    return { nombre, tipo, monto, valor, tasa, inicio, vence, estado, notas: texto(req.body.notas) };
}

router.post('/', async (req, res) => {
    try {
        const d = await leerCuerpo(req, res);
        if (!d) return;
        const [r] = await connection.query(
            `INSERT INTO inversiones (id_usuario, id_tipo_inversion, id_moneda, nombre, monto_invertido, valor_actual,
                                      tasa_rendimiento_anual, fecha_inicio, fecha_vencimiento, estado, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.usuario.id_usuario, d.tipo, req.usuario.id_moneda, d.nombre, d.monto, d.valor, d.tasa, d.inicio, d.vence, d.estado, d.notas]
        );
        await otorgarLogro(req.usuario.id_usuario, 'Inversionista');
        res.status(201).json({ id_inversion: r.insertId, message: 'Inversión registrada' });
    } catch (error) {
        errorServidor(res, 'Creando inversión', error, 'No se pudo registrar la inversión');
    }
});

router.put('/:id', async (req, res) => {
    try {
        const d = await leerCuerpo(req, res);
        if (!d) return;
        const [r] = await connection.query(
            `UPDATE inversiones SET id_tipo_inversion = ?, nombre = ?, monto_invertido = ?, valor_actual = ?, tasa_rendimiento_anual = ?,
                    fecha_inicio = ?, fecha_vencimiento = ?, estado = ?, notas = ?
              WHERE id_inversion = ? AND id_usuario = ?`,
            [d.tipo, d.nombre, d.monto, d.valor, d.tasa, d.inicio, d.vence, d.estado, d.notas, req.params.id, req.usuario.id_usuario]
        );
        if (rechazar(res, !r.affectedRows, 'Inversión no encontrada')) return;
        res.json({ message: 'Inversión actualizada' });
    } catch (error) {
        errorServidor(res, 'Editando inversión', error, 'No se pudo actualizar');
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [r] = await connection.query('DELETE FROM inversiones WHERE id_inversion = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !r.affectedRows, 'Inversión no encontrada')) return;
        res.json({ message: 'Inversión eliminada' });
    } catch (error) {
        errorServidor(res, 'Eliminando inversión', error);
    }
});

// GET /inversiones/rendimientos -> resumen de ganancias por mes y por inversión
router.get('/rendimientos', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        const [porMes] = await connection.query(
            `SELECT DATE_FORMAT(r.fecha, '%Y-%m') AS mes, SUM(r.monto) AS total, COUNT(*) AS cantidad
               FROM rendimientos_inversion r JOIN inversiones i ON i.id_inversion = r.id_inversion
              WHERE i.id_usuario = ? GROUP BY mes ORDER BY mes DESC LIMIT 12`, [id]
        );
        const [porInversion] = await connection.query(
            `SELECT i.id_inversion, i.nombre, COALESCE(SUM(r.monto), 0) AS total FROM inversiones i
               LEFT JOIN rendimientos_inversion r ON r.id_inversion = i.id_inversion WHERE i.id_usuario = ? GROUP BY i.id_inversion, i.nombre`, [id]
        );
        const mesActual = new Date().toISOString().slice(0, 7);
        res.json({ porMes, porInversion, esteMes: porMes.find((m) => m.mes === mesActual)?.total ?? 0, total: porMes.reduce((t, m) => t + m.total, 0) });
    } catch (error) {
        errorServidor(res, 'Resumen de ganancias', error, 'No se pudieron cargar las ganancias');
    }
});

// GET /inversiones/:id/rendimientos
router.get('/:id/rendimientos', async (req, res) => {
    try {
        const [lista] = await connection.query(
            `SELECT r.id_rendimiento, r.monto, r.fecha, r.nota, r.id_ingreso FROM rendimientos_inversion r
               JOIN inversiones i ON i.id_inversion = r.id_inversion WHERE r.id_inversion = ? AND i.id_usuario = ? ORDER BY r.fecha DESC, r.id_rendimiento DESC`,
            [req.params.id, req.usuario.id_usuario]
        );
        res.json(lista);
    } catch (error) {
        errorServidor(res, 'Listando ganancias', error);
    }
});

// POST /inversiones/:id/rendimientos { monto, fecha, nota } -> guarda la ganancia y la suma a los ingresos de ese mes
router.post('/:id/rendimientos', async (req, res) => {
    try {
        const monto = numero(req.body.monto);
        const fecha = req.body.fecha || hoy();
        if (rechazar(res, !(monto > 0), 'La ganancia debe ser mayor a cero')) return;
        if (rechazar(res, !esFecha(fecha), 'La fecha no es válida')) return;
        const [inv] = await connection.query('SELECT nombre FROM inversiones WHERE id_inversion = ? AND id_usuario = ?', [req.params.id, req.usuario.id_usuario]);
        if (rechazar(res, !inv.length, 'Inversión no encontrada')) return;

        const [ing] = await connection.query(
            'INSERT INTO ingresos (id_usuario, id_categoria, id_moneda, monto, descripcion, fecha, recurrente) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [req.usuario.id_usuario, await categoriaRendimientos(), req.usuario.id_moneda, monto, `Rendimiento: ${inv[0].nombre}`, fecha]
        );
        const [r] = await connection.query('INSERT INTO rendimientos_inversion (id_inversion, id_ingreso, monto, fecha, nota) VALUES (?, ?, ?, ?, ?)', [req.params.id, ing.insertId, monto, fecha, texto(req.body.nota)]);
        await revisarLogrosMovimientos(req.usuario.id_usuario);
        await evaluarAlertasFinancieras(req.usuario.id_usuario);
        emitirEvento('ganancia_inversion', { id_usuario: req.usuario.id_usuario, correo: req.usuario.correo, inversion: inv[0].nombre, monto, fecha });
        res.status(201).json({ id_rendimiento: r.insertId, message: 'Ganancia registrada y sumada a tus ingresos del mes 💰' });
    } catch (error) {
        errorServidor(res, 'Registrando ganancia', error, 'No se pudo registrar la ganancia');
    }
});

// PUT /inversiones/rendimientos/:idr
router.put('/rendimientos/:idr', async (req, res) => {
    try {
        const monto = numero(req.body.monto);
        const fecha = req.body.fecha || hoy();
        if (rechazar(res, !(monto > 0), 'La ganancia debe ser mayor a cero')) return;
        if (rechazar(res, !esFecha(fecha), 'La fecha no es válida')) return;
        const [fila] = await connection.query(
            `SELECT r.id_ingreso FROM rendimientos_inversion r JOIN inversiones i ON i.id_inversion = r.id_inversion
              WHERE r.id_rendimiento = ? AND i.id_usuario = ?`, [req.params.idr, req.usuario.id_usuario]
        );
        if (rechazar(res, !fila.length, 'Ganancia no encontrada')) return;
        await connection.query('UPDATE rendimientos_inversion SET monto = ?, fecha = ?, nota = ? WHERE id_rendimiento = ?', [monto, fecha, texto(req.body.nota), req.params.idr]);
        if (fila[0].id_ingreso) await connection.query('UPDATE ingresos SET monto = ?, fecha = ? WHERE id_ingreso = ? AND id_usuario = ?', [monto, fecha, fila[0].id_ingreso, req.usuario.id_usuario]);
        res.json({ message: 'Ganancia actualizada (y su ingreso también)' });
    } catch (error) {
        errorServidor(res, 'Editando ganancia', error, 'No se pudo actualizar la ganancia');
    }
});

// DELETE /inversiones/rendimientos/:idr -> también quita el ingreso que generó
router.delete('/rendimientos/:idr', async (req, res) => {
    try {
        const [fila] = await connection.query(
            `SELECT r.id_ingreso FROM rendimientos_inversion r JOIN inversiones i ON i.id_inversion = r.id_inversion
              WHERE r.id_rendimiento = ? AND i.id_usuario = ?`, [req.params.idr, req.usuario.id_usuario]
        );
        if (rechazar(res, !fila.length, 'Ganancia no encontrada')) return;
        await connection.query('DELETE FROM rendimientos_inversion WHERE id_rendimiento = ?', [req.params.idr]);
        if (fila[0].id_ingreso) await connection.query('DELETE FROM ingresos WHERE id_ingreso = ? AND id_usuario = ?', [fila[0].id_ingreso, req.usuario.id_usuario]);
        res.json({ message: 'Ganancia eliminada (y su ingreso también)' });
    } catch (error) {
        errorServidor(res, 'Eliminando ganancia', error);
    }
});

export default router;
