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

app.get('/api/data', (req, res) => res.json(readDB()));

app.post('/api/visits', (req, res) => {
    const db = readDB();
    const newVisit = req.body;
    newVisit.id = Date.now();
    newVisit.recordedAt = new Date().toISOString();
    db.visits.push(newVisit);
    if (!db.centers.some(c => c.name.toLowerCase() === newVisit.centerName.toLowerCase())) {
        db.centers.push({ id: Date.now(), name: newVisit.centerName, contactName: newVisit.contactName, contactNumber: newVisit.contactNumber });
    }
    writeDB(db);
    res.status(201).json({ message: 'Visita registrada con éxito', visit: newVisit });
});

app.get('/api/centers', (req, res) => res.json(readDB().centers));

app.put('/api/centers/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const { name, contactName, contactNumber } = req.body;
    const centerIndex = db.centers.findIndex(c => c.id === id);
    if (centerIndex === -1) return res.status(404).json({ message: 'Centro no encontrado' });
    db.centers[centerIndex].name = name || db.centers[centerIndex].name;
    db.centers[centerIndex].contactName = contactName || db.centers[centerIndex].contactName;
    db.centers[centerIndex].contactNumber = contactNumber || db.centers[centerIndex].contactNumber;
    writeDB(db);
    res.json({ message: 'Centro actualizado con éxito', center: db.centers[centerIndex] });
});

app.delete('/api/centers/:id', (req, res) => {
    const db = readDB();
    db.centers = db.centers.filter(c => c.id !== parseInt(req.params.id, 10));
    writeDB(db);
    res.status(200).json({ message: 'Centro eliminado con éxito' });
});

app.get('/api/report', (req, res) => {
    const { advisor, startDate, endDate } = req.query;
    let filteredVisits = readDB().visits;
    if (advisor) filteredVisits = filteredVisits.filter(v => v.advisorName === advisor);
    if (startDate) filteredVisits = filteredVisits.filter(v => new Date(v.visitDate) >= new Date(startDate));
    if (endDate) filteredVisits = filteredVisits.filter(v => new Date(v.visitDate) <= new Date(endDate));
    res.json(filteredVisits);
});

app.get('/api/categories', (req, res) => res.json(readDB().categories));
app.get('/api/facilities', (req, res) => res.json(readDB().facilities));

// --- Rutas de API para Solicitudes de Cotización (CON MOTOR DE PRECIOS) ---
app.get('/api/next-quote-number', (req, res) => {
    const db = readDB();
    const lastQuoteNumber = db.quoteRequests.length > 0 ? db.quoteRequests[db.quoteRequests.length - 1].quoteNumber : 'COT00';
    const num = parseInt(lastQuoteNumber.replace('COT', ''), 10) + 1;
    const nextQuoteNumber = 'COT' + String(num).padStart(2, '0');
    res.json({ nextQuoteNumber });
});

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

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Abre http://localhost:3000 en tu navegador para usar la aplicación.');
});