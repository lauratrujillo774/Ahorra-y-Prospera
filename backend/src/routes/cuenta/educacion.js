import { Router } from 'express';
import { connection } from '../../config/mysql/dbmysql.js';
import { requiereSesion } from '../../middleware/sesion.js';
import { otorgarLogro } from '../../servicios/logros.js';
import { analizarSituacion, generarLeccion, generarQuiz, temasRecomendados, TEMAS_QUIZ } from '../../servicios/educacionIA.js';
import { cuota, registrarConsulta } from '../../servicios/cuotaIA.js';
import { iaDisponible } from '../../servicios/ia.js';
import { sembrarContenidoEducativo } from '../../servicios/contenidoEducativo.js';
import { errorServidor, numero, rechazar } from '../../utils/validar.js';

const router = Router();
router.use(requiereSesion);
sembrarContenidoEducativo();

// GET /educacion -> contenidos publicados con el progreso del usuario
router.get('/', async (req, res) => {
    try {
        const [lista] = await connection.query(
            `SELECT c.id_contenido, c.titulo, c.resumen, c.contenido, c.tipo, c.tema, c.nivel, c.url_recurso,
                    COALESCE(p.porcentaje, 0) AS porcentaje, COALESCE(p.completado, 0) AS completado
               FROM contenido_educativo c LEFT JOIN progreso_educativo p ON p.id_contenido = c.id_contenido AND p.id_usuario = ?
              WHERE c.publicado = 1 ORDER BY c.tema, FIELD(c.nivel, 'basico', 'intermedio', 'avanzado'), c.id_contenido`,
            [req.usuario.id_usuario]
        );
        res.json(lista.map((c) => ({ ...c, completado: !!c.completado })));
    } catch (error) {
        errorServidor(res, 'Listando educación', error, 'No se pudo cargar el contenido');
    }
});

// PUT /educacion/:id/progreso { porcentaje: 0-100 }
router.put('/:id/progreso', async (req, res) => {
    try {
        const porcentaje = numero(req.body.porcentaje);
        if (rechazar(res, porcentaje === null || !(porcentaje >= 0 && porcentaje <= 100), 'El porcentaje debe estar entre 0 y 100')) return;
        const [c] = await connection.query('SELECT 1 FROM contenido_educativo WHERE id_contenido = ? AND publicado = 1', [req.params.id]);
        if (rechazar(res, !c.length, 'Contenido no encontrado')) return;
        const completado = porcentaje >= 100 ? 1 : 0;
        await connection.query(
            `INSERT INTO progreso_educativo (id_usuario, id_contenido, porcentaje, completado) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE porcentaje = VALUES(porcentaje), completado = VALUES(completado)`,
            [req.usuario.id_usuario, req.params.id, porcentaje, completado]
        );
        if (completado) await otorgarLogro(req.usuario.id_usuario, 'Estudiante financiero');
        res.json({ message: completado ? '¡Lección completada! 🎓' : 'Progreso guardado', completado: !!completado });
    } catch (error) {
        errorServidor(res, 'Guardando progreso', error, 'No se pudo guardar tu progreso');
    }
});

// GET /educacion/personalizado -> lecciones recomendadas según la situación financiera del usuario
router.get('/personalizado', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        const situacion = await analizarSituacion(id);
        const temas = temasRecomendados(situacion);
        const recomendados = [];
        for (const t of temas) {
            const [lecciones] = await connection.query(
                `SELECT c.id_contenido, c.titulo, c.resumen, c.contenido, c.tipo, c.tema, c.nivel, c.url_recurso,
                        COALESCE(p.porcentaje, 0) AS porcentaje, COALESCE(p.completado, 0) AS completado
                   FROM contenido_educativo c LEFT JOIN progreso_educativo p ON p.id_contenido = c.id_contenido AND p.id_usuario = ?
                  WHERE c.publicado = 1 AND c.tema = ? ORDER BY COALESCE(p.completado, 0), FIELD(c.nivel, 'basico', 'intermedio', 'avanzado') LIMIT 2`, [id, t.tema]
            );
            for (const l of lecciones) {
                if (!recomendados.some((r) => r.id_contenido === l.id_contenido)) recomendados.push({ ...l, completado: !!l.completado, razon: t.razon });
            }
        }
        res.json({
            situacion: {
                ingresos: situacion.ingresos, gastos: situacion.gastos, deudas: situacion.deudas, ahorro: situacion.ahorro,
                mesesFondo: situacion.mesesFondo, inversiones: situacion.inversiones, tienePresupuesto: !!situacion.presupuesto,
            },
            temas, recomendados, temasQuiz: TEMAS_QUIZ, ia: iaDisponible(),
        });
    } catch (error) {
        errorServidor(res, 'Educación personalizada', error, 'No se pudo preparar tu educación personalizada');
    }
});

// POST /educacion/leccion-ia { tema? } -> mini-lección generada para el usuario (IA si hay; si no, una lección armada con sus datos)
router.post('/leccion-ia', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        const tema = TEMAS_QUIZ.includes(req.body.tema) ? req.body.tema : null;
        const [situacion, c] = await Promise.all([analizarSituacion(id), cuota(id)]);
        const leccion = await generarLeccion(situacion, tema, iaDisponible() && c.puede);
        if (leccion.modo === 'ia') await registrarConsulta(id, leccion.proveedor);
        res.json({ ...leccion, restantes: Math.max(0, c.restantes - (leccion.modo === 'ia' ? 1 : 0)), limite: c.limite });
    } catch (error) {
        errorServidor(res, 'Lección con IA', error, 'No se pudo generar la lección');
    }
});

// POST /educacion/quiz { tema } -> actividad de 3 preguntas
router.post('/quiz', async (req, res) => {
    try {
        const id = req.usuario.id_usuario;
        const [situacion, c] = await Promise.all([analizarSituacion(id), cuota(id)]);
        const quiz = await generarQuiz(req.body.tema, situacion, iaDisponible() && c.puede);
        if (quiz.modo === 'ia') await registrarConsulta(id, quiz.proveedor);
        res.json({ ...quiz, restantes: Math.max(0, c.restantes - (quiz.modo === 'ia' ? 1 : 0)), limite: c.limite });
    } catch (error) {
        errorServidor(res, 'Quiz', error, 'No se pudo preparar la actividad');
    }
});

export default router;
