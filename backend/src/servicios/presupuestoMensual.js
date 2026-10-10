import { connection } from '../config/mysql/dbmysql.js';

// Cada mes necesita su presupuesto: si el usuario no creó uno para el mes actual,
// se copia el más reciente que haya guardado (así el presupuesto "continúa" mes a mes).
// Devuelve el periodo del que se copió, o null si no había nada que copiar o ya existía.
export async function heredarPresupuesto(idUsuario, anio, mes) {
    const [existe] = await connection.query('SELECT 1 FROM presupuestos WHERE id_usuario = ? AND anio = ? AND mes = ?', [idUsuario, anio, mes]);
    if (existe.length) return null;

    const [previo] = await connection.query(
        `SELECT id_presupuesto, anio, mes, monto_total, umbral_alerta FROM presupuestos
          WHERE id_usuario = ? AND (anio < ? OR (anio = ? AND mes < ?)) ORDER BY anio DESC, mes DESC LIMIT 1`,
        [idUsuario, anio, anio, mes]
    );
    if (!previo.length) return null;

    const p = previo[0];
    const [r] = await connection.query(
        'INSERT IGNORE INTO presupuestos (id_usuario, anio, mes, monto_total, umbral_alerta, generado_automaticamente) VALUES (?, ?, ?, ?, ?, 0)',
        [idUsuario, anio, mes, p.monto_total, p.umbral_alerta]
    );
    if (!r.affectedRows) return null;
    await connection.query(
        'INSERT INTO presupuesto_categorias (id_presupuesto, id_categoria, monto_limite) SELECT ?, id_categoria, monto_limite FROM presupuesto_categorias WHERE id_presupuesto = ?',
        [r.insertId, p.id_presupuesto]
    );
    await connection.query(
        "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'sistema', 'Tu presupuesto del nuevo mes está listo', 'Copiamos tu presupuesto del mes anterior. Puedes ajustarlo o pedirle una sugerencia a la IA.')",
        [idUsuario]
    );
    return { anio: p.anio, mes: p.mes };
}
