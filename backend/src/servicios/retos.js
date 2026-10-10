import { connection } from '../config/mysql/dbmysql.js';
import { emitirEvento } from './n8n.js';

// Calcula el progreso (0 a 100) de un reto con los movimientos reales del usuario
async function progresoDe(idUsuario, reto, inicio) {
    const dias = Math.max(0, Math.floor((Date.now() - new Date(inicio + 'T00:00:00').getTime()) / 86400000));
    const tope = (v) => Math.max(0, Math.min(100, v));

    switch (reto.id_reto) {
        case 1: { // 30 días sin gastos hormiga: sin compras impulsivas durante el periodo
            const [[g]] = await connection.query(
                `SELECT MAX(g.fecha) AS ultima FROM gastos g JOIN categorias c ON c.id_categoria = g.id_categoria
                  WHERE g.id_usuario = ? AND c.nombre = 'Compras impulsivas' AND g.fecha >= ?`, [idUsuario, inicio]
            );
            const desde = g.ultima || inicio;
            const limpios = Math.max(0, Math.floor((Date.now() - new Date(desde + 'T00:00:00').getTime()) / 86400000));
            return tope((limpios / reto.duracion_dias) * 100);
        }
        case 2: { // Reto del 10%: aportar a metas el 10% de lo que ingresa
            const [[a]] = await connection.query(
                `SELECT COALESCE(SUM(ap.monto), 0) AS total FROM aportes_ahorro ap JOIN metas_ahorro m ON m.id_meta = ap.id_meta WHERE m.id_usuario = ? AND ap.fecha >= ?`, [idUsuario, inicio]
            );
            const [[i]] = await connection.query('SELECT COALESCE(SUM(monto), 0) AS total FROM ingresos WHERE id_usuario = ? AND fecha >= ?', [idUsuario, inicio]);
            return i.total > 0 ? tope((a.total / (i.total * 0.1)) * 100) : 0;
        }
        case 3: { // 52 semanas: semanas distintas con al menos un aporte
            const [[s]] = await connection.query(
                `SELECT COUNT(DISTINCT YEARWEEK(ap.fecha, 1)) AS semanas FROM aportes_ahorro ap JOIN metas_ahorro m ON m.id_meta = ap.id_meta WHERE m.id_usuario = ? AND ap.fecha >= ?`, [idUsuario, inicio]
            );
            return tope((s.semanas / 52) * 100);
        }
        case 4: { // Fondo de emergencia: ahorro total frente a un mes de gastos
            const [[ah]] = await connection.query(
                `SELECT (SELECT COALESCE(SUM(monto_actual), 0) FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada') +
                        (SELECT COALESCE(SUM(saldo), 0) FROM cuentas_ahorro WHERE id_usuario = ?) AS total`, [idUsuario, idUsuario]
            );
            const [[g]] = await connection.query(
                `SELECT COALESCE(SUM(monto), 0) / GREATEST(1, COUNT(DISTINCT DATE_FORMAT(fecha, '%Y-%m'))) AS mensual FROM gastos
                  WHERE id_usuario = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`, [idUsuario]
            );
            return g.mensual > 0 ? tope((ah.total / g.mensual) * 100) : 0;
        }
        case 5: { // Aprende y crece: 3 contenidos completados durante el reto
            const [[e]] = await connection.query(
                'SELECT COUNT(*) AS n FROM progreso_educativo WHERE id_usuario = ? AND completado = 1 AND ultimo_acceso >= ?', [idUsuario, inicio]
            );
            return tope((e.n / 3) * 100);
        }
        case 6: { // Pago extra de deuda: un abono al menos igual a la cuota
            const [[p]] = await connection.query(
                `SELECT COUNT(*) AS n FROM pagos_deuda pd JOIN deudas d ON d.id_deuda = pd.id_deuda
                  WHERE d.id_usuario = ? AND pd.fecha_pago >= ? AND pd.monto >= COALESCE(d.cuota_mensual, 0)`, [idUsuario, inicio]
            );
            return p.n > 0 ? 100 : 0;
        }
        default:
            return tope((dias / reto.duracion_dias) * 100);
    }
}

// Pone al día el progreso de todos los retos en curso del usuario (y los completa o cierra si corresponde)
export async function actualizarRetos(idUsuario) {
    try {
        const [activos] = await connection.query(
            `SELECT ur.id_usuario_reto, ur.id_reto, DATE_FORMAT(ur.fecha_inicio, '%Y-%m-%d') AS inicio, ur.progreso, r.titulo, r.puntos, r.duracion_dias,
                    DATEDIFF(CURDATE(), ur.fecha_inicio) AS dias
               FROM usuario_retos ur JOIN retos_financieros r ON r.id_reto = ur.id_reto WHERE ur.id_usuario = ? AND ur.estado = 'en_curso'`, [idUsuario]
        );
        for (const r of activos) {
            const progreso = Math.round((await progresoDe(idUsuario, r, r.inicio)) * 100) / 100;
            if (progreso >= 100) {
                await connection.query("UPDATE usuario_retos SET progreso = 100, estado = 'completado' WHERE id_usuario_reto = ?", [r.id_usuario_reto]);
                await connection.query("INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'reto', ?, ?)",
                    [idUsuario, `¡Reto completado: ${r.titulo}!`, `Ganaste ${r.puntos} puntos.`]);
                emitirEvento('reto_completado', { id_usuario: idUsuario, reto: r.titulo, puntos: r.puntos });
            } else if (r.dias > r.duracion_dias) {
                await connection.query("UPDATE usuario_retos SET progreso = ?, estado = 'abandonado' WHERE id_usuario_reto = ?", [progreso, r.id_usuario_reto]);
                await connection.query("INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'reto', ?, ?)",
                    [idUsuario, `El reto "${r.titulo}" terminó`, `Llegaste al ${Math.round(progreso)}%. ¡Puedes intentarlo otra vez!`]);
            } else if (Math.abs(progreso - r.progreso) > 0.001) {
                await connection.query('UPDATE usuario_retos SET progreso = ? WHERE id_usuario_reto = ?', [progreso, r.id_usuario_reto]);
            }
        }
    } catch (error) {
        console.error('Error actualizando retos:', error.message);
    }
}
