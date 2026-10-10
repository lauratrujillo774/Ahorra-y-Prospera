import { connection } from '../config/mysql/dbmysql.js';

// Busca al usuario dueño del token (Authorization: Bearer <token>) en la tabla sesiones
export async function requiereSesion(req, res, next) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!/^[0-9a-f]{64}$/.test(token)) {
        return res.status(401).json({ message: 'Debes iniciar sesión' });
    }
    try {
        const [filas] = await connection.query(
            `SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.tema, u.idioma, u.id_rol, u.id_moneda, u.foto_perfil,
                    m.codigo AS moneda, m.simbolo AS simbolo_moneda
               FROM sesiones s
               JOIN usuarios u ON u.id_usuario = s.id_usuario
               JOIN monedas m ON m.id_moneda = u.id_moneda
              WHERE s.token_sesion = ? AND s.cerrada_en IS NULL AND u.estado = 'activo'`,
            [token]
        );
        if (!filas.length) {
            return res.status(401).json({ message: 'Tu sesión expiró, inicia sesión de nuevo' });
        }
        await connection.query('UPDATE sesiones SET ultima_actividad = NOW() WHERE token_sesion = ?', [token]);
        req.token = token;
        req.usuario = filas[0];
        next();
    } catch (error) {
        console.error('Error validando la sesión:', error.message);
        res.status(500).json({ message: 'Error del servidor' });
    }
}
