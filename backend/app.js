import './src/config/env.js';
import { dbConnectMysql } from './src/config/mysql/dbmysql.js';
import { asegurarEsquema } from './src/servicios/esquema.js';
import { iniciarNotificaciones } from './src/servicios/notificaciones.js';
import { migrar } from './src/servicios/migraciones.js';


async function main() {
    try {
        // Conexión a la base de datos
        await dbConnectMysql();
        // Si la base está vacía (servidor nuevo), se crean las tablas solas antes de cargar las rutas
        await asegurarEsquema();
        await migrar();

        // Se carga después de preparar la base: las rutas consultan tablas al cargarse
        const { default: Server } = await import('./src/server/express.server.js');
        const server = new Server();
        await server.start();

        // Notificaciones (campanita y correo): recordatorios y alimento que se acaba, cada hora
        iniciarNotificaciones();
    } catch (error) {
        console.error('Error al iniciar la aplicación:', error.message);
        process.exit(1);
    }
}

// Manejo de errores e inicio del servidor
main().catch(
    (error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    }
);
