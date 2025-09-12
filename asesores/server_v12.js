// ============== SERVIDOR DE ASESORES Y VENTAS (v12.0 FINAL Con Base de Datos PostgreSQL) ==============
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg'); // <-- NUEVO: Herramienta para conectar a la base de datos

// --- Importaciones de Módulos (sin cambios) ---
const { assembleQuote } = require('./pricingEngine.js');
const { checkRole } = require('./permissions.js');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000; // <-- Render nos dará el puerto

// --- CONFIGURACIÓN DE LA BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // <-- Usa la "llave secreta" que configuramos en Render
    ssl: {
        rejectUnauthorized: false
    }
});

// --- FUNCIÓN PARA CREAR LAS TABLAS SI NO EXISTEN ---
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol VARCHAR(50) NOT NULL,
                estado VARCHAR(50) DEFAULT 'activo'
            );

            CREATE TABLE IF NOT EXISTS advisors (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS zones (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS centers (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50),
                name VARCHAR(255),
                contactName VARCHAR(255),
                contactNumber VARCHAR(50)
            );
            
            CREATE TABLE IF NOT EXISTS quotes (
                id SERIAL PRIMARY KEY,
                quoteNumber VARCHAR(50),
                clientName VARCHAR(255),
                advisorName VARCHAR(255),
                studentCount INTEGER,
                productIds INTEGER[],
                precioFinalPorEstudiante NUMERIC,
                estudiantesParaFacturar INTEGER,
                facilidadesAplicadas TEXT[],
                status VARCHAR(50) DEFAULT 'pendiente',
                rejectionReason TEXT,
                createdAt TIMESTAMPTZ DEFAULT NOW(),
                items JSONB,
                totals JSONB
            );

            CREATE TABLE IF NOT EXISTS visits (
                id SERIAL PRIMARY KEY,
                centerName VARCHAR(255),
                advisorName VARCHAR(255),
                visitDate DATE,
                commentText TEXT,
                createdAt TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Base de datos inicializada y tablas aseguradas.');
    } catch (err) {
        console.error('Error al inicializar la base de datos:', err);
    } finally {
        client.release();
    }
};


let products = []; // Caché de productos en memoria

// --- Carga de Productos desde CSV (sin cambios) ---
const loadProducts = () => {
    const csvPath = path.join(__dirname, 'Productos.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('Error: El archivo Productos.csv no se encuentra.');
        return;
    }
    const tempProducts = [];
    fs.createReadStream(csvPath)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim(),
            mapValues: ({ value }) => value.trim()
        }))
        .on('data', (row) => {
            tempProducts.push(row);
        })
        .on('end', () => {
            products = tempProducts.map((p, index) => ({ ...p, id: index + 1 }));
            console.log(`${products.length} productos cargados y procesados exitosamente desde Productos.csv.`);
        })
        .on('error', (error) => {
            console.error('Error al leer el CSV de productos:', error);
        });
};

app.use(session({
    secret: 'secreto_super_secreto_para_produccion', // Cambiado por seguridad
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Seguro en producción
}));

// --- Middleware (sin cambios en la lógica) ---
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'No autenticado.' });
    }
    next();
};
const requireAdmin = checkRole(['Administrador']);


// --- INICIO: RUTAS DE API ACTUALIZADAS PARA BASE DE DATOS ---

// LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND estado = $2', [username, 'activo']);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o inactivo.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta.' });

        const userResponse = { id: user.id, nombre: user.nombre, username: user.username, rol: user.rol };
        req.session.user = userResponse;
        res.status(200).json({ message: 'Login exitoso', redirectTo: '/index.html', user: userResponse });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// GESTIÓN DE USUARIOS
app.get('/api/users', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, username, rol, estado FROM users ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
    const { nombre, username, password, rol } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (nombre, username, password, rol) VALUES ($1, $2, $3, $4) RETURNING id',
            [nombre, username, hashedPassword, rol]
        );
        res.status(201).json({ message: 'Usuario creado con éxito', userId: result.rows[0].id });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // Código de error para violación de constraint 'unique'
            return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        }
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/users/:id/edit-role', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { newRole } = req.body;
    try {
        await pool.query('UPDATE users SET rol = $1 WHERE id = $2', [newRole, id]);
        res.status(200).json({ message: 'Rol actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/users/:id/toggle-status', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT estado FROM users WHERE id = $1', [id]);
        const newStatus = result.rows[0].estado === 'activo' ? 'inactivo' : 'activo';
        await pool.query('UPDATE users SET estado = $1 WHERE id = $2', [newStatus, id]);
        res.status(200).json({ message: 'Estado actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// ASESORES
app.get('/api/advisors', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM advisors ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/advisors', requireLogin, requireAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        const newAdvisor = await pool.query('INSERT INTO advisors (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(newAdvisor.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.delete('/api/advisors/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM advisors WHERE id = $1', [req.params.id]);
        res.status(200).json({ message: 'Asesor eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// COMENTARIOS
app.get('/api/comments', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM comments ORDER BY text ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/comments', requireLogin, requireAdmin, async (req, res) => {
    const { name } = req.body; // El frontend envía 'name'
    try {
        const newComment = await pool.query('INSERT INTO comments (text) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(newComment.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.delete('/api/comments/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
        res.status(200).json({ message: 'Comentario eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// ZONAS
app.get('/api/zones', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM zones ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/zones', requireLogin, requireAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        const newZone = await pool.query('INSERT INTO zones (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(newZone.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.delete('/api/zones/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM zones WHERE id = $1', [req.params.id]);
        res.status(200).json({ message: 'Zona eliminada' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// CENTROS
app.get('/api/centers', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM centers ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// COTIZACIONES
app.post('/api/quote-requests', requireLogin, async (req, res) => {
    const quoteInput = req.body;
    const dbDataForCalculation = { products: products }; // Usamos productos en memoria
    const calculationResult = assembleQuote(quoteInput, dbDataForCalculation);

    // Simplificamos los datos a guardar
    const { clientName, advisorName, studentCount, productIds } = quoteInput;
    const { precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, items, totals } = calculationResult;
    
    try {
        const result = await pool.query(
            `INSERT INTO quotes (clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, items, totals, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente') RETURNING *`,
            [clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, JSON.stringify(items), JSON.stringify(totals)]
        );
        res.status(201).json({ message: 'Cotización guardada con éxito', quote: result.rows[0] });
    } catch (err) {
        console.error('Error al guardar cotización:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.get('/api/quotes/pending-approval', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM quotes WHERE status = 'pendiente' ORDER BY createdAt DESC");
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching pending quotes:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.post('/api/quote-requests/:id/approve', requireLogin, requireAdmin, async (req, res) => {
    try {
        await pool.query("UPDATE quotes SET status = 'aprobada' WHERE id = $1", [req.params.id]);
        res.status(200).json({ message: 'Cotización aprobada con éxito' });
    } catch (err) {
        console.error('Error aprobando cotización:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


// VISITAS
app.post('/api/visits', requireLogin, async (req, res) => {
    const { centerName, advisorName, visitDate, commentText } = req.body;
    try {
        const newVisit = await pool.query(
            'INSERT INTO visits (centerName, advisorName, visitDate, commentText) VALUES ($1, $2, $3, $4) RETURNING *',
            [centerName, advisorName, visitDate, commentText]
        );
        res.status(201).json(newVisit.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// ... aquí irían las demás rutas de cotizaciones, pdfs, etc. que tendríamos que migrar...


// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
// CORREGIDO: Para que sirva los archivos desde la carpeta raíz del proyecto
const rootDir = path.join(__dirname, '..'); 
app.use(express.static(rootDir));
app.use('/public', express.static(path.join(rootDir, 'public')));
app.use('/asesores', express.static(path.join(rootDir, 'asesores'))); // Permite acceso a la carpeta asesores

app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'login.html')));
app.get('/*.html', requireLogin, (req, res) => {
    const requestedPath = path.join(rootDir, req.path);
    // Por seguridad, chequea que el archivo exista antes de enviarlo
    if (fs.existsSync(requestedPath)) {
        res.sendFile(requestedPath);
    } else {
        res.status(404).send('Página no encontrada');
    }
});


// --- Inicio del Servidor ---
app.listen(PORT, async () => {
    loadProducts();
    await initializeDatabase(); // Asegura que las tablas existan antes de empezar
    console.log(`✅ Servidor de Asesores (v12.0 FINAL Con DB) corriendo en el puerto ${PORT}`);
});
