import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { resumenContexto, responderInversiones } from '../../servicios/asesorInversiones.js';
import { cuota, registrarConsulta } from '../../servicios/cuotaIA.js';
import { iaDisponible } from '../../servicios/ia.js';
import { errorServidor, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);

// GET /chat/estado -> si hay IA y cuántas consultas le quedan hoy al usuario
router.get('/estado', async (req, res) => {
    try {
        const c = await cuota(req.usuario.id_usuario);
        res.json({ ia: iaDisponible(), limite: c.limite, restantes: c.restantes });
    } catch (error) {
        errorServidor(res, 'Estado del chat', error);
    }
});

// POST /chat/inversiones { mensaje, historial: [{ rol: 'user'|'assistant', texto }] }
router.post('/inversiones', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        const mensaje = String(req.body.mensaje || '').trim().slice(0, 1000);
        if (rechazar(res, !mensaje, 'Escribe tu pregunta')) return;
        const historial = Array.isArray(req.body.historial) ? req.body.historial.slice(-12) : [];

        const [inversiones] = await connection.query(
            `SELECT nombre, tipo, nivel_riesgo, monto_invertido, valor_actual, rendimiento_pct FROM vista_rendimiento_inversiones WHERE id_usuario = ? AND estado = 'activa'`, [id]
        );
        const [[g]] = await connection.query(
            `SELECT COALESCE(SUM(r.monto), 0) AS total FROM rendimientos_inversion r JOIN inversiones i ON i.id_inversion = r.id_inversion WHERE i.id_usuario = ?`, [id]
        );
        const [[mes]] = await connection.query(
            `SELECT COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS ingresos,
                    COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS gastos,
                    COALESCE((SELECT SUM(saldo_pendiente) FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'), 0) AS deudas,
                    COALESCE((SELECT SUM(monto_actual) FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada'), 0) AS ahorro`, [id, id, id, id]
        );

        // Con la IA se respeta el límite diario; al agotarse sigue el asesor básico (sin costo)
        const antes = await cuota(id);
        const resultado = await responderInversiones({ mensaje, historial, contexto: resumenContexto(inversiones, g.total, mes), usarIA: iaDisponible() && antes.puede });
        if (resultado.modo === 'ia') await registrarConsulta(id, resultado.proveedor);

        res.json({ ...resultado, limite: antes.limite, restantes: Math.max(0, antes.restantes - (resultado.modo === 'ia' ? 1 : 0)), limiteAlcanzado: iaDisponible() && !antes.puede });
    } catch (error) {
        errorServidor(res, 'Chat financiero', error, 'El asesor no pudo responder en este momento');
    }
});

export default router;
