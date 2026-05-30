const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Permite procesar solicitudes en formato JSON
app.use(express.static('front'));

// Configuración conexion
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',       
    password: '',       
    database: 'desde_casa',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Ruta raíz 
app.get('/', (req, res) => {
    res.send('El servidor de Gestión de Domicilios (Maicao) está operando correctamente.');
});

// Registrar un Cliente / Usuario
app.post('/api/usuarios', async (req, res) => {
    const { nombre, telefono, email, contrasena, metodoPago, rol } = req.body;
    try {
        const query = `INSERT INTO USUARIO (nombre, telefono, email, contrasena, metodoPago, rol) VALUES (?, ?, ?, ?, ?, ?)`;
        const [resultado] = await pool.execute(query, [nombre, telefono, email, contrasena, metodoPago, rol || 'Cliente']);
        
        res.status(201).json({ mensaje: 'Usuario registrado con éxito', id_usuario: resultado.insertId });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Crear un Pedido (Calcula automáticamente productos + envío de la empresa)
app.post('/api/pedidos', async (asyncReq, asyncRes) => {
    const { id_usuario, id_empresa, metodo_pago, productos } = asyncReq.body;
    let conexion;

    try {
        // Obtenemos una conexión individual para manejar una Transacción Segura
        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        // A. Obtener la tarifa de envío de la empresa seleccionada
        const [empresa] = await conexion.execute('SELECT tarifa_envio FROM EMPRESA WHERE id_empresa = ?', [id_empresa]);
        if (empresa.length === 0) throw new Error('La empresa especificada no existe.');
        const tarifaEnvio = parseFloat(empresa[0].tarifa_envio);

        // enviar pedido desde la pagina
async function enviarPedidoAlServidor() {
       const datosPedido = {
        id_usuario: 1,      // ID del cliente logueado
        id_empresa: 2,      // ID de la empresa donde compra
        metodo_pago: "Efectivo",
        productos: [
            { id_producto: 10, cantidad: 2, precio: 15000 }, // Ejemplo: 2 productos de $15.000
            { id_producto: 14, cantidad: 1, precio: 8000 }   // Ejemplo: 1 producto de $8.000
        ]
    };

    try {
        const respuesta = await fetch('http://localhost:5000/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosPedido)
        });

        const resultado = await respuesta.json();
        if (respuesta.ok) {
            console.log("Éxito:", resultado.mensaje);
            alert(`Pedido confirmado. Total con envío: $${resultado.total}`);
        } else {
            console.error("Error en el servidor:", resultado.error);
        }
    } catch (err) {
        console.error("Error de conexión:", err);
    }
}

        // B. Insertar la cabecera del Pedido con un total provisional
        const queryPedido = `INSERT INTO PEDIDO (id_usuario, id_empresa, metodo_pago, total, estado) VALUES (?, ?, ?, 0.00, 'Pendiente')`;
        const [pedidoResultado] = await conexion.execute(queryPedido, [id_usuario, id_empresa, metodo_pago]);
        const id_pedido = pedidoResultado.insertId;

        let totalProductos = 0;

        // C. Recorrer los productos enviados desde el Frontend (JavaScript)
        for (const item of productos) {
            // Insertar en el detalle del pedido
            const queryDetalle = `INSERT INTO DETALLE_PEDIDO (id_pedido, id_producto, cantidad, precio) VALUES (?, ?, ?, ?)`;
            await conexion.execute(queryDetalle, [id_pedido, item.id_producto, item.cantidad, item.precio]);

            // Acumular el subtotal
            totalProductos += item.cantidad * item.precio;

            // Actualizar/reducir el stock en el inventario
            await conexion.execute('UPDATE PRODUCTO SET stock = stock - ? WHERE id_producto = ?', [item.cantidad, item.id_producto]);
        }

        // D. Calcular el Total Final (Productos + Tarifa Fija de Envío de la Empresa)
        const totalFinal = totalProductos + tarifaEnvio;

        // E. Actualizar el total definitivo en la base de datos
        await conexion.execute('UPDATE PEDIDO SET total = ? WHERE id_pedido = ?', [totalFinal, id_pedido]);

        // Confirmar la transacción completa
        await conexion.commit();
        res.status(201).json({ 
            mensaje: 'Pedido procesado exitosamente', 
            id_pedido, 
            subtotalProductos: totalProductos,
            costoEnvio: tarifaEnvio,
            total: totalFinal 
        });

    } catch (error) {
        if (conexion) await conexion.rollback();
        asyncRes.status(400).json({ error: error.message });
    } finally {
        if (conexion) conexion.release();
    }
});

// Asignar Domiciliario a un Pedido
app.put('/api/pedidos/asignar', async (req, res) => {
    const { id_pedido, id_domiciliario } = req.body;
    try {
        // Actualizar el estado del pedido
        await pool.execute('UPDATE PEDIDO SET id_domiciliario = ?, estado = "Asignado" WHERE id_pedido = ?', [id_domiciliario, id_pedido]);
        
        // Colocar al domiciliario en estado 'Ocupado'
        await pool.execute('UPDATE DOMICILIARIO SET estado = "Ocupado" WHERE id_domiciliario = ?', [id_domiciliario]);

        res.status(200).json({ mensaje: 'Domiciliario asignado correctamente al pedido.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Consultar Catálogo de Productos
app.get('/api/productos', async (req, res) => {
    try {
        const [productos] = await pool.execute('SELECT * FROM PRODUCTO WHERE stock > 0');
        res.status(200).json(productos);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

const { spawn } = require('child_process');

//  auto asignar domiciliario
app.post('/api/pedidos/auto-asignar', async (req, res) => {
    const { id_pedido } = req.body;

    try {
        // 1. Buscamos en MySQL los domiciliarios que estén 'Disponible'
        const [domiciliarios] = await pool.execute('SELECT id_domiciliario, nombre FROM DOMICILIARIO WHERE estado = "Disponible"');

        // prepara datos para enviar
        const paqueteData = {
            tarea: "asignar_repartidor",
            datos: {
                id_pedido: id_pedido,
                domiciliarios: domiciliarios
            }
        };

        // 2. Ejecutar el script de Python
        const pythonProcess = spawn('python', ['analitica.py']);
        pythonProcess.stdin.write(JSON.stringify(paqueteData));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', async (data) => {
            const respuestaPython = JSON.parse(data.toString());

            if (respuestaPython.status === "exitoso") {
                await pool.execute('UPDATE PEDIDO SET id_domiciliario = ?, estado = "Asignado" WHERE id_pedido = ?', 
                    [respuestaPython.id_domiciliario, respuestaPython.id_pedido]);
                
                await pool.execute('UPDATE DOMICILIARIO SET estado = "Ocupado" WHERE id_domiciliario = ?', 
                    [respuestaPython.id_domiciliario]);

                res.status(200).json({ mensaje: "Asignación automatizada por Python completada", datos: respuestaPython });
            } else {
                res.status(400).json({ error: respuestaPython.mensaje });
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Reporte
app.get('/api/empresas/:id/reporte', async (req, res) => {
    const id_empresa = req.params.id;

    try {
        // 1. Busca todos los pedidos históricos de esa empresa
        const [historial] = await pool.execute('SELECT estado, total FROM PEDIDO WHERE id_empresa = ?', [id_empresa]);

        const paqueteData = {
            tarea: "reporte_ventas",
            datos: {
                id_empresa: id_empresa,
                historial: historial
            }
        };

        // 2. Enviar los datos a Python para que realice el análisis estadístico
        const pythonProcess = spawn('python', ['analitica.py']);
        pythonProcess.stdin.write(JSON.stringify(paqueteData));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            const respuestaPython = JSON.parse(data.toString());
            // 3. Responder al frontend con las métricas calculadas por Python
            res.status(200).json(respuestaPython);
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// inico server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Servidor del backend corriendo en http://localhost:${PORT}`);
});