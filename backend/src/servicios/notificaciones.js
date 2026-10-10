import { connection } from '../config/mysql/dbmysql.js';
import { alertarPagosProximos, evaluarAlertasFinancieras } from './alertas.js';
import { heredarPresupuesto } from './presupuestoMensual.js';

// Crea una notificación solo si hoy no existe ya una igual (así no se repiten)
async function avisar(idUsuario, tipo, titulo, mensaje) {
    const [ya] = await connection.query(
        'SELECT 1 FROM notificaciones WHERE id_usuario = ? AND titulo = ? AND mensaje = ? AND DATE(creada_en) = CURDATE() LIMIT 1',
        [idUsuario, titulo, mensaje]
    );
    if (!ya.length) {
        await connection.query('INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, ?, ?, ?)', [idUsuario, tipo, titulo, mensaje]);
    }
}

const dinero = (n) => '$' + Math.round(n).toLocaleString('es-CO');

// Recordatorios de pagos, deudas vencidas, metas próximas y alerta de presupuesto de un usuario
export async function generarNotificaciones(idUsuario) {
    // Pagos que vencen en 2 días o menos: campanita y correo
    await alertarPagosProximos(idUsuario);

    const [deudas] = await connection.query(
        "SELECT acreedor, saldo_pendiente FROM deudas WHERE id_usuario = ? AND estado <> 'pagada' AND fecha_vencimiento < CURDATE()",
        [idUsuario]
    );
    for (const d of deudas) {
        await avisar(idUsuario, 'vencimiento_pago', `Deuda vencida: ${d.acreedor}`, `Aún debes ${dinero(d.saldo_pendiente)}. Contacta al acreedor para renegociar.`);
    }

    const [metas] = await connection.query(
        `SELECT nombre, DATEDIFF(fecha_limite, CURDATE()) AS dias FROM metas_ahorro
          WHERE id_usuario = ? AND estado = 'activa' AND fecha_limite IS NOT NULL AND DATEDIFF(fecha_limite, CURDATE()) BETWEEN 0 AND 15`,
        [idUsuario]
    );
    for (const m of metas) {
        await avisar(idUsuario, 'meta_ahorro', `Tu meta "${m.nombre}" se acerca`, `Faltan ${m.dias} día(s) para la fecha límite.`);
    }

    const hoy = new Date();
    await heredarPresupuesto(idUsuario, hoy.getFullYear(), hoy.getMonth() + 1);

    // Ingresos vs. gastos y presupuesto (campanita + correo, una vez por mes)
    await evaluarAlertasFinancieras(idUsuario);
}

// Cada hora revisa a todos los usuarios activos
export function iniciarNotificaciones() {
    const revisar = async () => {
        try {
            const [usuarios] = await connection.query("SELECT id_usuario FROM usuarios WHERE estado = 'activo'");
            for (const u of usuarios) await generarNotificaciones(u.id_usuario);
        } catch (error) {
            console.error('Error generando notificaciones:', error.message);
        }
    };
    revisar();
    setInterval(revisar, 60 * 60 * 1000).unref();
}
