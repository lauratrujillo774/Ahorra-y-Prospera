// Lista los usuarios de la base a la que apuntan las variables MYSQL_* (por ejemplo Aiven) y, con --enviar,
// manda un correo de prueba a cada uno. Uso: npm run revisar-usuarios [-- --enviar]
import { connection } from '../src/config/mysql/dbmysql.js';
import { enviarCorreo, plantillaAlerta, correoConfigurado } from '../src/servicios/correo.js';

console.log(`Base de datos: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`);
const [usuarios] = await connection.query('SELECT id_usuario, nombres, correo, estado, creado_en FROM usuarios ORDER BY id_usuario');
console.table(usuarios);

if (process.argv.includes('--enviar')) {
    if (!correoConfigurado()) {
        console.log('Falta configurar el correo (APPS_SCRIPT_*, BREVO_* o SMTP_*).');
    } else {
        for (const u of usuarios.filter((x) => x.estado === 'activo')) {
            const ok = await enviarCorreo({
                para: u.correo,
                asunto: 'Prueba de alertas · Ahorra y Prospera',
                html: plantillaAlerta({ nombre: u.nombres, titulo: 'Prueba de alertas', mensaje: 'Si ves este correo, tus alertas llegarán a esta dirección.' }),
                texto: 'Prueba de alertas: si ves este correo, tus alertas llegarán a esta dirección.',
            });
            console.log(`${ok ? '✅' : '❌'} ${u.correo}`);
        }
    }
}
process.exit(0);
