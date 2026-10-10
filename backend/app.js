import './src/config/env.js';
import Server from './src/server/express.server.js';
import { dbConnectMysql } from './src/config/mysql/dbmysql.js';
import { iniciarNotificaciones } from './src/servicios/notificaciones.js';
import { migrar } from './src/servicios/migraciones.js';


async function main() {
    try {
        // Conexión a la base de datos
        //await dbConnectMongoose();
        await dbConnectMysql();
        await migrar();


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
