import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { connection } from '../../config/mysql/dbmysql.js';
import { revisarLogrosMovimientos, otorgarLogro } from '../../servicios/logros.js';
import { evaluarAlertasFinancieras } from '../../servicios/alertas.js';
import { actualizarRetos } from '../../servicios/retos.js';
import { emitirEvento } from '../../servicios/n8n.js';
import { errorServidor, esFecha, hoy, numero, rechazar, texto } from '../../utils/validar.js';

// Endpoints para que n8n le HABLE a la app (entrada). Se protegen con la clave N8N_API_KEY (cabecera x-api-key).
const router = Router();

function claveValida(req) {
    const esperada = process.env.N8N_API_KEY || '';
    const recibida = String(req.headers['x-api-key'] || '');
    if (!esperada || esperada.length < 16) return false;
    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    return a.length === b.length && timingSafeEqual(a, b);
}

router.use((req, res, next) => {
    if (!process.env.N8N_API_KEY) return res.status(503).json({ message: 'La integración con n8n no está configurada (falta N8N_API_KEY)' });
    if (!claveValida(req)) return res.status(401).json({ message: 'Clave de n8n no válida' });
    next();
});

// GET /n8n/estado -> comprobar la conexión desde n8n
router.get('/estado', (req, res) => res.json({ ok: true, app: 'ahorra-y-prospera', hora: new Date().toISOString() }));

// POST /n8n/notificar { correo, titulo, mensaje } -> crea una notificación en la campanita de ese usuario
router.post('/notificar', async (req, res) => {
    try {
        const correo = String(req.body.correo || '').trim().toLowerCase();
        const titulo = texto(req.body.titulo, 120);
        const mensaje = texto(req.body.mensaje, 500);
        if (rechazar(res, !correo || !titulo || !mensaje, 'Faltan correo, titulo o mensaje')) return;
        const [u] = await connection.query("SELECT id_usuario FROM usuarios WHERE correo = ? AND estado = 'activo'", [correo]);
        if (rechazar(res, !u.length, 'No hay un usuario activo con ese correo')) return;
        await connection.query("INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'sistema', ?, ?)", [u[0].id_usuario, titulo, mensaje]);
        res.status(201).json({ message: 'Notificación creada' });
    } catch (error) {
        errorServidor(res, 'n8n notificar', error);
    }
});

// GET /n8n/resumen-semanal?dias=7 -> por cada usuario activo: ingresos, gastos y balance de los últimos días
// (n8n puede armar con esto un correo o mensaje semanal)
router.get('/resumen-semanal', async (req, res) => {
    try {
        const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 7));
        const [filas] = await connection.query(
            `SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, m.codigo AS moneda,
                    COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = u.id_usuario AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)), 0) AS ingresos,
                    COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = u.id_usuario AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)), 0) AS gastos,
                    COALESCE((SELECT SUM(saldo_pendiente) FROM deudas WHERE id_usuario = u.id_usuario AND estado <> 'pagada'), 0) AS deudas
               FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda WHERE u.estado = 'activo'`, [dias, dias]
        );
        res.json({ dias, usuarios: filas.map((f) => ({ ...f, balance: f.ingresos - f.gastos })) });
    } catch (error) {
        errorServidor(res, 'n8n resumen semanal', error);
    }
});

// ---------- Utilidades ----------
const quitarTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function usuarioPorCorreo(correo) {
    const [u] = await connection.query(
        "SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.id_moneda, m.codigo AS moneda FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda WHERE u.correo = ? AND u.estado = 'activo'",
        [String(correo || '').trim().toLowerCase()]
    );
    return u[0] || null;
}

// Busca la categoría por nombre (sistema o del usuario); si no existe, usa "Otros ingresos" / "Otros gastos"
async function categoriaPorNombre(usuario, tipo, nombre) {
    const [cats] = await connection.query('SELECT id_categoria, nombre FROM categorias WHERE tipo = ? AND activa = 1 AND (id_usuario IS NULL OR id_usuario = ?)', [tipo, usuario.id_usuario]);
    const buscada = quitarTildes(nombre);
    const hallada = buscada && cats.find((c) => quitarTildes(c.nombre) === buscada);
    if (hallada) return hallada;
    return cats.find((c) => c.nombre === (tipo === 'gasto' ? 'Otros gastos' : 'Otros ingresos')) || { id_categoria: null, nombre: 'Sin categoría' };
}

// ---------- Registrar movimientos desde otras apps (Telegram, WhatsApp, Google Sheets, formularios…) ----------
for (const [tipo, tabla, ruta] of [['ingreso', 'ingresos', '/ingreso'], ['gasto', 'gastos', '/gasto']]) {
    // POST /n8n/ingreso | /n8n/gasto { correo, monto, descripcion?, categoria?, fecha? }
    router.post(ruta, async (req, res) => {
        try {
            const u = await usuarioPorCorreo(req.body.correo);
            if (rechazar(res, !u, 'No hay un usuario activo con ese correo')) return;
            const monto = numero(req.body.monto);
            const fecha = req.body.fecha || hoy();
            if (rechazar(res, !(monto > 0), 'El monto debe ser mayor a cero')) return;
            if (rechazar(res, !esFecha(fecha), 'La fecha no es válida (AAAA-MM-DD)')) return;
            const cat = await categoriaPorNombre(u, tipo, req.body.categoria);
            const [r] = await connection.query(
                `INSERT INTO ${tabla} (id_usuario, id_categoria, id_moneda, monto, descripcion, fecha) VALUES (?, ?, ?, ?, ?, ?)`,
                [u.id_usuario, cat.id_categoria, u.id_moneda, monto, texto(req.body.descripcion) || 'Registrado por n8n', fecha]
            );
            await revisarLogrosMovimientos(u.id_usuario);
            await evaluarAlertasFinancieras(u.id_usuario);
            res.status(201).json({ id: r.insertId, categoria: cat.nombre, message: `${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} registrado` });
        } catch (error) {
            errorServidor(res, `n8n ${tipo}`, error);
        }
    });
}

// POST /n8n/aporte-meta { correo, meta (nombre), monto } -> aporta a una meta de ahorro activa
router.post('/aporte-meta', async (req, res) => {
    try {
        const u = await usuarioPorCorreo(req.body.correo);
        if (rechazar(res, !u, 'No hay un usuario activo con ese correo')) return;
        const monto = numero(req.body.monto);
        if (rechazar(res, !(monto > 0), 'El monto debe ser mayor a cero')) return;
        const [metas] = await connection.query("SELECT id_meta, nombre FROM metas_ahorro WHERE id_usuario = ? AND estado = 'activa'", [u.id_usuario]);
        const buscada = quitarTildes(req.body.meta);
        const meta = metas.find((m) => quitarTildes(m.nombre) === buscada) || metas.find((m) => buscada && quitarTildes(m.nombre).includes(buscada));
        if (rechazar(res, !meta, 'No encontré una meta activa con ese nombre')) return;
        await connection.query('INSERT INTO aportes_ahorro (id_meta, monto, fecha, nota) VALUES (?, ?, ?, ?)', [meta.id_meta, monto, hoy(), 'Aporte por n8n']);
        await otorgarLogro(u.id_usuario, 'Ahorrador novato');
        const [[despues]] = await connection.query('SELECT estado, monto_actual, monto_objetivo FROM metas_ahorro WHERE id_meta = ?', [meta.id_meta]);
        if (despues.estado === 'cumplida') {
            await otorgarLogro(u.id_usuario, 'Meta cumplida');
            emitirEvento('meta_cumplida', { id_usuario: u.id_usuario, correo: u.correo, id_meta: meta.id_meta });
        }
        await actualizarRetos(u.id_usuario);
        res.status(201).json({ meta: meta.nombre, ahorrado: despues.monto_actual, objetivo: despues.monto_objetivo, cumplida: despues.estado === 'cumplida' });
    } catch (error) {
        errorServidor(res, 'n8n aporte', error);
    }
});

// ---------- Consultas para que n8n responda en un chat o arme mensajes ----------
// GET /n8n/usuario?correo=... -> foto rápida de un usuario (ideal para un bot: "¿cómo voy este mes?")
router.get('/usuario', async (req, res) => {
    try {
        const u = await usuarioPorCorreo(req.query.correo);
        if (rechazar(res, !u, 'No hay un usuario activo con ese correo')) return;
        const id = u.id_usuario;
        const [[mes]] = await connection.query(
            `SELECT COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS ingresos,
                    COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS gastos,
                    COALESCE((SELECT SUM(saldo_pendiente) FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'), 0) AS deudas,
                    COALESCE((SELECT SUM(monto_actual) FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada'), 0) AS ahorro`, [id, id, id, id]
        );
        const [presFilas] = await connection.query('SELECT monto_total, umbral_alerta FROM presupuestos WHERE id_usuario = ? AND anio = YEAR(CURDATE()) AND mes = MONTH(CURDATE())', [id]);
        const pres = presFilas[0] || null;
        const [pagos] = await connection.query(
            "SELECT concepto, monto, DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha, DATEDIFF(fecha_pago, CURDATE()) AS dias FROM pagos_programados WHERE id_usuario = ? AND estado = 'programado' ORDER BY fecha_pago LIMIT 5", [id]
        );
        const [metas] = await connection.query("SELECT nombre, monto_objetivo, monto_actual, porcentaje_avance FROM vista_progreso_metas WHERE id_usuario = ? AND estado = 'activa'", [id]);
        res.json({
            usuario: { nombres: u.nombres, apellidos: u.apellidos, correo: u.correo, moneda: u.moneda },
            mes: { ...mes, balance: mes.ingresos - mes.gastos, porcentajeGastado: mes.ingresos ? Math.round((mes.gastos / mes.ingresos) * 100) : null },
            presupuesto: pres ? { total: pres.monto_total, usado: mes.gastos, porcentaje: Math.round((mes.gastos / pres.monto_total) * 100), alertaAl: pres.umbral_alerta } : null,
            proximosPagos: pagos, metas,
        });
    } catch (error) {
        errorServidor(res, 'n8n usuario', error);
    }
});

// GET /n8n/pagos-proximos?dias=3 -> pagos programados de todos los usuarios que vencen pronto (para recordatorios por WhatsApp, Telegram, SMS…)
router.get('/pagos-proximos', async (req, res) => {
    try {
        const dias = Math.min(30, Math.max(0, Number(req.query.dias ?? 3)));
        const [filas] = await connection.query(
            `SELECT u.nombres, u.correo, p.concepto, p.monto, DATE_FORMAT(p.fecha_pago, '%Y-%m-%d') AS fecha, DATEDIFF(p.fecha_pago, CURDATE()) AS dias, m.codigo AS moneda
               FROM pagos_programados p JOIN usuarios u ON u.id_usuario = p.id_usuario JOIN monedas m ON m.id_moneda = u.id_moneda
              WHERE p.estado = 'programado' AND u.estado = 'activo' AND DATEDIFF(p.fecha_pago, CURDATE()) <= ? ORDER BY p.fecha_pago`, [dias]
        );
        res.json({ dias, pagos: filas });
    } catch (error) {
        errorServidor(res, 'n8n pagos próximos', error);
    }
});

// GET /n8n/usuarios-en-riesgo -> usuarios que ya gastaron 80% o más de sus ingresos del mes
router.get('/usuarios-en-riesgo', async (req, res) => {
    try {
        const [filas] = await connection.query(
            `SELECT * FROM (SELECT u.nombres, u.correo,
                    COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = u.id_usuario AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS ingresos,
                    COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = u.id_usuario AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS gastos
               FROM usuarios u WHERE u.estado = 'activo') t WHERE ingresos > 0 AND gastos >= ingresos * 0.8`
        );
        res.json({ usuarios: filas.map((f) => ({ ...f, porcentajeGastado: Math.round((f.gastos / f.ingresos) * 100) })) });
    } catch (error) {
        errorServidor(res, 'n8n usuarios en riesgo', error);
    }
});

export default router;
