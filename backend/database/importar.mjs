// Crea las tablas, vistas, triggers y datos de referencia en la base configurada (MYSQL_* del entorno o del .env).
// Es seguro repetirlo: no borra datos existentes.   Uso:  npm run importar-bd
// (La app también lo hace sola al arrancar si encuentra la base vacía.)
import { connection } from '../src/config/mysql/dbmysql.js';
import { importarEsquema } from '../src/servicios/esquema.js';

try {
    const { total, fallos } = await importarEsquema();
    const [[{ tablas }]] = await connection.query("SELECT COUNT(*) AS tablas FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
    const [[{ triggers }]] = await connection.query('SELECT COUNT(*) AS triggers FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()');
    console.log(fallos ? `Terminó con ${fallos} error(es) de ${total}.` : 'Importación completa sin errores.', `Ahora hay ${tablas} tablas y ${triggers} triggers.`);
    process.exit(fallos ? 1 : 0);
} catch (error) {
    console.error('No se pudo importar:', error.message);
    process.exit(1);
}
