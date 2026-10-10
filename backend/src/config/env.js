import dotenv from 'dotenv';
dotenv.config();

// Las fechas y horas del servidor en hora de Colombia
// (los servidores en internet suelen estar en otra zona horaria)
process.env.TZ = process.env.TZ || 'America/Bogota';
