// ============== SERVIDOR DE ASESORES Y VENTAS (v10.0 Estable y Completo) ==============
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { assembleQuote } = require('./pricingEngine.js');
const { sendInvitationEmail } = require('./mailer.js');
const { checkRole } = require('./permissions.js');

const app = express();
app.use(express.json());
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db_asesores.json');

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
            const initialData = { users: [], advisors: [], comments: [], centers: [], visits: [] };
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
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect('/');
        }
        return res.status(401).json({ message: 'No autenticado.' });
    }
    next();
};
const requireAdmin = checkRole(['Administrador']);

// --- TODAS LAS RUTAS DE API ---
// (Usuarios, Asesores, Comentarios, Centros, Visitas)
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

app.get('/api/centers/search', requireLogin, (req, res) => {
    const searchTerm = (req.query.q || '').toLowerCase();
    const db = readDB();
    const centers = (db.centers || []).filter(c => c && c.name && c.name.toLowerCase().includes(searchTerm));
    res.json(centers);
});

app.get('/api/centers', requireLogin, (req, res) => {
    res.json(readDB().centers || []);
});



app.put('/api/centers/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    const centerId = parseInt(req.params.id);
    db.centers = (db.centers || []).map(c => {
        if (c.id === centerId) {
            return { ...c, ...req.body };
        }
        return c;
    });
    writeDB(db);
    res.status(200).json({ message: 'Centro actualizado' });
});

app.delete('/api/centers/:id', requireLogin, requireAdmin, (req, res) => {
    const db = readDB();
    db.centers = (db.centers || []).filter(c => c.id !== parseInt(req.params.id));
    writeDB(db);
    res.status(200).json({ message: 'Centro eliminado' });
});

app.get('/api/data', requireLogin, (req, res) => {
    const db = readDB();
    res.json({ advisors: db.advisors || [], comments: db.comments || [], centers: db.centers || [] });
});
app.post('/api/visits', requireLogin, (req, res) => {
    const db = readDB();
    const visitData = req.body;

    // Lógica para crear centro si no existe
    if (visitData.centerName) {
        const centerExists = (db.centers || []).some(c => c.name.toLowerCase() === visitData.centerName.toLowerCase());
        if (!centerExists) {
            let nextCode = 1001; // Número inicial para los códigos de centro
            if (db.centers && db.centers.length > 0) {
                const maxCode = db.centers.reduce((max, center) => {
                    const codeNum = parseInt((center.code || 'C-0').split('-')[1]);
                    return codeNum > max ? codeNum : max;
                }, 0);
                nextCode = maxCode > 0 ? maxCode + 1 : 1001; // Asegura empezar en 1001
            }
            const newCenter = {
                id: Date.now(),
                code: 'C-' + nextCode, // Asignar código secuencial
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

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS (ORDEN DEFINITIVO) ---

// Regla 1: Definir las páginas PÚBLICAS que no necesitan login.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// Regla 2: Servir TODOS los archivos estáticos (CSS, JS, imágenes).
// Al estar aquí, esta regla se ejecuta ANTES que las reglas de las páginas protegidas.
// Esta es la corrección clave.
app.use(express.static(__dirname));

// Regla 3: Definir las páginas PROTEGIDAS. El guardián 'requireLogin' se aplica a cada una.
app.get('/index.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin_menu.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_menu.html')));
app.get('/admin_asesores.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_asesores.html')));
app.get('/admin_comentarios.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_comentarios.html')));
app.get('/registrar_visita.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'registrar_visita.html')));

// --- Inicio del Servidor ---
app.listen(PORT, () => {
    console.log(`✅ Servidor de Asesores (Estable y Completo) corriendo en http://localhost:${PORT}`);
});