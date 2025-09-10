// ============== SERVIDOR DE DISEÑO Y CONFECCIÓN ==============
// Puerto: 3001
// Base de Datos: db_confeccion.json
// Responsabilidad: Gestionar proyectos de diseño, producción y calidad.
// ==========================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { checkRole } = require('./permissions.js'); // Necesitarás copiar este archivo aquí también

const app = express();
app.use(express.json());
const PORT = 3001;
const DB_PATH = path.join(__dirname, 'db_confeccion.json');

app.use(session({
    secret: 'secreto_del_modulo_confeccion',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// --- Middleware y Helpers ---
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            // Crea una DB inicial si no existe
            const initialData = { users: [], proyectos_confeccion: [], disenadores: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading DB:', error);
        return {};
    }
};

const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

const requireLogin = (req, res, next) => {
    // Nota: El login REAL se hace contra el servidor de asesores.
    // Esta es una verificación de sesión simple. En un futuro,
    // ambos servidores podrían validar sesiones contra una base de datos compartida (ej. Redis).
    if (!req.session.user) {
        return res.status(401).json({ message: 'No autenticado.' });
    }
    next();
};

// --- Rutas de API: Gestión de Usuarios (Copia simplificada) ---
// En una arquitectura real, el login sería un servicio aparte.
// Por ahora, asumimos que el usuario ya se logueó en el módulo de asesores
// y tiene una sesión válida. No replicamos aquí /api/login.

// --- Rutas de API: Lógica de Confección ---
app.get('/api/proyectos', requireLogin, (req, res) => {
    const db = readDB();
    res.json(db.proyectos_confeccion || []);
});

// (Aquí puedes añadir más rutas como POST /api/proyectos, GET /api/disenadores, etc.)


// --- Rutas HTML ---
app.use(express.static(__dirname)); // Sirve archivos estáticos (CSS, JS) desde la carpeta /confeccion

// Como el login no está aquí, redirigimos a la página de login principal si no hay sesión
app.get('/', (req, res) => {
    if (!req.session.user) {
        res.send('<h1>Módulo de Confección</h1><p>Por favor, inicie sesión a través del <a href="http://localhost:3000">portal principal</a>.</p>');
    } else {
        res.redirect('/confeccion-dashboard.html');
    }
});

// Paneles de Confección
const confeccionRoles = ['Administrador', 'Coordinador', 'Asesor', 'Diseñador', 'Colaborador / Staff'];
app.get('/confeccion-dashboard.html', requireLogin, checkRole(confeccionRoles), (req, res) => res.sendFile(path.join(__dirname, 'confeccion-dashboard.html')));
app.get('/vista-disenador.html', requireLogin, checkRole(['Administrador', 'Diseñador']), (req, res) => res.sendFile(path.join(__dirname, 'vista_disenador.html')));
app.get('/panel-produccion.html', requireLogin, checkRole(confeccionRoles), (req, res) => res.sendFile(path.join(__dirname, 'panel_produccion.html')));
app.get('/panel-calidad.html', requireLogin, checkRole(confeccionRoles), (req, res) => res.sendFile(path.join(__dirname, 'panel_calidad.html')));
app.get('/proyecto-diseno.html', requireLogin, checkRole(confeccionRoles), (req, res) => res.sendFile(path.join(__dirname, 'proyecto_diseno.html')));
app.get('/panel_asignacion.html', requireLogin, checkRole(['Administrador']), (req, res) => res.sendFile(path.join(__dirname, 'panel_asignacion.html')));
app.get('/panel_aprobacion-interna.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'panel_aprobacion-interna.html')));
app.get('/crear-solicitud-diseno.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'crear_solicitud_diseno.html')));


// --- Inicio del Servidor ---
app.listen(PORT, () => {
    console.log(`👕 Servidor de Confección corriendo en http://localhost:${PORT}`);
});