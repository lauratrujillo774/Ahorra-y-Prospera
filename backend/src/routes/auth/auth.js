import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { connection } from '../../config/mysql/dbmysql.js';
import { encriptar, verificar } from '../../utils/contrasenas.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { emitirEvento } from '../../servicios/n8n.js';

const router = Router();

const MAX_INTENTOS = 5;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const datosPublicos = (u) => ({
    id: u.id_usuario,
    nombres: u.nombres,
    apellidos: u.apellidos,
    correo: u.correo,
    tema: u.tema,
    foto: u.foto_perfil || null,
    moneda: u.moneda,
    simbolo_moneda: u.simbolo_moneda,
});

// Crea una sesión en la tabla sesiones y devuelve su token
async function abrirSesion(req, idUsuario) {
    const token = randomBytes(32).toString('hex'); // 64 caracteres
    await connection.query(
        'INSERT INTO sesiones (id_usuario, token_sesion, ip, navegador) VALUES (?, ?, ?, ?)',
        [idUsuario, token, (req.ip || '').slice(0, 45), (req.headers['user-agent'] || '').slice(0, 255)]
    );
    await connection.query('UPDATE usuarios SET ultimo_acceso = NOW(), intentos_fallidos = 0 WHERE id_usuario = ?', [idUsuario]);
    return token;
}

// GET /auth/monedas -> monedas para elegir al registrarse
router.get('/monedas', async (req, res) => {
    try {
        const [monedas] = await connection.query(
            'SELECT id_moneda, codigo, nombre, simbolo FROM monedas WHERE activa = 1 ORDER BY id_moneda'
        );
        res.json(monedas);
    } catch (error) {
        console.error('Error listando monedas:', error.message);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /auth/registro
router.post('/registro', async (req, res) => {
    try {
        const nombres = String(req.body.nombres || '').trim();
        const apellidos = String(req.body.apellidos || '').trim();
        const correo = String(req.body.correo || '').trim().toLowerCase();
        const contrasena = String(req.body.contrasena || '');
        const idMoneda = Number(req.body.id_moneda) || 1;

        if (!nombres || !apellidos) {
            return res.status(400).json({ message: 'Escribe tus nombres y apellidos' });
        }
        if (nombres.length > 80 || apellidos.length > 80) {
            return res.status(400).json({ message: 'Los nombres y apellidos son demasiado largos' });
        }
        if (!REGEX_CORREO.test(correo) || correo.length > 150) {
            return res.status(400).json({ message: 'Escribe un correo válido' });
        }
        if (contrasena.length < 8 || !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
            return res.status(400).json({ message: 'La contraseña debe tener mínimo 8 caracteres, con letras y números' });
        }

        const [moneda] = await connection.query('SELECT id_moneda FROM monedas WHERE id_moneda = ? AND activa = 1', [idMoneda]);
        if (!moneda.length) {
            return res.status(400).json({ message: 'Moneda no válida' });
        }

        const [existe] = await connection.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
        if (existe.length) {
            return res.status(409).json({ message: 'Ese correo ya está registrado' });
        }

        const hash = await encriptar(contrasena);
        const [resultado] = await connection.query(
            'INSERT INTO usuarios (id_rol, id_moneda, nombres, apellidos, correo, contrasena_hash) VALUES (1, ?, ?, ?, ?, ?)',
            [idMoneda, nombres, apellidos, correo, hash]
        );

        const token = await abrirSesion(req, resultado.insertId);
        emitirEvento('usuario_registrado', { usuario: { id: resultado.insertId, nombres, apellidos, correo }, metodo: 'correo' });
        res.status(201).json({
            message: 'Cuenta creada con éxito',
            token,
            usuario: { id: resultado.insertId, nombres, apellidos, correo },
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ese correo ya está registrado' });
        }
        console.error('Error en el registro:', error.message);
        res.status(500).json({ message: 'No se pudo crear la cuenta' });
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const correo = String(req.body.correo || '').trim().toLowerCase();
        const contrasena = String(req.body.contrasena || '');
        if (!correo || !contrasena) {
            return res.status(400).json({ message: 'Escribe tu correo y contraseña' });
        }

        const [filas] = await connection.query(
            `SELECT u.*, m.codigo AS moneda, m.simbolo AS simbolo_moneda
               FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda
              WHERE u.correo = ?`,
            [correo]
        );
        const usuario = filas[0];
        const mensajeError = 'Correo o contraseña incorrectos';

        if (!usuario) {
            return res.status(401).json({ message: mensajeError });
        }
        if (usuario.estado !== 'activo') {
            return res.status(403).json({ message: 'Tu cuenta está bloqueada o inactiva' });
        }

        if (!(await verificar(contrasena, usuario.contrasena_hash))) {
            const intentos = usuario.intentos_fallidos + 1;
            const bloquear = intentos >= MAX_INTENTOS;
            await connection.query(
                'UPDATE usuarios SET intentos_fallidos = ?, estado = ? WHERE id_usuario = ?',
                [intentos, bloquear ? 'bloqueado' : 'activo', usuario.id_usuario]
            );
            return res.status(bloquear ? 403 : 401).json({
                message: bloquear ? 'Demasiados intentos, tu cuenta fue bloqueada' : mensajeError,
            });
        }

        const token = await abrirSesion(req, usuario.id_usuario);
        res.json({ message: 'Bienvenido', token, usuario: datosPublicos(usuario) });
    } catch (error) {
        console.error('Error en el inicio de sesión:', error.message);
        res.status(500).json({ message: 'No se pudo iniciar sesión' });
    }
});

// GET /auth/config -> datos públicos para el botón de Google (vacío si no está configurado)
router.get('/config', (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// POST /auth/google -> inicia sesión o registra con una cuenta de Google
router.post('/google', async (req, res) => {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const credencial = String(req.body.credential || '');
        if (!clientId) {
            return res.status(503).json({ message: 'El acceso con Google no está configurado' });
        }
        if (!credencial) {
            return res.status(400).json({ message: 'Falta la credencial de Google' });
        }

        // Google valida la firma y la vigencia del token
        const respuesta = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credencial));
        const perfil = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || perfil.aud !== clientId || String(perfil.email_verified) !== 'true' || !perfil.email) {
            return res.status(401).json({ message: 'No se pudo verificar tu cuenta de Google' });
        }

        const correo = String(perfil.email).toLowerCase();
        const [filas] = await connection.query(
            `SELECT u.*, m.codigo AS moneda, m.simbolo AS simbolo_moneda
               FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda
              WHERE u.correo = ?`,
            [correo]
        );

        let usuario = filas[0];
        if (usuario) {
            if (usuario.estado !== 'activo') {
                return res.status(403).json({ message: 'Tu cuenta está bloqueada o inactiva' });
            }
        } else {
            const nombres = String(perfil.given_name || perfil.name || correo.split('@')[0]).slice(0, 80);
            const apellidos = String(perfil.family_name || '-').slice(0, 80);
            const foto = perfil.picture && perfil.picture.length <= 255 ? perfil.picture : null;
            // Contraseña aleatoria imposible de usar: esta cuenta entra solo con Google
            const hash = await encriptar(randomBytes(32).toString('hex'));
            const [resultado] = await connection.query(
                'INSERT INTO usuarios (id_rol, id_moneda, nombres, apellidos, correo, contrasena_hash, foto_perfil) VALUES (1, 1, ?, ?, ?, ?, ?)',
                [nombres, apellidos, correo, hash, foto]
            );
            usuario = { id_usuario: resultado.insertId, nombres, apellidos, correo, tema: 'claro', moneda: 'COP', simbolo_moneda: '$' };
            emitirEvento('usuario_registrado', { usuario: { id: resultado.insertId, nombres, apellidos, correo }, metodo: 'google' });
        }

        const token = await abrirSesion(req, usuario.id_usuario);
        res.json({ message: 'Bienvenido', token, usuario: datosPublicos(usuario) });
    } catch (error) {
        console.error('Error con Google:', error.message);
        res.status(500).json({ message: 'No se pudo iniciar sesión con Google' });
    }
});

// GET /auth/yo -> usuario de la sesión actual
router.get('/yo', requiereSesion, (req, res) => {
    res.json({ usuario: datosPublicos(req.usuario) });
});

// POST /auth/logout
router.post('/logout', requiereSesion, async (req, res) => {
    try {
        await connection.query('UPDATE sesiones SET cerrada_en = NOW() WHERE token_sesion = ?', [req.token]);
        res.json({ message: 'Sesión cerrada' });
    } catch (error) {
        console.error('Error cerrando sesión:', error.message);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

export default router;
