import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { encriptar, verificar } from '../../utils/contrasenas.js';
import { carpetaUploads } from '../../utils/fotos.js';
import { errorServidor, esFecha, numero, rechazar, texto } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// GET /perfil
router.get('/', async (req, res) => {
    try {
        const [[u]] = await connection.query(
            `SELECT u.nombres, u.apellidos, u.correo, u.correo_auxiliar, u.correo_aux_verificado, u.telefono,
                    u.fecha_nacimiento, u.foto_perfil, u.tema, u.idioma, u.porcentaje_ahorro_meta, u.id_moneda,
                    u.creado_en, u.ultimo_acceso, (u.contrasena_hash LIKE 'scrypt$%') AS tiene_contrasena
               FROM usuarios u WHERE u.id_usuario = ?`,
            [req.usuario.id_usuario]
        );
        const [monedas] = await connection.query('SELECT id_moneda, codigo, nombre, simbolo, tasa_cambio_usd FROM monedas WHERE activa = 1 ORDER BY id_moneda');
        const [sesiones] = await connection.query(
            'SELECT id_sesion, ip, navegador, inicio_en, ultima_actividad, (token_sesion = ?) AS actual FROM sesiones WHERE id_usuario = ? AND cerrada_en IS NULL ORDER BY ultima_actividad DESC LIMIT 10',
            [req.token, req.usuario.id_usuario]
        );
        res.json({ perfil: u, monedas, sesiones: sesiones.map((s) => ({ ...s, actual: !!s.actual })) });
    } catch (error) {
        errorServidor(res, 'Leyendo perfil', error, 'No se pudo cargar tu perfil');
    }
});

// Multiplica todos los valores monetarios del usuario por "factor" (nunca deja un monto positivo en 0)
async function convertirValores(conexion, idUsuario, factor, idMonedaNueva) {
    const f = Number(factor);
    const mult = (col) => `GREATEST(ROUND(${col} * ${f}, 2), 0.01)`;
    const multNull = (col) => `CASE WHEN ${col} IS NULL THEN NULL ELSE GREATEST(ROUND(${col} * ${f}, 2), 0.01) END`;
    const m = idMonedaNueva;
    await conexion.query(`UPDATE ingresos SET monto = ${mult('monto')}, id_moneda = ? WHERE id_usuario = ?`, [m, idUsuario]);
    await conexion.query(`UPDATE gastos SET monto = ${mult('monto')}, id_moneda = ? WHERE id_usuario = ?`, [m, idUsuario]);
    await conexion.query(`UPDATE presupuestos SET monto_total = ${mult('monto_total')} WHERE id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE presupuesto_categorias pc JOIN presupuestos p ON p.id_presupuesto = pc.id_presupuesto SET pc.monto_limite = ${mult('pc.monto_limite')} WHERE p.id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE metas_ahorro SET monto_objetivo = ${mult('monto_objetivo')}, monto_actual = ROUND(monto_actual * ${f}, 2) WHERE id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE aportes_ahorro a JOIN metas_ahorro mt ON mt.id_meta = a.id_meta SET a.monto = ${mult('a.monto')} WHERE mt.id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE cuentas_ahorro SET saldo = ROUND(saldo * ${f}, 2) WHERE id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE deudas SET monto_total = ${mult('monto_total')}, saldo_pendiente = ROUND(saldo_pendiente * ${f}, 2), cuota_mensual = ${multNull('cuota_mensual')}, id_moneda = ? WHERE id_usuario = ?`, [m, idUsuario]);
    await conexion.query(`UPDATE pagos_deuda pd JOIN deudas d ON d.id_deuda = pd.id_deuda SET pd.monto = ${mult('pd.monto')} WHERE d.id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE pagos_programados SET monto = ${mult('monto')} WHERE id_usuario = ?`, [idUsuario]);
    await conexion.query(`UPDATE inversiones SET monto_invertido = ${mult('monto_invertido')}, valor_actual = ${multNull('valor_actual')}, id_moneda = ? WHERE id_usuario = ?`, [m, idUsuario]);
    await conexion.query(`UPDATE rendimientos_inversion r JOIN inversiones i ON i.id_inversion = r.id_inversion SET r.monto = ${mult('r.monto')} WHERE i.id_usuario = ?`, [idUsuario]);
}

// PUT /perfil
router.put('/', async (req, res) => {
    try {
        const nombres = texto(req.body.nombres, 80);
        const apellidos = texto(req.body.apellidos, 80);
        const auxiliar = texto(req.body.correo_auxiliar, 150);
        const telefono = texto(req.body.telefono, 20);
        const nacimiento = req.body.fecha_nacimiento || null;
        const meta = numero(req.body.porcentaje_ahorro_meta) ?? 10;
        const moneda = numero(req.body.id_moneda);
        const tema = req.body.tema === 'oscuro' ? 'oscuro' : 'claro';
        if (rechazar(res, !nombres || !apellidos, 'Escribe tus nombres y apellidos')) return;
        if (rechazar(res, auxiliar && !REGEX_CORREO.test(auxiliar), 'El correo auxiliar no es válido')) return;
        if (rechazar(res, telefono && !/^[0-9+\s-]{7,20}$/.test(telefono), 'El teléfono no es válido')) return;
        if (rechazar(res, nacimiento && (!esFecha(nacimiento) || nacimiento > new Date().toISOString().slice(0, 10)), 'La fecha de nacimiento no es válida')) return;
        if (rechazar(res, !(meta >= 0 && meta <= 100), 'La meta de ahorro debe estar entre 0% y 100%')) return;
        const [m] = await connection.query('SELECT 1 FROM monedas WHERE id_moneda = ? AND activa = 1', [moneda]);
        if (rechazar(res, !m.length, 'Moneda no válida')) return;

        const cambiaMoneda = Number(moneda) !== req.usuario.id_moneda;
        let mensajeMoneda = '';
        const conexion = await connection.getConnection();
        try {
            await conexion.beginTransaction();
            if (cambiaMoneda && req.body.convertir === true) {
                const [tasas] = await conexion.query('SELECT id_moneda, codigo, tasa_cambio_usd FROM monedas WHERE id_moneda IN (?, ?)', [req.usuario.id_moneda, moneda]);
                const vieja = tasas.find((t) => t.id_moneda === req.usuario.id_moneda);
                const nueva = tasas.find((t) => t.id_moneda === Number(moneda));
                const factor = nueva.tasa_cambio_usd / vieja.tasa_cambio_usd;
                await convertirValores(conexion, req.usuario.id_usuario, factor, Number(moneda));
                mensajeMoneda = ` Convertimos tus valores de ${vieja.codigo} a ${nueva.codigo} (1 ${vieja.codigo} = ${factor.toLocaleString('es-CO', { maximumSignificantDigits: 6 })} ${nueva.codigo}).`;
            }
            await conexion.query(
                `UPDATE usuarios SET nombres = ?, apellidos = ?, correo_auxiliar = ?, telefono = ?, fecha_nacimiento = ?,
                        porcentaje_ahorro_meta = ?, id_moneda = ?, tema = ? WHERE id_usuario = ?`,
                [nombres, apellidos, auxiliar, telefono, nacimiento, meta, moneda, tema, req.usuario.id_usuario]
            );
            await conexion.commit();
        } catch (e) {
            await conexion.rollback().catch(() => {});
            throw e;
        } finally {
            conexion.release();
        }
        res.json({ message: 'Perfil actualizado.' + mensajeMoneda, convertido: !!mensajeMoneda });
    } catch (error) {
        errorServidor(res, 'Guardando perfil', error, 'No se pudo guardar tu perfil');
    }
});

// POST /perfil/foto (multipart, campo "foto") -> guarda la foto de perfil
const TIPOS_FOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const FIRMAS = { jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] };

async function borrarFotoLocal(ruta) {
    if (ruta && /^\/uploads\/perfil-[\w.-]+$/.test(ruta)) await fs.unlink(path.join(carpetaUploads, path.basename(ruta))).catch(() => {});
}

router.post('/foto', async (req, res) => {
    try {
        const archivo = req.files?.foto;
        if (rechazar(res, !archivo, 'Elige una imagen')) return;
        const ext = TIPOS_FOTO[archivo.mimetype];
        if (rechazar(res, !ext, 'Solo se permiten imágenes JPG, PNG o WEBP')) return;
        if (rechazar(res, archivo.size > 2 * 1024 * 1024 || archivo.truncated, 'La imagen no puede pesar más de 2 MB')) return;
        if (rechazar(res, !FIRMAS[ext].every((b, i) => archivo.data[i] === b), 'El archivo no parece una imagen válida')) return;

        const [[u]] = await connection.query('SELECT foto_perfil FROM usuarios WHERE id_usuario = ?', [req.usuario.id_usuario]);
        const nombre = `perfil-${req.usuario.id_usuario}-${Date.now()}.${ext}`;
        await fs.writeFile(path.join(carpetaUploads, nombre), archivo.data);
        await connection.query('UPDATE usuarios SET foto_perfil = ? WHERE id_usuario = ?', [`/uploads/${nombre}`, req.usuario.id_usuario]);
        await borrarFotoLocal(u.foto_perfil);
        res.json({ foto: `/uploads/${nombre}`, message: 'Foto de perfil actualizada' });
    } catch (error) {
        errorServidor(res, 'Subiendo foto', error, 'No se pudo guardar la foto');
    }
});

// DELETE /perfil/foto
router.delete('/foto', async (req, res) => {
    try {
        const [[u]] = await connection.query('SELECT foto_perfil FROM usuarios WHERE id_usuario = ?', [req.usuario.id_usuario]);
        await connection.query('UPDATE usuarios SET foto_perfil = NULL WHERE id_usuario = ?', [req.usuario.id_usuario]);
        await borrarFotoLocal(u.foto_perfil);
        res.json({ message: 'Foto eliminada' });
    } catch (error) {
        errorServidor(res, 'Eliminando foto', error);
    }
});

// PUT /perfil/contrasena { actual, nueva }
router.put('/contrasena', async (req, res) => {
    try {
        const actual = String(req.body.actual || '');
        const nueva = String(req.body.nueva || '');
        if (rechazar(res, nueva.length < 8 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva), 'La nueva contraseña debe tener mínimo 8 caracteres, con letras y números')) return;
        const [[u]] = await connection.query('SELECT contrasena_hash FROM usuarios WHERE id_usuario = ?', [req.usuario.id_usuario]);
        if (rechazar(res, !(await verificar(actual, u.contrasena_hash)), 'La contraseña actual no es correcta')) return;
        await connection.query('UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?', [await encriptar(nueva), req.usuario.id_usuario]);
        // Cierra las demás sesiones por seguridad
        await connection.query('UPDATE sesiones SET cerrada_en = NOW() WHERE id_usuario = ? AND token_sesion <> ? AND cerrada_en IS NULL', [req.usuario.id_usuario, req.token]);
        res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
        errorServidor(res, 'Cambiando contraseña', error, 'No se pudo cambiar la contraseña');
    }
});

// POST /perfil/cerrar-otras-sesiones
router.post('/cerrar-otras-sesiones', async (req, res) => {
    try {
        await connection.query('UPDATE sesiones SET cerrada_en = NOW() WHERE id_usuario = ? AND token_sesion <> ? AND cerrada_en IS NULL', [req.usuario.id_usuario, req.token]);
        res.json({ message: 'Otras sesiones cerradas' });
    } catch (error) {
        errorServidor(res, 'Cerrando sesiones', error);
    }
});

export default router;
