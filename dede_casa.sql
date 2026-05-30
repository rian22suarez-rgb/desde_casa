CREATE DATABASE IF NOT EXISTS desde_casa;
USE desde_casa;

-- 1. Tabla EMPRESA (Incluye la tarifa fija de envío)
CREATE TABLE EMPRESA (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    tipo VARCHAR(50),
    tarifa_envio DECIMAL(10, 2) NOT NULL DEFAULT 0.00 -- Tarifa fija por empresa
);

-- 2. Tabla USUARIO
CREATE TABLE USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    metodoPago VARCHAR(50),
    rol VARCHAR(20) DEFAULT 'Cliente'
);

-- 3. Tabla DOMICILIARIO
CREATE TABLE DOMICILIARIO (
    id_domiciliario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Disponible',
    id_vehiculo VARCHAR(50)
);

-- 4. Tabla PRODUCTO
CREATE TABLE PRODUCTO (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    descripcion TEXT,
    id_empresa INT,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);

-- 5. Tabla PEDIDO
CREATE TABLE PEDIDO (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(30) DEFAULT 'Pendiente',
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    metodo_pago VARCHAR(50),
    id_usuario INT,
    id_domiciliario INT NULL,
    id_empresa INT,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    FOREIGN KEY (id_domiciliario) REFERENCES DOMICILIARIO(id_domiciliario) ON DELETE SET NULL,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa)
);

-- 6. Tabla DETALLE_PEDIDO
CREATE TABLE DETALLE_PEDIDO (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    cantidad INT NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    id_pedido INT,
    id_producto INT,
    FOREIGN KEY (id_pedido) REFERENCES PEDIDO(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto)
);