const express = require('express');
const fs = require('fs');
const path = require('path');
const { assembleQuote } = require('./pricingEngine.js'); // Importar el motor de precios

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// --- Rutas de Páginas HTML ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/asesor', (req, res) => res.sendFile(path.join(__dirname, 'asesor.html')));
app.get('/asesores-menu', (req, res) => res.sendFile(path.join(__dirname, 'asesores_menu.html')));
app.get('/audiovisuales-menu', (req, res) => res.sendFile(path.join(__dirname, 'audiovisuales_menu.html')));
app.get('/logistica-menu', (req, res) => res.sendFile(path.join(__dirname, 'logistica_menu.html')));
app.get('/administrativo-menu', (req, res) => res.sendFile(path.join(__dirname, 'administrativo_menu.html')));
app.get('/tareas-menu', (req, res) => res.sendFile(path.join(__dirname, 'tareas_menu.html')));
app.get('/reporte_filtros', (req, res) => res.sendFile(path.join(__dirname, 'reporte_filtros.html')));
app.get('/aprobacion', (req, res) => res.sendFile(path.join(__dirname, 'aprobacion.html'))); // Nueva página

// --- Funciones de Ayuda para la Base de Datos ---
const readDB = () => {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const db = JSON.parse(data);
        const requiredKeys = ['advisors', 'centers', 'visits', 'zones', 'predefinedComments', 'quoteRequests', 'categories', 'facilities', 'products', 'venues', 'marginRules', 'gratuityRules'];
        requiredKeys.forEach(key => {
            if (!db[key]) db[key] = [];
        });
        return db;
    } catch (error) {
        console.error('Error leyendo la base de datos:', error);
        return { advisors: [], centers: [], visits: [], zones: [], predefinedComments: [], quoteRequests: [], categories: [], facilities: [], products: [], venues: [], marginRules: [], gratuityRules: [] };
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error escribiendo en la base de datos:', error);
    }
};

// --- Creador Genérico de Endpoints CRUD ---
const createCrudEndpoints = (resourceName, dbKey = resourceName) => {
    const resourcePath = `/api/${resourceName}`;
    const singleResourcePath = `${resourcePath}/:id`;

    app.get(resourcePath, (req, res) => {
        const db = readDB();
        res.json(db[dbKey]);
    });

    app.post(resourcePath, (req, res) => {
        const db = readDB();
        const newItem = req.body;
        newItem.id = Date.now();
        db[dbKey].push(newItem);
        writeDB(db);
        res.status(201).json({ message: `${resourceName} añadido con éxito`, item: newItem });
    });

    app.delete(singleResourcePath, (req, res) => {
        const db = readDB();
        const id = parseInt(req.params.id, 10);
        const initialLength = db[dbKey].length;
        db[dbKey] = db[dbKey].filter(item => item.id !== id);
        if (db[dbKey].length === initialLength) {
            return res.status(404).json({ message: `Elemento no encontrado en ${resourceName}` });
        }
        writeDB(db);
        res.status(200).json({ message: `${resourceName} eliminado con éxito` });
    });
};

// --- Creación de Rutas CRUD para la API ---
createCrudEndpoints('products');
createCrudEndpoints('venues');
createCrudEndpoints('marginRules');
createCrudEndpoints('gratuityRules');
createCrudEndpoints('advisors');
createCrudEndpoints('zones');
createCrudEndpoints('comments', 'predefinedComments');

// --- Rutas de API Específicas ---
// ... (se mantienen las rutas de visits, centers, report, etc.)

// --- Rutas de API para Cotizaciones y Aprobaciones ---

// GET /api/quote-requests?status=...
app.get('/api/quote-requests', (req, res) => {
    const { status } = req.query;
    const db = readDB();
    let quotes = db.quoteRequests;
    if (status) {
        quotes = quotes.filter(q => q.status === status);
    }
    res.json(quotes);
});

// POST /api/quote-requests (Crear nueva)
app.post('/api/quote-requests', (req, res) => {
    const db = readDB();
    const quoteInput = req.body;
    if (!quoteInput.studentCount || !quoteInput.productIds) {
        return res.status(400).json({ message: 'Faltan datos clave para la cotización (studentCount, productIds).' });
    }
    try {
        const finalQuote = assembleQuote(quoteInput, db);
        db.quoteRequests.push(finalQuote);
        writeDB(db);
        res.status(201).json({ message: 'Cotización calculada y registrada con éxito', quote: finalQuote });
    } catch (error) {
        console.error('Error al procesar la cotización:', error);
        res.status(500).json({ message: 'Ocurrió un error en el servidor al calcular la cotización.' });
    }
});

// POST /api/quote-requests/:id/approve
app.post('/api/quote-requests/:id/approve', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const quoteIndex = db.quoteRequests.findIndex(q => q.id === id);
    if (quoteIndex === -1) return res.status(404).json({ message: 'Cotización no encontrada.' });

    db.quoteRequests[quoteIndex].status = 'Aprobada';
    writeDB(db);
    res.json({ message: 'Cotización aprobada con éxito', quote: db.quoteRequests[quoteIndex] });
});

// POST /api/quote-requests/:id/reject
app.post('/api/quote-requests/:id/reject', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const quoteIndex = db.quoteRequests.findIndex(q => q.id === id);
    if (quoteIndex === -1) return res.status(404).json({ message: 'Cotización no encontrada.' });

    db.quoteRequests[quoteIndex].status = 'Rechazada';
    db.quoteRequests[quoteIndex].rejectionReason = reason || 'Sin motivo específico';
    writeDB(db);
    res.json({ message: 'Cotización rechazada con éxito', quote: db.quoteRequests[quoteIndex] });
});

// PUT /api/quote-requests/:id (Modificar)
app.put('/api/quote-requests/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const updatedQuoteData = req.body;
    const quoteIndex = db.quoteRequests.findIndex(q => q.id === id);
    if (quoteIndex === -1) return res.status(404).json({ message: 'Cotización no encontrada.' });

    // Recalcular la cotización con los nuevos datos
    try {
        const finalQuote = assembleQuote(updatedQuoteData, db);
        finalQuote.id = id; // Mantener el ID original
        db.quoteRequests[quoteIndex] = finalQuote;
        writeDB(db);
        res.json({ message: 'Cotización modificada y recalculada con éxito', quote: finalQuote });
    } catch (error) {
        console.error('Error al modificar la cotización:', error);
        res.status(500).json({ message: 'Ocurrió un error en el servidor al modificar la cotización.' });
    }
});


// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Abre http://localhost:3000 en tu navegador para usar la aplicación.');
});
