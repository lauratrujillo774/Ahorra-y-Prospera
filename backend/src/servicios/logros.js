import { connection } from '../config/mysql/dbmysql.js';
import { emitirEvento } from './n8n.js';

// Entrega un logro (una sola vez) y avisa al usuario con una notificación
export async function otorgarLogro(idUsuario, nombreLogro) {
    try {
        const [logro] = await connection.query('SELECT id_logro, nombre, puntos FROM logros WHERE nombre = ?', [nombreLogro]);
        if (!logro.length) return false;
        const [r] = await connection.query(
            'INSERT IGNORE INTO usuario_logros (id_usuario, id_logro) VALUES (?, ?)',
            [idUsuario, logro[0].id_logro]
        );
        if (r.affectedRows) {
            await connection.query(
                "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'logro', ?, ?)",
                [idUsuario, `¡Nuevo logro: ${logro[0].nombre}!`, `Ganaste ${logro[0].puntos} puntos.`]
            );
            emitirEvento('logro', { id_usuario: idUsuario, logro: logro[0].nombre, puntos: logro[0].puntos });
            return true;
        }
    } catch (error) {
        console.error('Error otorgando logro:', error.message);
    }
    return false;
}

// Revisa los logros que dependen de los movimientos del usuario
export async function revisarLogrosMovimientos(idUsuario) {
    await otorgarLogro(idUsuario, 'Primer paso');
    try {
        const [meses] = await connection.query(
            `SELECT anio, mes, ingresos, gastos FROM vista_resumen_mensual
              WHERE id_usuario = ? ORDER BY anio DESC, mes DESC LIMIT 3`,
            [idUsuario]
        );
        const ahorra = (m) => m.ingresos > 0 && (m.ingresos - m.gastos) / m.ingresos >= 0.1;
        if (meses[0] && ahorra(meses[0])) await otorgarLogro(idUsuario, 'Primero ahorro, luego gasto');
        if (meses.length === 3 && meses.every((m) => m.ingresos > m.gastos)) await otorgarLogro(idUsuario, 'Constante');
    } catch (error) {
        console.error('Error revisando logros:', error.message);
    }
}

// Niveles por puntos y la pequeña recompensa de cada uno
export const NIVELES = [
    { clave: 'bronce', nombre: 'Ahorrador Bronce', emoji: '🥉', puntos: 50, bonoIA: 10, premio: '+10 consultas al día con el asesor IA' },
    { clave: 'plata', nombre: 'Ahorrador Plata', emoji: '🥈', puntos: 150, bonoIA: 15, premio: '+15 consultas más al día con el asesor IA' },
    { clave: 'oro', nombre: 'Ahorrador Oro', emoji: '🥇', puntos: 300, bonoIA: 25, premio: '+25 consultas más al día con el asesor IA y la insignia dorada' },
];

export async function puntosUsuario(idUsuario) {
    const [[l]] = await connection.query('SELECT COALESCE(SUM(l.puntos), 0) AS p FROM usuario_logros ul JOIN logros l ON l.id_logro = ul.id_logro WHERE ul.id_usuario = ?', [idUsuario]);
    const [[r]] = await connection.query(
        "SELECT COALESCE(SUM(r.puntos), 0) AS p FROM usuario_retos ur JOIN retos_financieros r ON r.id_reto = ur.id_reto WHERE ur.id_usuario = ? AND ur.estado = 'completado'", [idUsuario]
    );
    return { logros: l.p, retos: r.p, total: l.p + r.p };
}

// Estado de niveles y recompensas: nivel actual, siguiente y cuáles se pueden reclamar
export async function estadoRecompensas(idUsuario) {
    const puntos = await puntosUsuario(idUsuario);
    const [reclamadas] = await connection.query('SELECT nivel FROM recompensas_usuario WHERE id_usuario = ?', [idUsuario]);
    const ya = new Set(reclamadas.map((r) => r.nivel));
    const niveles = NIVELES.map((n) => ({ ...n, alcanzado: puntos.total >= n.puntos, reclamada: ya.has(n.clave), disponible: puntos.total >= n.puntos && !ya.has(n.clave) }));
    const alcanzados = niveles.filter((n) => n.alcanzado);
    const siguiente = niveles.find((n) => !n.alcanzado) || null;
    return {
        puntos, niveles, nivelActual: alcanzados[alcanzados.length - 1] || null, siguiente,
        faltan: siguiente ? siguiente.puntos - puntos.total : 0, disponibles: niveles.filter((n) => n.disponible).length,
    };
}

// Consultas extra diarias con la IA que ya reclamó el usuario
export async function bonoIA(idUsuario) {
    const [filas] = await connection.query('SELECT nivel FROM recompensas_usuario WHERE id_usuario = ?', [idUsuario]);
    return filas.reduce((t, f) => t + (NIVELES.find((n) => n.clave === f.nivel)?.bonoIA || 0), 0);
}
