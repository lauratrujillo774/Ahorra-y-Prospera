-- Esquema de Ahorra y Prospera (generado con npm run exportar-bd). Las sentencias se separan con "-- ;;".
-- Se importa con: npm run importar-bd
-- ;;
CREATE TABLE IF NOT EXISTS `aportes_ahorro` (
  `id_aporte` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_meta` int(10) unsigned NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `fecha` date NOT NULL,
  `nota` varchar(255) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_aporte`),
  KEY `idx_aportes_meta` (`id_meta`),
  CONSTRAINT `fk_aportes_meta` FOREIGN KEY (`id_meta`) REFERENCES `metas_ahorro` (`id_meta`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_aportes_monto` CHECK (`monto` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `categorias` (
  `id_categoria` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned DEFAULT NULL COMMENT 'NULL = categoría predeterminada del sistema; con valor = creada por el usuario (RF005)',
  `nombre` varchar(60) NOT NULL,
  `tipo` enum('ingreso','gasto') NOT NULL,
  `icono` varchar(40) DEFAULT NULL,
  `color` char(7) DEFAULT NULL COMMENT 'Hex, ej. #4CAF50',
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_categoria`),
  KEY `idx_categorias_usuario` (`id_usuario`),
  KEY `idx_categorias_tipo` (`tipo`),
  CONSTRAINT `fk_categorias_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `consultas_ia` (
  `id_consulta` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `proveedor` varchar(20) DEFAULT NULL,
  `creada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_consulta`),
  KEY `idx_consultas_usuario` (`id_usuario`,`creada_en`),
  CONSTRAINT `fk_consultas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `contenido_educativo` (
  `id_contenido` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_autor` int(10) unsigned DEFAULT NULL COMMENT 'Administrador que lo publicó',
  `titulo` varchar(150) NOT NULL,
  `resumen` varchar(300) DEFAULT NULL,
  `contenido` mediumtext DEFAULT NULL,
  `tipo` enum('curso','articulo','guia','consejo','video') NOT NULL DEFAULT 'articulo',
  `tema` enum('ahorro','presupuesto','inversiones','deudas','general') NOT NULL DEFAULT 'general',
  `nivel` enum('basico','intermedio','avanzado') NOT NULL DEFAULT 'basico',
  `url_recurso` varchar(255) DEFAULT NULL,
  `publicado` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_contenido`),
  KEY `idx_contenido_tema` (`tema`,`tipo`),
  KEY `idx_contenido_autor` (`id_autor`),
  CONSTRAINT `fk_contenido_autor` FOREIGN KEY (`id_autor`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `cuentas_ahorro` (
  `id_cuenta` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `nombre` varchar(80) NOT NULL,
  `entidad` varchar(80) DEFAULT NULL COMMENT 'Banco, billetera digital, efectivo, etc.',
  `saldo` decimal(15,2) NOT NULL DEFAULT 0.00,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_cuenta`),
  KEY `idx_cuentas_usuario` (`id_usuario`),
  CONSTRAINT `fk_cuentas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `deudas` (
  `id_deuda` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_moneda` smallint(5) unsigned NOT NULL DEFAULT 1,
  `acreedor` varchar(100) NOT NULL COMMENT 'Banco, persona o entidad a quien se debe',
  `descripcion` varchar(255) DEFAULT NULL,
  `monto_total` decimal(15,2) NOT NULL,
  `saldo_pendiente` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Se actualiza por trigger al registrar pagos',
  `tasa_interes_anual` decimal(6,2) DEFAULT NULL,
  `cuota_mensual` decimal(15,2) DEFAULT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_vencimiento` date NOT NULL,
  `estado` enum('pendiente','al_dia','vencida','pagada') NOT NULL DEFAULT 'pendiente',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_deuda`),
  KEY `idx_deudas_usuario_venc` (`id_usuario`,`fecha_vencimiento`),
  KEY `idx_deudas_moneda` (`id_moneda`),
  CONSTRAINT `fk_deudas_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`) ON UPDATE CASCADE,
  CONSTRAINT `fk_deudas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_deudas_monto` CHECK (`monto_total` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `exportaciones` (
  `id_exportacion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `formato` enum('pdf','excel') NOT NULL,
  `tipo_reporte` enum('ingresos','gastos','balance','ahorro','inversiones','deudas','completo','presupuesto','pagos','cuentas','retos','educacion','recomendaciones') NOT NULL DEFAULT 'completo',
  `fecha_desde` date DEFAULT NULL,
  `fecha_hasta` date DEFAULT NULL,
  `creada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_exportacion`),
  KEY `idx_exp_usuario` (`id_usuario`),
  CONSTRAINT `fk_exp_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `gastos` (
  `id_gasto` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_categoria` int(10) unsigned DEFAULT NULL,
  `id_moneda` smallint(5) unsigned NOT NULL DEFAULT 1,
  `monto` decimal(15,2) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `fecha` date NOT NULL,
  `origen` enum('manual','automatico') NOT NULL DEFAULT 'manual' COMMENT 'RF002: registro automático de gastos',
  `es_necesidad` tinyint(1) DEFAULT NULL COMMENT '1 = necesidad, 0 = deseo (ayuda a detectar gasto impulsivo)',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_gasto`),
  KEY `idx_gastos_usuario_fecha` (`id_usuario`,`fecha`),
  KEY `idx_gastos_categoria` (`id_categoria`),
  KEY `idx_gastos_moneda` (`id_moneda`),
  CONSTRAINT `fk_gastos_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`) ON UPDATE CASCADE,
  CONSTRAINT `fk_gastos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_gastos_monto` CHECK (`monto` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `ingresos` (
  `id_ingreso` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_categoria` int(10) unsigned DEFAULT NULL,
  `id_moneda` smallint(5) unsigned NOT NULL DEFAULT 1,
  `monto` decimal(15,2) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `fecha` date NOT NULL,
  `recurrente` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Ingreso mensual fijo (RF022)',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_ingreso`),
  KEY `idx_ingresos_usuario_fecha` (`id_usuario`,`fecha`),
  KEY `idx_ingresos_categoria` (`id_categoria`),
  KEY `idx_ingresos_moneda` (`id_moneda`),
  CONSTRAINT `fk_ingresos_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ingresos_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ingresos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_ingresos_monto` CHECK (`monto` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `inversiones` (
  `id_inversion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_tipo_inversion` tinyint(3) unsigned NOT NULL,
  `id_moneda` smallint(5) unsigned NOT NULL DEFAULT 1,
  `nombre` varchar(100) NOT NULL,
  `monto_invertido` decimal(15,2) NOT NULL,
  `valor_actual` decimal(15,2) DEFAULT NULL COMMENT 'Para calcular rendimiento',
  `tasa_rendimiento_anual` decimal(6,2) DEFAULT NULL COMMENT '% efectivo anual esperado',
  `fecha_inicio` date NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `estado` enum('activa','finalizada','retirada') NOT NULL DEFAULT 'activa',
  `notas` varchar(255) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_inversion`),
  KEY `idx_inv_usuario` (`id_usuario`),
  KEY `idx_inv_tipo` (`id_tipo_inversion`),
  KEY `idx_inv_moneda` (`id_moneda`),
  CONSTRAINT `fk_inv_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`) ON UPDATE CASCADE,
  CONSTRAINT `fk_inv_tipo` FOREIGN KEY (`id_tipo_inversion`) REFERENCES `tipos_inversion` (`id_tipo_inversion`) ON UPDATE CASCADE,
  CONSTRAINT `fk_inv_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_inv_monto` CHECK (`monto_invertido` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `logros` (
  `id_logro` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `insignia` varchar(100) DEFAULT NULL COMMENT 'Ruta o nombre del ícono de la insignia',
  `puntos` smallint(5) unsigned NOT NULL DEFAULT 10,
  PRIMARY KEY (`id_logro`),
  UNIQUE KEY `uq_logros_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `metas_ahorro` (
  `id_meta` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_cuenta` int(10) unsigned DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL COMMENT 'Para qué quiere ahorrar (motivación)',
  `monto_objetivo` decimal(15,2) NOT NULL,
  `monto_actual` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Se actualiza por trigger al registrar aportes',
  `fecha_inicio` date NOT NULL,
  `fecha_limite` date DEFAULT NULL,
  `estado` enum('activa','cumplida','pausada','cancelada') NOT NULL DEFAULT 'activa',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_meta`),
  KEY `idx_metas_usuario` (`id_usuario`),
  KEY `idx_metas_cuenta` (`id_cuenta`),
  CONSTRAINT `fk_metas_cuenta` FOREIGN KEY (`id_cuenta`) REFERENCES `cuentas_ahorro` (`id_cuenta`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_metas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_metas_objetivo` CHECK (`monto_objetivo` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `monedas` (
  `id_moneda` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `codigo` char(3) NOT NULL COMMENT 'ISO 4217',
  `nombre` varchar(60) NOT NULL,
  `simbolo` varchar(5) NOT NULL,
  `tasa_cambio_usd` decimal(18,6) NOT NULL DEFAULT 1.000000 COMMENT 'Unidades de esta moneda por 1 USD',
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `actualizada_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_moneda`),
  UNIQUE KEY `uq_monedas_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `notificaciones` (
  `id_notificacion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `tipo` enum('exceso_gasto','vencimiento_pago','meta_ahorro','logro','reto','sistema') NOT NULL DEFAULT 'sistema',
  `titulo` varchar(120) NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  `creada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_notificacion`),
  KEY `idx_notif_usuario` (`id_usuario`,`leida`),
  CONSTRAINT `fk_notif_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `pagos_deuda` (
  `id_pago` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_deuda` int(10) unsigned NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `fecha_pago` date NOT NULL,
  `nota` varchar(255) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_pago`),
  KEY `idx_pagos_deuda` (`id_deuda`),
  CONSTRAINT `fk_pagos_deuda` FOREIGN KEY (`id_deuda`) REFERENCES `deudas` (`id_deuda`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_pagos_monto` CHECK (`monto` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `pagos_programados` (
  `id_pago_prog` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_deuda` int(10) unsigned DEFAULT NULL COMMENT 'Opcional: pago asociado a una deuda',
  `concepto` varchar(120) NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `fecha_pago` date NOT NULL,
  `frecuencia` enum('unico','semanal','quincenal','mensual','anual') NOT NULL DEFAULT 'unico',
  `dias_aviso` tinyint(3) unsigned NOT NULL DEFAULT 3 COMMENT 'Días antes del vencimiento para recordar',
  `estado` enum('programado','pagado','omitido') NOT NULL DEFAULT 'programado',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_pago_prog`),
  KEY `idx_pp_usuario_fecha` (`id_usuario`,`fecha_pago`),
  KEY `idx_pp_deuda` (`id_deuda`),
  CONSTRAINT `fk_pp_deuda` FOREIGN KEY (`id_deuda`) REFERENCES `deudas` (`id_deuda`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pp_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_pp_monto` CHECK (`monto` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `presupuestos` (
  `id_presupuesto` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `anio` smallint(5) unsigned NOT NULL,
  `mes` tinyint(3) unsigned NOT NULL,
  `monto_total` decimal(15,2) NOT NULL,
  `generado_automaticamente` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'RF004: presupuesto mensual inteligente',
  `umbral_alerta` tinyint(3) unsigned NOT NULL DEFAULT 80 COMMENT '% de uso a partir del cual se alerta (RF007)',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_presupuesto`),
  UNIQUE KEY `uq_presupuesto_mes` (`id_usuario`,`anio`,`mes`),
  CONSTRAINT `fk_presupuestos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_presupuestos_mes` CHECK (`mes` between 1 and 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `presupuesto_categorias` (
  `id_presupuesto` int(10) unsigned NOT NULL,
  `id_categoria` int(10) unsigned NOT NULL,
  `monto_limite` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id_presupuesto`,`id_categoria`),
  KEY `idx_pc_categoria` (`id_categoria`),
  CONSTRAINT `fk_pc_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pc_presupuesto` FOREIGN KEY (`id_presupuesto`) REFERENCES `presupuestos` (`id_presupuesto`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `progreso_educativo` (
  `id_usuario` int(10) unsigned NOT NULL,
  `id_contenido` int(10) unsigned NOT NULL,
  `porcentaje` decimal(5,2) NOT NULL DEFAULT 0.00,
  `completado` tinyint(1) NOT NULL DEFAULT 0,
  `ultimo_acceso` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_usuario`,`id_contenido`),
  KEY `idx_pe_contenido` (`id_contenido`),
  CONSTRAINT `fk_pe_contenido` FOREIGN KEY (`id_contenido`) REFERENCES `contenido_educativo` (`id_contenido`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_pe_porcentaje` CHECK (`porcentaje` between 0 and 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `recomendaciones_ia` (
  `id_recomendacion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `tipo` enum('ahorro','gasto','inversion','deuda','presupuesto','general') NOT NULL DEFAULT 'general',
  `titulo` varchar(120) NOT NULL,
  `mensaje` text NOT NULL,
  `prioridad` enum('baja','media','alta') NOT NULL DEFAULT 'media',
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  `generada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_recomendacion`),
  KEY `idx_ia_usuario` (`id_usuario`,`generada_en`),
  CONSTRAINT `fk_ia_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `recompensas_usuario` (
  `id_usuario` int(10) unsigned NOT NULL,
  `nivel` varchar(20) NOT NULL,
  `reclamada_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_usuario`,`nivel`),
  CONSTRAINT `fk_recompensa_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `rendimientos_inversion` (
  `id_rendimiento` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_inversion` int(10) unsigned NOT NULL,
  `id_ingreso` int(10) unsigned DEFAULT NULL COMMENT 'Ingreso que se generó automáticamente',
  `monto` decimal(15,2) NOT NULL,
  `fecha` date NOT NULL,
  `nota` varchar(255) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_rendimiento`),
  KEY `idx_rend_inversion` (`id_inversion`,`fecha`),
  CONSTRAINT `fk_rend_inversion` FOREIGN KEY (`id_inversion`) REFERENCES `inversiones` (`id_inversion`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `retos_financieros` (
  `id_reto` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `titulo` varchar(100) NOT NULL,
  `descripcion` varchar(500) NOT NULL,
  `tipo` enum('ahorro','gasto','deuda','educacion','inversion') NOT NULL DEFAULT 'ahorro',
  `monto_meta` decimal(15,2) DEFAULT NULL,
  `duracion_dias` smallint(5) unsigned NOT NULL DEFAULT 30,
  `puntos` smallint(5) unsigned NOT NULL DEFAULT 10,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_reto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `roles` (
  `id_rol` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(30) NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `uq_roles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `sesiones` (
  `id_sesion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `token_sesion` char(64) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `navegador` varchar(255) DEFAULT NULL,
  `inicio_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `ultima_actividad` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Para cierre por inactividad (RNF030)',
  `cerrada_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id_sesion`),
  UNIQUE KEY `uq_sesion_token` (`token_sesion`),
  KEY `idx_sesiones_usuario` (`id_usuario`),
  CONSTRAINT `fk_sesiones_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `tipos_inversion` (
  `id_tipo_inversion` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `nivel_riesgo` enum('bajo','medio','alto') NOT NULL DEFAULT 'bajo',
  PRIMARY KEY (`id_tipo_inversion`),
  UNIQUE KEY `uq_tipo_inversion_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `tokens_recuperacion` (
  `id_token` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL COMMENT 'SHA-256 del token enviado por correo',
  `tipo` enum('recuperar_contrasena','verificar_correo_aux') NOT NULL DEFAULT 'recuperar_contrasena',
  `expira_en` datetime NOT NULL,
  `usado` tinyint(1) NOT NULL DEFAULT 0,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_token`),
  UNIQUE KEY `uq_token_hash` (`token_hash`),
  KEY `idx_tokens_usuario` (`id_usuario`),
  CONSTRAINT `fk_tokens_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_rol` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `id_moneda` smallint(5) unsigned NOT NULL DEFAULT 1 COMMENT 'Moneda de visualización (RF008)',
  `nombres` varchar(80) NOT NULL,
  `apellidos` varchar(80) NOT NULL,
  `correo` varchar(150) NOT NULL,
  `correo_auxiliar` varchar(150) DEFAULT NULL COMMENT 'RF018',
  `correo_aux_verificado` tinyint(1) NOT NULL DEFAULT 0,
  `contrasena_hash` varchar(255) NOT NULL COMMENT 'Hash (password_hash de PHP / bcrypt), nunca texto plano',
  `telefono` varchar(20) DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `foto_perfil` varchar(255) DEFAULT NULL,
  `tema` enum('claro','oscuro') NOT NULL DEFAULT 'claro' COMMENT 'RF024',
  `idioma` char(2) NOT NULL DEFAULT 'es' COMMENT 'RNF029',
  `porcentaje_ahorro_meta` decimal(5,2) NOT NULL DEFAULT 10.00 COMMENT 'Regla de negocio: separar al menos 10% para ahorro',
  `estado` enum('activo','inactivo','bloqueado') NOT NULL DEFAULT 'activo',
  `intentos_fallidos` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `ultimo_acceso` datetime DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_usuarios_correo` (`correo`),
  KEY `idx_usuarios_rol` (`id_rol`),
  KEY `idx_usuarios_moneda` (`id_moneda`),
  CONSTRAINT `fk_usuarios_moneda` FOREIGN KEY (`id_moneda`) REFERENCES `monedas` (`id_moneda`) ON UPDATE CASCADE,
  CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `usuario_logros` (
  `id_usuario` int(10) unsigned NOT NULL,
  `id_logro` int(10) unsigned NOT NULL,
  `obtenido_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_usuario`,`id_logro`),
  KEY `idx_ul_logro` (`id_logro`),
  CONSTRAINT `fk_ul_logro` FOREIGN KEY (`id_logro`) REFERENCES `logros` (`id_logro`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ul_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE TABLE IF NOT EXISTS `usuario_retos` (
  `id_usuario_reto` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int(10) unsigned NOT NULL,
  `id_reto` int(10) unsigned NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `progreso` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '0 a 100 %',
  `estado` enum('en_curso','completado','abandonado') NOT NULL DEFAULT 'en_curso',
  PRIMARY KEY (`id_usuario_reto`),
  UNIQUE KEY `uq_usuario_reto` (`id_usuario`,`id_reto`,`fecha_inicio`),
  KEY `idx_ur_reto` (`id_reto`),
  CONSTRAINT `fk_ur_reto` FOREIGN KEY (`id_reto`) REFERENCES `retos_financieros` (`id_reto`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ur_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_ur_progreso` CHECK (`progreso` between 0 and 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_balance_usuario` AS select `u`.`id_usuario` AS `id_usuario`,coalesce((select sum(`ingresos`.`monto`) from `ingresos` where `ingresos`.`id_usuario` = `u`.`id_usuario`),0) AS `total_ingresos`,coalesce((select sum(`gastos`.`monto`) from `gastos` where `gastos`.`id_usuario` = `u`.`id_usuario`),0) AS `total_gastos`,coalesce((select sum(`ingresos`.`monto`) from `ingresos` where `ingresos`.`id_usuario` = `u`.`id_usuario`),0) - coalesce((select sum(`gastos`.`monto`) from `gastos` where `gastos`.`id_usuario` = `u`.`id_usuario`),0) AS `balance` from `usuarios` `u`
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_estado_deudas` AS select `d`.`id_deuda` AS `id_deuda`,`d`.`id_usuario` AS `id_usuario`,`d`.`acreedor` AS `acreedor`,`d`.`monto_total` AS `monto_total`,`d`.`saldo_pendiente` AS `saldo_pendiente`,`d`.`monto_total` - `d`.`saldo_pendiente` AS `total_pagado`,to_days(`d`.`fecha_vencimiento`) - to_days(curdate()) AS `dias_para_vencer`,`d`.`fecha_vencimiento` AS `fecha_vencimiento`,`d`.`estado` AS `estado` from `deudas` `d`
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_movimientos` AS select 'ingreso' AS `tipo`,`i`.`id_ingreso` AS `id_movimiento`,`i`.`id_usuario` AS `id_usuario`,`i`.`id_categoria` AS `id_categoria`,`c`.`nombre` AS `categoria`,`i`.`monto` AS `monto`,`i`.`descripcion` AS `descripcion`,`i`.`fecha` AS `fecha` from (`ingresos` `i` left join `categorias` `c` on(`c`.`id_categoria` = `i`.`id_categoria`)) union all select 'gasto' AS `gasto`,`g`.`id_gasto` AS `id_gasto`,`g`.`id_usuario` AS `id_usuario`,`g`.`id_categoria` AS `id_categoria`,`c`.`nombre` AS `nombre`,`g`.`monto` AS `monto`,`g`.`descripcion` AS `descripcion`,`g`.`fecha` AS `fecha` from (`gastos` `g` left join `categorias` `c` on(`c`.`id_categoria` = `g`.`id_categoria`))
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_progreso_metas` AS select `metas_ahorro`.`id_meta` AS `id_meta`,`metas_ahorro`.`id_usuario` AS `id_usuario`,`metas_ahorro`.`nombre` AS `nombre`,`metas_ahorro`.`monto_objetivo` AS `monto_objetivo`,`metas_ahorro`.`monto_actual` AS `monto_actual`,round(least(`metas_ahorro`.`monto_actual` / `metas_ahorro`.`monto_objetivo` * 100,100),2) AS `porcentaje_avance`,greatest(`metas_ahorro`.`monto_objetivo` - `metas_ahorro`.`monto_actual`,0) AS `monto_faltante`,`metas_ahorro`.`fecha_limite` AS `fecha_limite`,`metas_ahorro`.`estado` AS `estado` from `metas_ahorro`
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_rendimiento_inversiones` AS select `i`.`id_inversion` AS `id_inversion`,`i`.`id_usuario` AS `id_usuario`,`i`.`nombre` AS `nombre`,`t`.`nombre` AS `tipo`,`t`.`nivel_riesgo` AS `nivel_riesgo`,`i`.`monto_invertido` AS `monto_invertido`,`i`.`valor_actual` AS `valor_actual`,coalesce(`i`.`valor_actual`,`i`.`monto_invertido`) - `i`.`monto_invertido` AS `ganancia`,round((coalesce(`i`.`valor_actual`,`i`.`monto_invertido`) - `i`.`monto_invertido`) / `i`.`monto_invertido` * 100,2) AS `rendimiento_pct`,`i`.`estado` AS `estado` from (`inversiones` `i` join `tipos_inversion` `t` on(`t`.`id_tipo_inversion` = `i`.`id_tipo_inversion`))
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_resumen_mensual` AS select `vista_movimientos`.`id_usuario` AS `id_usuario`,year(`vista_movimientos`.`fecha`) AS `anio`,month(`vista_movimientos`.`fecha`) AS `mes`,sum(case when `vista_movimientos`.`tipo` = 'ingreso' then `vista_movimientos`.`monto` else 0 end) AS `ingresos`,sum(case when `vista_movimientos`.`tipo` = 'gasto' then `vista_movimientos`.`monto` else 0 end) AS `gastos` from `vista_movimientos` group by `vista_movimientos`.`id_usuario`,year(`vista_movimientos`.`fecha`),month(`vista_movimientos`.`fecha`)
-- ;;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vista_uso_presupuesto` AS select `p`.`id_usuario` AS `id_usuario`,`p`.`id_presupuesto` AS `id_presupuesto`,`p`.`anio` AS `anio`,`p`.`mes` AS `mes`,`pc`.`id_categoria` AS `id_categoria`,`c`.`nombre` AS `categoria`,`pc`.`monto_limite` AS `monto_limite`,coalesce((select sum(`g`.`monto`) from `gastos` `g` where `g`.`id_usuario` = `p`.`id_usuario` and `g`.`id_categoria` = `pc`.`id_categoria` and year(`g`.`fecha`) = `p`.`anio` and month(`g`.`fecha`) = `p`.`mes`),0) AS `gastado`,round(coalesce((select sum(`g`.`monto`) from `gastos` `g` where `g`.`id_usuario` = `p`.`id_usuario` and `g`.`id_categoria` = `pc`.`id_categoria` and year(`g`.`fecha`) = `p`.`anio` and month(`g`.`fecha`) = `p`.`mes`),0) / `pc`.`monto_limite` * 100,2) AS `porcentaje_uso`,`p`.`umbral_alerta` AS `umbral_alerta` from ((`presupuestos` `p` join `presupuesto_categorias` `pc` on(`pc`.`id_presupuesto` = `p`.`id_presupuesto`)) join `categorias` `c` on(`c`.`id_categoria` = `pc`.`id_categoria`))
-- ;;
DROP TRIGGER IF EXISTS `trg_aportes_ai`
-- ;;
CREATE TRIGGER trg_aportes_ai AFTER INSERT ON aportes_ahorro
FOR EACH ROW
BEGIN
  UPDATE metas_ahorro
     SET estado = CASE WHEN monto_actual + NEW.monto >= monto_objetivo THEN 'cumplida' ELSE estado END,
         monto_actual = monto_actual + NEW.monto
   WHERE id_meta = NEW.id_meta;
END
-- ;;
DROP TRIGGER IF EXISTS `trg_aportes_ad`
-- ;;
CREATE TRIGGER trg_aportes_ad AFTER DELETE ON aportes_ahorro
FOR EACH ROW
BEGIN
  UPDATE metas_ahorro
     SET monto_actual = GREATEST(monto_actual - OLD.monto, 0)
   WHERE id_meta = OLD.id_meta;
END
-- ;;
DROP TRIGGER IF EXISTS `trg_deudas_bi`
-- ;;
CREATE TRIGGER trg_deudas_bi BEFORE INSERT ON deudas
FOR EACH ROW
BEGIN
  IF NEW.saldo_pendiente IS NULL OR NEW.saldo_pendiente <= 0 THEN
    SET NEW.saldo_pendiente = NEW.monto_total;
  END IF;
END
-- ;;
DROP TRIGGER IF EXISTS `trg_pagos_ai`
-- ;;
CREATE TRIGGER trg_pagos_ai AFTER INSERT ON pagos_deuda
FOR EACH ROW
BEGIN
  UPDATE deudas
     SET estado = CASE WHEN saldo_pendiente - NEW.monto <= 0 THEN 'pagada' ELSE 'al_dia' END,
         saldo_pendiente = GREATEST(saldo_pendiente - NEW.monto, 0)
   WHERE id_deuda = NEW.id_deuda;
END
-- ;;
INSERT IGNORE INTO `roles` (`id_rol`, `nombre`, `descripcion`) VALUES (1, 'usuario', 'Persona que administra sus finanzas personales')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (1, 'COP', 'Peso colombiano', '$', 4000, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (2, 'USD', 'Dólar estadounidense', 'US$', 1, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (3, 'EUR', 'Euro', '€', 0.92, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (4, 'MXN', 'Peso mexicano', '$', 17, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (5, 'ARS', 'Peso argentino', '$', 900, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (6, 'PEN', 'Sol peruano', 'S/', 3.75, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (7, 'CLP', 'Peso chileno', '$', 950, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `monedas` (`id_moneda`, `codigo`, `nombre`, `simbolo`, `tasa_cambio_usd`, `activa`, `actualizada_en`) VALUES (8, 'BRL', 'Real brasileño', 'R$', 5, 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (1, NULL, 'Salario', 'ingreso', 'briefcase', '#2E7D32', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (2, NULL, 'Mesada', 'ingreso', 'gift', '#43A047', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (3, NULL, 'Trabajo independiente', 'ingreso', 'laptop', '#66BB6A', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (4, NULL, 'Negocio', 'ingreso', 'store', '#81C784', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (5, NULL, 'Rendimientos', 'ingreso', 'chart-line', '#A5D6A7', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (6, NULL, 'Otros ingresos', 'ingreso', 'plus-circle', '#C8E6C9', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (7, NULL, 'Alimentación', 'gasto', 'utensils', '#E53935', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (8, NULL, 'Transporte', 'gasto', 'bus', '#FB8C00', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (9, NULL, 'Vivienda', 'gasto', 'home', '#8E24AA', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (10, NULL, 'Servicios públicos', 'gasto', 'bolt', '#1E88E5', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (11, NULL, 'Educación', 'gasto', 'graduation-cap', '#3949AB', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (12, NULL, 'Salud', 'gasto', 'heartbeat', '#D81B60', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (13, NULL, 'Entretenimiento', 'gasto', 'film', '#F4511E', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (14, NULL, 'Ropa', 'gasto', 'tshirt', '#6D4C41', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (15, NULL, 'Tecnología', 'gasto', 'mobile-alt', '#546E7A', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (16, NULL, 'Compras impulsivas', 'gasto', 'shopping-cart', '#C62828', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `categorias` (`id_categoria`, `id_usuario`, `nombre`, `tipo`, `icono`, `color`, `activa`, `creado_en`) VALUES (17, NULL, 'Otros gastos', 'gasto', 'ellipsis-h', '#9E9E9E', 1, '2026-10-09 18:50:24.000')
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (1, 'Primer paso', 'Registraste tu primer ingreso o gasto', 'badge_primer_paso.png', 10)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (2, 'Ahorrador novato', 'Hiciste tu primer aporte a una meta de ahorro', 'badge_ahorrador.png', 20)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (3, 'Meta cumplida', 'Completaste una meta de ahorro', 'badge_meta.png', 50)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (4, 'Primero ahorro, luego gasto', 'Ahorraste al menos 10% de tus ingresos en un mes', 'badge_10pct.png', 40)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (5, 'Libre de deudas', 'Pagaste por completo una deuda', 'badge_sin_deuda.png', 50)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (6, 'Estudiante financiero', 'Completaste tu primer contenido educativo', 'badge_estudiante.png', 20)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (7, 'Inversionista', 'Registraste tu primera inversión', 'badge_inversionista.png', 30)
-- ;;
INSERT IGNORE INTO `logros` (`id_logro`, `nombre`, `descripcion`, `insignia`, `puntos`) VALUES (8, 'Constante', 'Ahorraste durante 3 meses seguidos', 'badge_constante.png', 60)
-- ;;
INSERT IGNORE INTO `retos_financieros` (`id_reto`, `titulo`, `descripcion`, `tipo`, `monto_meta`, `duracion_dias`, `puntos`, `activo`) VALUES (1, 'Reto 30 días sin gastos hormiga', 'Evita compras pequeñas e innecesarias durante 30 días.', 'gasto', NULL, 30, 40, 1)
-- ;;
INSERT IGNORE INTO `retos_financieros` (`id_reto`, `titulo`, `descripcion`, `tipo`, `monto_meta`, `duracion_dias`, `puntos`, `activo`) VALUES (2, 'Reto del 10%', 'Separa el 10% de cada ingreso antes de gastar.', 'ahorro', NULL, 30, 30, 1)
-- ;;
INSERT IGNORE INTO `retos_financieros` (`id_reto`, `titulo`, `descripcion`, `tipo`, `monto_meta`, `duracion_dias`, `puntos`, `activo`) VALUES (3, 'Reto de las 52 semanas', 'Ahorra una cantidad creciente cada semana durante un año.', 'ahorro', NULL, 365, 100, 1)
-- ;;
INSERT IGNORE INTO `retos_financieros` (`id_reto`, `titulo`, `descripcion`, `tipo`, `monto_meta`, `duracion_dias`, `puntos`, `activo`) VALUES (4, 'Reto fondo de emergencia', 'Reúne el equivalente a un mes de gastos.', 'ahorro', NULL, 90, 60, 1)
-- ;;
INSERT IGNORE INTO `retos_financieros` (`id_reto`, `titulo`, `descripcion`, `tipo`, `monto_meta`, `duracion_dias`, `puntos`, `activo`) VALUES (5, 'Reto aprende y crece', 'Completa 3 contenidos de educación financiera.', 'educacion', NULL, 30, 25, 1)
-- ;;
INSERT IGNORE INTO `retos_financieros` (`id_reto`, `titulo`, `descripcion`, `tipo`, `monto_meta`, `duracion_dias`, `puntos`, `activo`) VALUES (6, 'Reto pago de deuda', 'Realiza un pago extra a tu deuda más costosa.', 'deuda', NULL, 30, 35, 1)
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (1, 'Ahorro programado', 'Aportes periódicos a una cuenta o producto de ahorro', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (2, 'CDT / Depósito a término', 'Dinero inmovilizado a plazo fijo con tasa pactada', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (3, 'Fondo de inversión colectiva', 'Recursos de varias personas administrados por una entidad', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (4, 'Fondo de pensiones voluntarias', 'Ahorro de largo plazo para el retiro', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (5, 'Bonos', 'Títulos de deuda emitidos por empresas o gobierno', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (6, 'Acciones', 'Participación en la propiedad de una empresa', 'alto')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (7, 'Cuenta de ahorros de alto rendimiento', 'Cuenta que paga más intereses que una de ahorros tradicional, con disponibilidad inmediata', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (8, 'Fondo de cesantías', 'Ahorro obligatorio del trabajador que puede administrarse en fondos de bajo o mayor riesgo', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (9, 'ETF / fondos cotizados', 'Canasta de acciones o bonos que se compra como una sola acción en bolsa', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (10, 'TES (títulos del Tesoro)', 'Deuda emitida por el gobierno nacional, con tasa fija o atada a la inflación', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (11, 'Finca raíz / inmuebles', 'Comprar vivienda, locales o lotes para arrendar o valorizar', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (12, 'Fondos inmobiliarios (REIT)', 'Participar en inmuebles con poco dinero a través de un fondo', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (13, 'Divisas (dólar, euro)', 'Guardar o comprar moneda extranjera para protegerte o especular con el tipo de cambio', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (14, 'Oro y metales preciosos', 'Activo de refugio que suele conservar valor en épocas de crisis', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (15, 'Criptomonedas', 'Activos digitales muy volátiles y poco regulados', 'alto')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (16, 'Préstamos entre personas (P2P)', 'Prestar dinero a personas o negocios a través de plataformas, a cambio de intereses', 'alto')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (17, 'Negocio propio / emprendimiento', 'Crear o invertir en un negocio con potencial de crecimiento y riesgo de pérdida total', 'alto')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (18, 'Seguros con ahorro / rentas', 'Seguros que combinan protección y ahorro, o que pagan una renta periódica', 'bajo')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (19, 'Derivados (futuros y opciones)', 'Contratos apalancados sobre el precio futuro de un activo; solo para expertos', 'alto')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (20, 'Educación y capacitación', 'Invertir en tus propias habilidades para aumentar tus ingresos futuros', 'medio')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (21, 'Materias primas (commodities)', 'Petróleo, café, granos y otros productos básicos negociados en mercados', 'alto')
-- ;;
INSERT IGNORE INTO `tipos_inversion` (`id_tipo_inversion`, `nombre`, `descripcion`, `nivel_riesgo`) VALUES (22, 'Coleccionables (arte, vehículos clásicos)', 'Bienes escasos cuyo valor depende de la demanda; poca liquidez', 'alto')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (1, NULL, '¿Qué es el ahorro y por qué importa?', 'Aprende a darle un propósito a tu dinero.', 'Ahorrar es separar hoy una parte de tu dinero para usarla mañana. No se trata de gastar menos por gusto, sino de darle un propósito a lo que ganas.\n\nPor qué importa:\n• Te protege de imprevistos (salud, desempleo, reparaciones) sin endeudarte.\n• Te permite cumplir metas: estudio, vivienda, un viaje.\n• Te da tranquilidad y libertad para decidir.\n\nPrimer paso: define una meta concreta (qué, cuánto y para cuándo) y crea una meta en la sección Ahorros.', 'articulo', 'ahorro', 'basico', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (2, NULL, 'La regla: primero se ahorra, después se gasta', 'Cómo separar al menos 10% de tus ingresos.', 'El error más común es ahorrar \"lo que sobre\": casi nunca sobra. La regla es pagarte primero a ti.\n\nCómo aplicarla:\n1. El día que recibes tu ingreso, separa al menos el 10% (ideal 20%).\n2. Muévelo a otra cuenta o a una meta de ahorro, fuera de tu vista.\n3. Gasta el resto con tranquilidad.\n\nAutomatiza la transferencia para que no dependa de tu fuerza de voluntad. Empezar con poco es mejor que no empezar.', 'guia', 'ahorro', 'basico', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (3, NULL, 'Cómo crear tu primer presupuesto mensual', 'Paso a paso para organizar ingresos y gastos.', 'Un presupuesto es un plan para tu dinero, no una prohibición.\n\nPasos:\n1. Suma todos tus ingresos del mes.\n2. Anota tus gastos fijos (arriendo, servicios, cuotas) y variables (comida, transporte, ocio).\n3. Usa la regla 50/30/20: 50% necesidades, 30% deseos, 20% ahorro y deudas.\n4. Fija un límite por categoría y revísalo cada semana.\n\nEn Ahorra y Prospera puedes crear tu presupuesto en la sección Presupuesto y recibir alertas cuando te acerques al límite.', 'curso', 'presupuesto', 'basico', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (4, NULL, 'Necesidades vs. deseos', 'Identifica y reduce el gasto impulsivo.', 'Necesidad: lo que no puedes dejar de pagar sin consecuencias serias (vivienda, comida básica, salud, transporte al trabajo).\nDeseo: lo que mejora tu vida pero puedes aplazar (salidas, ropa extra, suscripciones, tecnología nueva).\n\nAntes de comprar pregúntate:\n• ¿Lo necesitaba hace un mes?\n• ¿Me alcanza sin usar crédito?\n• ¿Esperar 48 horas cambia mi opinión?\n\nLos \"gastos hormiga\" (cafés, domicilios, compras pequeñas) suman mucho: revísalos en tus gastos del mes.', 'consejo', 'presupuesto', 'basico', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (5, NULL, 'Introducción a las inversiones simples', 'Fondos, CDT y ahorro programado explicados fácilmente.', 'Invertir es poner tu dinero a trabajar para que crezca con el tiempo. Productos sencillos para empezar:\n\n• Ahorro programado: aportes periódicos, riesgo bajo.\n• CDT: dejas tu dinero a plazo fijo con una tasa pactada, riesgo bajo.\n• Fondos de inversión colectiva: tu dinero se junta con el de otros y lo administra un experto, riesgo medio.\n• Pensiones voluntarias: ahorro de largo plazo para el retiro.\n\nA mayor rentabilidad esperada, mayor riesgo. Empieza por lo simple y entiende cada producto antes de invertir.', 'curso', 'inversiones', 'basico', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (6, NULL, 'Invierte solo lo que no necesitas a corto plazo', 'Evita errores graves al invertir.', 'Regla de oro: no inviertas dinero que puedas necesitar pronto.\n\nAntes de invertir:\n1. Ten tu fondo de emergencia (3 a 6 meses de gastos).\n2. Paga primero las deudas caras (tarjetas, créditos de consumo).\n3. Define tu horizonte: para menos de 3 años, prefiere productos de bajo riesgo.\n4. Diversifica: no pongas todo en un solo lugar.\n\nDesconfía de promesas de ganancias altas y rápidas: si suena demasiado bueno, suele ser una estafa.', 'articulo', 'inversiones', 'intermedio', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (7, NULL, 'Cómo salir de deudas', 'Estrategias para ordenar y pagar tus obligaciones.', 'Dos métodos probados:\n\n• Avalancha: pagas el mínimo en todas y todo lo extra a la de mayor tasa de interés. Es la que menos intereses te cuesta.\n• Bola de nieve: empiezas por la deuda más pequeña para ganar motivación.\n\nPasos:\n1. Lista todas tus deudas con saldo, tasa y cuota.\n2. Elige un método y destina un monto extra fijo cada mes.\n3. No adquieras nuevas deudas mientras pagas.\n4. Si no alcanzas, renegocia plazos o tasas con el acreedor.\n\nUsa la sección Deudas y Pagos y el Plan Financiero IA para ver en cuántos meses quedarías libre.', 'guia', 'deudas', 'basico', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
-- ;;
INSERT IGNORE INTO `contenido_educativo` (`id_contenido`, `id_autor`, `titulo`, `resumen`, `contenido`, `tipo`, `tema`, `nivel`, `url_recurso`, `publicado`, `creado_en`, `actualizado_en`) VALUES (8, NULL, 'Uso responsable del crédito', 'Evita el endeudamiento innecesario.', 'El crédito es una herramienta: bien usado te ayuda, mal usado te ahoga.\n\nBuenas prácticas:\n• Que tus cuotas no superen el 30-35% de tus ingresos.\n• Paga la totalidad de la tarjeta cada mes; el pago mínimo es la forma más cara de endeudarte.\n• Compara la tasa efectiva anual, no solo la cuota.\n• Evita usar crédito para gastos de deseo.\n• Paga a tiempo: tu historial crediticio abre o cierra puertas en el futuro.', 'articulo', 'deudas', 'intermedio', NULL, 1, '2026-10-09 18:50:24.000', '2026-10-09 22:26:57.000')
