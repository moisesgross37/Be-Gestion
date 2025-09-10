// ============== SERVIDOR DE ASESORES Y VENTAS (v11.0 Con Cotizador) ==============
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { assembleQuote } = require('./pricingEngine.js');
const { sendInvitationEmail } = require('./mailer.js');
const { checkRole } = require('./permissions.js');
const csv = require('csv-parser');

const app = express();
app.use(express.json());
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db_asesores.json');

let products = []; // Caché de productos en memoria

// --- Carga de Productos desde CSV ---
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
    secret: 'secreto_del_modulo_asesores_estable',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// --- Middleware y Helpers ---
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = { users: [], advisors: [], comments: [], centers: [], visits: [], zones: [], quotes: [], products: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) { console.error('Error reading DB:', error); return {}; }
};
const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'No autenticado.' });
    }
    next();
};
const requireAdmin = checkRole(['Administrador']);

// --- TODAS LAS RUTAS DE API ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    const user = (db.users || []).find(u => u.email === email && u.estado === 'activo');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta.' });
    const userResponse = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    req.session.user = userResponse;
    res.status(200).json({ message: 'Login exitoso', redirectTo: '/index.html', user: userResponse });
});

app.get('/api/advisors', requireLogin, (req, res) => res.json(readDB().advisors || []));
app.post('/api/advisors', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    const newAdvisor = { id: Date.now(), name: req.body.name };
    if (!db.advisors) db.advisors = [];
    db.advisors.push(newAdvisor);
    writeDB(db);
    res.status(201).json(newAdvisor);
});
app.delete('/api/advisors/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    db.advisors = (db.advisors || []).filter(a => a.id !== parseInt(req.params.id));
    writeDB(db);
    res.status(200).json({ message: 'Asesor eliminado' });
});

app.get('/api/comments', requireLogin, requireAdmin, (req, res) => res.json(readDB().comments || []));
app.post('/api/comments', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    const newComment = { id: Date.now(), text: req.body.name };
    if (!db.comments) db.comments = [];
    db.comments.push(newComment);
    writeDB(db);
    res.status(201).json(newComment);
});
app.delete('/api/comments/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    db.comments = (db.comments || []).filter(c => c.id !== parseInt(req.params.id));
    writeDB(db);
    res.status(200).json({ message: 'Comentario eliminado' });
});

app.get('/api/zones', requireLogin, (req, res) => res.json(readDB().zones || []));
app.post('/api/zones', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    const newZone = { id: Date.now(), name: req.body.name };
    if (!db.zones) db.zones = [];
    db.zones.push(newZone);
    writeDB(db);
    res.status(201).json(newZone);
});
app.delete('/api/zones/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    db.zones = (db.zones || []).filter(z => z.id !== parseInt(req.params.id));
    writeDB(db);
    res.status(200).json({ message: 'Zona eliminada' });
});

app.get('/api/centers/search', requireLogin, (req, res) => {
    const searchTerm = (req.query.q || '').toLowerCase();
    const db = readDB();
    const centers = (db.centers || []).filter(c => c && c.name && c.name.toLowerCase().includes(searchTerm));
    res.json(centers);
});
app.get('/api/centers', requireLogin, (req, res) => res.json(readDB().centers || []));
app.put('/api/centers/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    const centerId = parseInt(req.params.id);
    db.centers = (db.centers || []).map(c => c.id === centerId ? { ...c, ...req.body } : c);
    writeDB(db);
    res.status(200).json({ message: 'Centro actualizado' });
});
app.delete('/api/centers/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    db.centers = (db.centers || []).filter(c => c.id !== parseInt(req.params.id));
    writeDB(db);
    res.status(200).json({ message: 'Centro eliminado' });
});

// --- API para Cotizaciones ---
app.get('/api/next-quote-number', requireLogin, (req, res) => {
    const db = readDB();
    const quotes = db.quotes || [];
    const lastQuote = quotes.sort((a, b) => {
        const numA = parseInt(a.quoteNumber.split('-')[1]);
        const numB = parseInt(b.quoteNumber.split('-')[1]);
        return numB - numA;
    })[0];
    const nextNumber = lastQuote ? parseInt(lastQuote.quoteNumber.split('-')[1]) + 1 : 240001;
    res.json({ quoteNumber: `COT-${nextNumber}` });
});

app.post('/api/quotes/calculate-estimate', requireLogin, (req, res) => {
    const quoteInput = req.body;
    const dbData = readDB();
    dbData.products = products; // Inyectar productos cargados desde CSV
    const estimate = assembleQuote(quoteInput, dbData);
    res.json(estimate);
});

app.post('/api/quote-requests', requireLogin, (req, res) => {
    const db = readDB();
    const newQuote = {
        ...req.body,
        id: Date.now(),
        status: 'pendiente',
        createdAt: new Date().toISOString()
    };
    if (!db.quotes) db.quotes = [];
    db.quotes.push(newQuote);
    writeDB(db);
    res.status(201).json({ message: 'Cotización guardada con éxito', quote: newQuote });
});

app.get('/api/quotes', requireLogin, requireAdmin, (req, res) => {
    try {
        const db = readDB();
        const allQuotes = db.quotes || [];
        res.status(200).json(allQuotes);
    } catch (error) {
        console.error('Error fetching all quotes:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener cotizaciones.' });
    }
});

app.get('/api/quotes/pending-approval', requireLogin, requireAdmin, (req, res) => {
    try {
        const db = readDB();
        const pendingQuotes = (db.quotes || []).filter(q => q.status === 'pendiente');
        res.status(200).json(pendingQuotes);
    } catch (error) {
        console.error('Error fetching pending quotes:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener cotizaciones.' });
    }
});

app.get('/api/data', requireLogin, (req, res) => {
    const db = readDB();
    res.json({
        advisors: db.advisors || [], 
        comments: db.comments || [], 
        centers: db.centers || [],
        zones: db.zones || [],
        products: products
    });
});

app.get('/api/visits', requireLogin, (req, res) => res.json(readDB().visits || []));
app.post('/api/visits', requireLogin, (req, res) => {
    const db = readDB();
    const visitData = req.body;
    if (visitData.centerName) {
        const centerExists = (db.centers || []).some(c => c.name.toLowerCase() === visitData.centerName.toLowerCase());
        if (!centerExists) {
            let nextCode = 1001;
            if (db.centers && db.centers.length > 0) {
                const maxCode = db.centers.reduce((max, center) => {
                    const codeNum = parseInt((center.code || 'C-0').split('-')[1]);
                    return codeNum > max ? codeNum : max;
                }, 0);
                nextCode = maxCode > 0 ? maxCode + 1 : 1001;
            }
            const newCenter = {
                id: Date.now(),
                code: 'C-' + nextCode,
                name: visitData.centerName,
                contactName: visitData.coordinatorName || '',
                contactNumber: visitData.coordinatorContact || ''
            };
            if (!db.centers) db.centers = [];
            db.centers.push(newCenter);
        }
    }
    const newVisit = { id: Date.now(), ...visitData };
    if (!db.visits) db.visits = [];
    db.visits.push(newVisit);
    writeDB(db);
    res.status(201).json(newVisit);
});

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/index.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin_menu.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_menu.html')));
app.get('/admin_asesores.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_asesores.html')));
app.get('/admin_comentarios.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_comentarios.html')));
app.get('/registrar_visita.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'registrar_visita.html')));
app.get('/solicitud_cotizacion.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'solicitud_cotizacion.html')));

// --- Inicio del Servidor ---
app.listen(PORT, () => {
    loadProducts(); // Cargar productos al iniciar
    console.log('✅ Servidor de Asesores (v11.0 Con Cotizador) corriendo en http://localhost:3000');
});
