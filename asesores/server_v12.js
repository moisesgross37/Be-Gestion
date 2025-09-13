// ============== SERVIDOR DE ASESORES Y VENTAS (v12.8 FINAL CON CREACIÓN DE CENTROS) ==============
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

const { assembleQuote } = require('./pricingEngine.js');
const { checkRole } = require('./permissions.js');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, rol VARCHAR(50) NOT NULL, estado VARCHAR(50) DEFAULT 'activo' );
            CREATE TABLE IF NOT EXISTS advisors ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL );
            CREATE TABLE IF NOT EXISTS comments ( id SERIAL PRIMARY KEY, text TEXT NOT NULL );
            CREATE TABLE IF NOT EXISTS zones ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL );
            CREATE TABLE IF NOT EXISTS centers ( id SERIAL PRIMARY KEY, code VARCHAR(50), name VARCHAR(255), contactName VARCHAR(255), contactNumber VARCHAR(50) );
            CREATE TABLE IF NOT EXISTS quotes ( id SERIAL PRIMARY KEY, quoteNumber VARCHAR(50), clientName VARCHAR(255), advisorName VARCHAR(255), studentCount INTEGER, productIds INTEGER[], precioFinalPorEstudiante NUMERIC, estudiantesParaFacturar INTEGER, facilidadesAplicadas TEXT[], status VARCHAR(50) DEFAULT 'pendiente', rejectionReason TEXT, createdAt TIMESTAMPTZ DEFAULT NOW(), items JSONB, totals JSONB );
            CREATE TABLE IF NOT EXISTS visits ( id SERIAL PRIMARY KEY, centerName VARCHAR(255), advisorName VARCHAR(255), visitDate DATE, commentText TEXT, createdAt TIMESTAMPTZ DEFAULT NOW() );
        `);
    } catch (err) {
       console.error('Error al inicializar las tablas de la aplicación:', err);
    } finally {
        client.release();
    }
};

let products = [];
const loadProducts = () => {
    const csvPath = path.join(__dirname, 'Productos.csv');
    if (!fs.existsSync(csvPath)) { return; }
    const tempProducts = [];
    fs.createReadStream(csvPath)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim(), mapValues: ({ value }) => value.trim() }))
        .on('data', (row) => { tempProducts.push(row); })
        .on('end', () => {
            products = tempProducts.map((p, index) => ({ ...p, id: index + 1 }));
            console.log(`${products.length} productos cargados y procesados exitosamente desde Productos.csv.`);
        });
};

app.set('trust proxy', 1);
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: 'un_secreto_mucho_mas_largo_y_seguro_para_produccion_final',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    }
}));

const requireLogin = (req, res, next) => { if (!req.session.user) { return res.status(401).json({ message: 'No autenticado.' }); } next(); };
const requireAdmin = checkRole(['Administrador']);

// --- RUTAS DE API ---

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
    } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.status(500).json({ message: 'No se pudo cerrar la sesión.' }); }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
    });
});

// Users
app.get('/api/users', requireLogin, requireAdmin, async (req, res) => { try { const result = await pool.query('SELECT id, nombre, username, rol, estado FROM users ORDER BY nombre ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
    const { nombre, username, password, rol } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (nombre, username, password, rol) VALUES ($1, $2, $3, $4)', [nombre, username, hashedPassword, rol]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { return res.status(409).json({ message: 'El nombre de usuario ya existe.' }); }
        res.status(500).json({ message: 'Error en el servidor' });
    }
});
app.post('/api/users/:id/edit-role', requireLogin, requireAdmin, async (req, res) => { const { id } = req.params; const { newRole } = req.body; try { await pool.query('UPDATE users SET rol = $1 WHERE id = $2', [newRole, id]); res.status(200).json({ message: 'Rol actualizado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/users/:id/toggle-status', requireLogin, requireAdmin, async (req, res) => { const { id } = req.params; try { const result = await pool.query('SELECT estado FROM users WHERE id = $1', [id]); const newStatus = result.rows[0].estado === 'activo' ? 'inactivo' : 'activo'; await pool.query('UPDATE users SET estado = $1 WHERE id = $2', [newStatus, id]); res.status(200).json({ message: 'Estado actualizado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

// Advisors
app.get('/api/advisors', requireLogin, async (req, res) => { try { const result = await pool.query('SELECT * FROM advisors ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/advisors', requireLogin, requireAdmin, async (req, res) => { const { name } = req.body; try { const newAdvisor = await pool.query('INSERT INTO advisors (name) VALUES ($1) RETURNING *', [name]); res.status(201).json(newAdvisor.rows[0]); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.delete('/api/advisors/:id', requireLogin, requireAdmin, async (req, res) => { try { await pool.query('DELETE FROM advisors WHERE id = $1', [req.params.id]); res.status(200).json({ message: 'Asesor eliminado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

// Visits
app.get('/api/visits', requireLogin, async (req, res) => { try { const result = await pool.query('SELECT * FROM visits ORDER BY visitDate DESC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

// CORRECCIÓN: Se restaura la lógica para crear un centro si no existe al registrar una visita
app.post('/api/visits', requireLogin, async (req, res) => {
    const { centerName, advisorName, visitDate, commentText, coordinatorName, coordinatorContact } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Iniciar transacción

        // 1. Verificar si el centro ya existe
        let centerResult = await client.query('SELECT id FROM centers WHERE name = $1', [centerName]);
        
        // 2. Si no existe, crearlo
        if (centerResult.rows.length === 0) {
            console.log(`El centro "${centerName}" no existe, se creará uno nuevo.`);
            await client.query(
                'INSERT INTO centers (name, contactName, contactNumber) VALUES ($1, $2, $3)',
                [centerName, coordinatorName || '', coordinatorContact || '']
            );
        }

        // 3. Registrar la visita
        await client.query(
            'INSERT INTO visits (centerName, advisorName, visitDate, commentText) VALUES ($1, $2, $3, $4)',
            [centerName, advisorName, visitDate, commentText]
        );

        await client.query('COMMIT'); // Confirmar transacción
        res.status(201).json({ message: "Visita registrada y centro asegurado" });
    } catch (err) {
        await client.query('ROLLBACK'); // Revertir en caso de error
        console.error("Error al registrar visita:", err);
        res.status(500).json({ message: 'Error en el servidor' });
    } finally {
        client.release();
    }
});

// Centers
app.get('/api/centers', requireLogin, async (req, res) => { try { const result = await pool.query('SELECT * FROM centers ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.get('/api/centers/search', requireLogin, async (req, res) => {
    const searchTerm = (req.query.q || '').toLowerCase();
    try {
        const result = await pool.query("SELECT id, name FROM centers WHERE LOWER(name) LIKE $1", [`%${searchTerm}%`]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error en la búsqueda de centros:', err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Zones
app.get('/api/zones', requireLogin, requireAdmin, async (req, res) => { try { const result = await pool.query('SELECT * FROM zones ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/zones', requireLogin, requireAdmin, async (req, res) => { const { name } = req.body; try { const newZone = await pool.query('INSERT INTO zones (name) VALUES ($1) RETURNING *', [name]); res.status(201).json(newZone.rows[0]); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.delete('/api/zones/:id', requireLogin, requireAdmin, async (req, res) => { try { await pool.query('DELETE FROM zones WHERE id = $1', [req.params.id]); res.status(200).json({ message: 'Zona eliminada' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

// Comments
app.get('/api/comments', requireLogin, requireAdmin, async (req, res) => { try { const result = await pool.query('SELECT * FROM comments ORDER BY text ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/comments', requireLogin, requireAdmin, async (req, res) => { const { name } = req.body; try { const newComment = await pool.query('INSERT INTO comments (text) VALUES ($1) RETURNING *', [name]); res.status(201).json(newComment.rows[0]); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.delete('/api/comments/:id', requireLogin, requireAdmin, async (req, res) => { try { await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]); res.status(200).json({ message: 'Comentario eliminado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

// Quote Logic
app.get('/api/next-quote-number', requireLogin, async (req, res) => {
    try {
        const result = await pool.query("SELECT quoteNumber FROM quotes WHERE quoteNumber LIKE 'COT-%' ORDER BY CAST(SUBSTRING(quoteNumber FROM 5) AS INTEGER) DESC LIMIT 1");
        const lastNumber = result.rows.length > 0 ? parseInt(result.rows[0].quotenumber.split('-')[1]) : 240000;
        const nextNumber = lastNumber + 1;
        res.json({ quoteNumber: `COT-${nextNumber}` });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); }
});

app.get('/api/data', requireLogin, async (req, res) => {
    try {
        const [advisors, comments, centers, zones] = await Promise.all([
            pool.query('SELECT * FROM advisors ORDER BY name ASC'),
            pool.query('SELECT * FROM comments ORDER BY text ASC'),
            pool.query('SELECT * FROM centers ORDER BY name ASC'),
            pool.query('SELECT * FROM zones ORDER BY name ASC')
        ]);
        res.json({ advisors: advisors.rows, comments: comments.rows, centers: centers.rows, zones: zones.rows, products: products });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); }
});

app.post('/api/quotes/calculate-estimate', requireLogin, (req, res) => {
    const quoteInput = req.body;
    const dbDataForCalculation = { products: products };
    try {
        const estimate = assembleQuote(quoteInput, dbDataForCalculation);
        res.json(estimate);
    } catch (error) {
        console.error("Error en el motor de precios:", error);
        res.status(500).json({ message: "Error al calcular la estimación." });
    }
});

app.post('/api/quote-requests', requireLogin, async (req, res) => { const quoteInput = req.body; const dbDataForCalculation = { products: products }; const calculationResult = assembleQuote(quoteInput, dbDataForCalculation); const { clientName, advisorName, studentCount, productIds, quoteNumber } = quoteInput; const { precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, items, totals } = calculationResult; try { await pool.query( `INSERT INTO quotes (clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, items, totals, status, quoteNumber) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente', $10)`, [clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, JSON.stringify(items), JSON.stringify(totals), quoteNumber] ); res.status(201).json({ message: 'Cotización guardada con éxito' }); } catch (err) { console.error('Error al guardar cotización:', err); res.status(500).json({ message: 'Error interno del servidor.' }); } });

app.get('/api/quote-requests', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM quotes ORDER BY createdAt DESC");
        res.status(200).json(result.rows);
    } catch (err) { console.error('Error fetching quotes:', err); res.status(500).json({ message: 'Error interno del servidor.' }); }
});

app.get('/api/quotes/pending-approval', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM quotes WHERE status = 'pendiente' ORDER BY createdAt DESC");
        res.status(200).json(result.rows);
    } catch (err) { console.error('Error fetching pending quotes:', err); res.status(500).json({ message: 'Error interno del servidor.' }); }
});

app.post('/api/quote-requests/:id/approve', requireLogin, requireAdmin, async (req, res) => { try { await pool.query("UPDATE quotes SET status = 'aprobada' WHERE id = $1", [req.params.id]); res.status(200).json({ message: 'Cotización aprobada con éxito' }); } catch (err) { console.error('Error aprobando cotización:', err); res.status(500).json({ message: 'Error interno del servidor.' }); } });

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/*.html', requireLogin, (req, res) => { const requestedPath = path.join(__dirname, req.path); if (fs.existsSync(requestedPath)) { res.sendFile(requestedPath); } else { res.status(404).send('Página no encontrada'); } });

app.listen(PORT, async () => {
    loadProducts();
    await initializeDatabase();
    console.log(`✅ Servidor de Asesores (v12.8 FINAL Y COMPLETO) corriendo en el puerto ${PORT}`);
});
