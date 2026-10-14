import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import router from '../routes/index.js';
import { fileURLToPath } from 'node:url';
import { carpetaUploads, servirArchivo } from '../utils/fotos.js';

// Carpeta del proyecto (donde están index.html, Client/ y Recursos/)
const raizProyecto = fileURLToPath(new URL('../../../', import.meta.url));

//como numero de telefono el que sirve la ifnromacion
//y que se puede hacer
class Server {
    constructor() {
        this.app = express();
        // En internet (Render, etc.) hay un proxy delante: así req.ip y el protocolo reales llegan bien
        this.app.set('trust proxy', 1);
        this.port = process.env.PORT || 3000;
        this.middleware();//las validaciones que necesita la app
        //codigo que se ejecuta antes de que pase algo
        this.routes();//canales por los cuales se va a comunicar la app
        this.handleErrors();
    }

    middleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        // Archivos de máximo 5 MB (las fotos de perfil y mascotas se limitan a 2 MB)
        this.app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }));
        // Fotos y documentos subidos: del disco o, si no están, de la base de datos
        this.app.use('/uploads', express.static(carpetaUploads), servirArchivo);

        // La página web (así funciona en internet con una sola dirección).
        // Solo se publica la carpeta frontend/: nunca backend/ (ahí está el .env)
        // "no-cache": el navegador siempre comprueba si hay una versión nueva, así los cambios se ven sin vaciar la caché
        this.app.use(express.static(raizProyecto + 'frontend', { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
    }

    routes() {
        // Carga automática de las rutas que estén en src/routes/<carpeta>/<archivo>.js
        this.app.use('/', router);
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Conectado al puerto ${this.port}`);
        });
    }

    handleErrors() {
        this.app.use((err, req, res, next) => {
            if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
                console.error("JSON inválido en la petición:", err.message);
                return res.status(400).json({ message: "JSON inválido en la petición" });
            }
            next(err);
        });
    }
}

export default Server;
