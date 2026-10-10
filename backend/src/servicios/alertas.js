import { connection } from '../config/mysql/dbmysql.js';
import { enviarCorreo, plantillaAlerta } from './correo.js';
import { emitirEvento } from './n8n.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NIVEL_QUEDA_POCO = 80; // % de los ingresos gastado a partir del cual se avisa que queda poco

// Crea la alerta en la campanita y la envía por correo, una sola vez por mes para el mismo título
export async function alertar(usuario, { tipo, titulo, mensaje, nivel }) {
    const [ya] = await connection.query(
        "SELECT 1 FROM notificaciones WHERE id_usuario = ? AND titulo = ? AND DATE_FORMAT(creada_en, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') LIMIT 1",
        [usuario.id_usuario, titulo]
    );
    if (ya.length) return;
    await connection.query('INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, ?, ?, ?)', [usuario.id_usuario, tipo, titulo, mensaje]);
    emitirEvento('alerta', { usuario: { id: usuario.id_usuario, nombres: usuario.nombres, correo: usuario.correo }, tipo, nivel, titulo, mensaje });
    // El correo no bloquea la respuesta de la app
    enviarCorreo({
        para: usuario.correo,
        asunto: `${titulo} · Ahorra y Prospera`,
        html: plantillaAlerta({ nombre: usuario.nombres, titulo, mensaje, nivel }),
        texto: `${titulo}\n\n${mensaje}`,
    });
}

// Revisa ingresos vs. gastos del mes y el presupuesto (total y por categoría) y avisa cuando corresponde
export async function evaluarAlertasFinancieras(idUsuario) {
    try {
        const [[usuario]] = await connection.query(
            `SELECT u.id_usuario, u.nombres, u.correo, m.simbolo FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda
              WHERE u.id_usuario = ? AND u.estado = 'activo'`, [idUsuario]
        ).then(([r]) => [r.length ? r : [undefined]]);
        if (!usuario) return;
        const dinero = (n) => usuario.simbolo + Math.round(n).toLocaleString('es-CO');
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = ahora.getMonth() + 1;
        const nombreMes = `${MESES[mes - 1]} de ${anio}`;

        const [[tot]] = await connection.query(
            `SELECT COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = ? AND YEAR(fecha) = ? AND MONTH(fecha) = ?), 0) AS ingresos,
                    COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = ? AND YEAR(fecha) = ? AND MONTH(fecha) = ?), 0) AS gastos`,
            [idUsuario, anio, mes, idUsuario, anio, mes]
        );

        // 1) Relación ingresos vs. gastos
        if (tot.ingresos > 0) {
            const pct = (tot.gastos / tot.ingresos) * 100;
            if (pct >= 100) {
                await alertar(usuario, { tipo: 'exceso_gasto', nivel: 'critico', titulo: `Ya gastaste todos tus ingresos de ${nombreMes}`,
                    mensaje: `Tus gastos (${dinero(tot.gastos)}) igualan o superan tus ingresos del mes (${dinero(tot.ingresos)}). Evita nuevos gastos que no sean necesarios.` });
            } else if (pct >= NIVEL_QUEDA_POCO) {
                await alertar(usuario, { tipo: 'exceso_gasto', nivel: 'critico', titulo: `Te queda poco de tus ingresos de ${nombreMes}`,
                    mensaje: `Ya gastaste el ${Math.round(pct)}% de tus ingresos y solo te quedan ${dinero(tot.ingresos - tot.gastos)} para el resto del mes.` });
            }
        }

        // 2) Presupuesto total y por categoría
        const [[pres]] = await connection.query(
            'SELECT monto_total, umbral_alerta FROM presupuestos WHERE id_usuario = ? AND anio = ? AND mes = ?', [idUsuario, anio, mes]
        ).then(([r]) => [r.length ? r : [undefined]]);
        if (pres) {
            const pct = (tot.gastos / pres.monto_total) * 100;
            if (pct >= 100) {
                await alertar(usuario, { tipo: 'exceso_gasto', nivel: 'critico', titulo: `Superaste tu presupuesto de ${nombreMes}`,
                    mensaje: `Llevas ${dinero(tot.gastos)} gastados y tu presupuesto era de ${dinero(pres.monto_total)}.` });
            } else if (pct >= pres.umbral_alerta) {
                await alertar(usuario, { tipo: 'exceso_gasto', nivel: 'aviso', titulo: `Presupuesto de ${nombreMes}: llegaste al ${pres.umbral_alerta}%`,
                    mensaje: `Ya usaste el ${Math.round(pct)}% de tu presupuesto (${dinero(tot.gastos)} de ${dinero(pres.monto_total)}). Te quedan ${dinero(pres.monto_total - tot.gastos)}.` });
            }
            const [cats] = await connection.query(
                `SELECT categoria, monto_limite, gastado, porcentaje_uso, umbral_alerta FROM vista_uso_presupuesto
                  WHERE id_usuario = ? AND anio = ? AND mes = ? AND porcentaje_uso >= umbral_alerta`, [idUsuario, anio, mes]
            );
            for (const c of cats) {
                if (c.porcentaje_uso >= 100) {
                    await alertar(usuario, { tipo: 'exceso_gasto', nivel: 'critico', titulo: `Superaste el límite de ${c.categoria}`,
                        mensaje: `Gastaste ${dinero(c.gastado)} en ${c.categoria} y tu límite era ${dinero(c.monto_limite)}.` });
                } else {
                    await alertar(usuario, { tipo: 'exceso_gasto', nivel: 'aviso', titulo: `${c.categoria}: llegaste al ${c.umbral_alerta}% de tu límite`,
                        mensaje: `Llevas ${dinero(c.gastado)} de ${dinero(c.monto_limite)} (${Math.round(c.porcentaje_uso)}%). Te quedan ${dinero(c.monto_limite - c.gastado)}.` });
                }
            }
        }
    } catch (error) {
        console.error('Error evaluando alertas:', error.message);
    }
}

// Aviso (campanita + correo) cuando se guarda un presupuesto generado con IA; incluye el resumen por categoría
export async function notificarPresupuestoGenerado(idUsuario, { anio, mes, total, umbral, filas }) {
    try {
        const [[usuario]] = await connection.query(
            'SELECT u.id_usuario, u.nombres, u.correo, m.simbolo FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda WHERE u.id_usuario = ?', [idUsuario]
        ).then(([r]) => [r.length ? r : [undefined]]);
        if (!usuario) return;
        const dinero = (n) => usuario.simbolo + Math.round(n).toLocaleString('es-CO');
        const titulo = `Tu presupuesto con IA de ${MESES[mes - 1]} de ${anio} está listo`;
        const mensaje = `Tu presupuesto total es ${dinero(total)}, repartido en ${filas.length} categoría(s). Te avisaremos al llegar al ${umbral}% de uso.`;
        await connection.query("INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje) VALUES (?, 'sistema', ?, ?)", [idUsuario, titulo, mensaje]);
        emitirEvento('presupuesto_generado', { usuario: { id: idUsuario, nombres: usuario.nombres, correo: usuario.correo }, anio, mes, total, categorias: filas.length, titulo, mensaje });
        enviarCorreo({
            para: usuario.correo,
            asunto: `${titulo} · Ahorra y Prospera`,
            html: plantillaAlerta({ nombre: usuario.nombres, titulo, mensaje, filas: filas.map((f) => ({ nombre: f.nombre, valor: dinero(f.valor) })), boton: 'Ver mi presupuesto' }),
            texto: `${titulo}\n\n${mensaje}\n\n` + filas.map((f) => `- ${f.nombre}: ${dinero(f.valor)}`).join('\n'),
        });
    } catch (error) {
        console.error('Error avisando del presupuesto generado:', error.message);
    }
}

// Pagos programados que vencen en 2 días o menos (o ya vencidos): campanita + correo, una sola vez por pago
export async function alertarPagosProximos(idUsuario) {
    try {
        const [[usuario]] = await connection.query(
            "SELECT u.id_usuario, u.nombres, u.correo, m.simbolo FROM usuarios u JOIN monedas m ON m.id_moneda = u.id_moneda WHERE u.id_usuario = ? AND u.estado = 'activo'", [idUsuario]
        ).then(([r]) => [r.length ? r : [undefined]]);
        if (!usuario) return;
        const [pagos] = await connection.query(
            `SELECT concepto, monto, DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha, DATEDIFF(fecha_pago, CURDATE()) AS dias
               FROM pagos_programados WHERE id_usuario = ? AND estado = 'programado' AND DATEDIFF(fecha_pago, CURDATE()) <= 2`, [idUsuario]
        );
        for (const p of pagos) {
            const valor = usuario.simbolo + Math.round(p.monto).toLocaleString('es-CO');
            const cuando = p.dias < 0 ? `venció hace ${-p.dias} día(s)` : p.dias === 0 ? 'vence hoy' : p.dias === 1 ? 'vence mañana' : 'vence en 2 días';
            await alertar(usuario, {
                tipo: 'vencimiento_pago', nivel: p.dias <= 0 ? 'critico' : 'aviso',
                titulo: `${p.dias < 0 ? 'Pago vencido' : 'Pago próximo'}: ${p.concepto} (${p.fecha})`,
                mensaje: `Tu pago de ${valor} por "${p.concepto}" ${cuando}. Cuando lo hagas, márcalo como pagado y se registrará en tus gastos.`,
            });
        }
    } catch (error) {
        console.error('Error alertando pagos próximos:', error.message);
    }
}
