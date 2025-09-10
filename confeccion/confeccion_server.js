console.log("--- Servidor de Confección v5.5 - Control de Calidad ---");

const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 3001;

const dbConfeccionPath = path.join(__dirname, 'db_confeccion.json');
const dbMainPath = path.join(__dirname, 'db.json');

// --- Middleware y Configs ---
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads_confeccion', express.static(path.join(__dirname, 'uploads_confeccion')));
const storage = multer.diskStorage({
    destination: (req, file, cb) => { const dir = './uploads_confeccion'; if (!fs.existsSync(dir)){ fs.mkdirSync(dir); } cb(null, dir); },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- Funciones DB ---
function readDB(filePath) {
    if (!fs.existsSync(filePath)) {
        let defaultData = (filePath.includes('db_confeccion.json')) ? { proyectos_confeccion: [], disenadores: [] } : { centers: [], advisors: [] };
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeDB(filePath, data) { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }

function findProjectAndUpdate(req, res, updateLogic) {
    const db = readDB(dbConfeccionPath);
    const pIndex = db.proyectos_confeccion.findIndex(p => p.id == req.params.id);
    if (pIndex !== -1) {
        const proyecto = db.proyectos_confeccion[pIndex];
        updateLogic(proyecto, req, res);
        writeDB(dbConfeccionPath, db);
        res.json(proyecto);
    } else { res.status(404).json({ message: 'Proyecto no encontrado' }); }
}

// --- Rutas HTML ---
app.get('/panel_confeccion.html', (req, res) => res.sendFile(path.join(__dirname, 'panel_confeccion.html')));
app.get('/solicitud_confeccion.html', (req, res) => res.sendFile(path.join(__dirname, 'solicitud_confeccion.html')));
app.get('/detalle_proyecto.html', (req, res) => res.sendFile(path.join(__dirname, 'detalle_proyecto.html')));
app.get('/admin_diseñadores.html', (req, res) => res.sendFile(path.join(__dirname, 'admin_diseñadores.html')));

// --- RUTAS DE API ---
app.get('/api/proyectos', (req, res) => res.json(readDB(dbConfeccionPath).proyectos_confeccion || []));
app.get('/api/proyectos/:id', (req, res) => { const db = readDB(dbConfeccionPath); const p = db.proyectos_confeccion.find(p => p.id == req.params.id); if (p) res.json(p); else res.status(404).json({ message: 'Proyecto no encontrado' }); });
app.post('/api/solicitudes', upload.array('imagenes_referencia'), (req, res) => { const db = readDB(dbConfeccionPath); const nS = { id: Date.now(), codigo_proyecto: `PROY-CONF-${Date.now()}`, fecha_creacion: new Date().toISOString(), cliente: req.body.nombre_centro, nombre_asesor: req.body.nombre_asesor, detalles_solicitud: req.body.detalles_solicitud, imagenes_referencia: req.files ? req.files.map(f => f.path) : [], status: 'Diseño Pendiente de Asignación' }; db.proyectos_confeccion.push(nS); writeDB(dbConfeccionPath, db); res.status(201).json(nS); });
app.get('/api/designers', (req, res) => res.json(readDB(dbConfeccionPath).diseñadores || []));
app.put('/api/proyectos/:id/asignar', (req, res) => findProjectAndUpdate(req, res, (p) => { p.diseñador_id = req.body.diseñadorId; p.fecha_de_asignacion = new Date().toISOString(); p.status = 'Diseño en Proceso'; }));
app.put('/api/proyectos/:id/subir-propuesta', upload.single('propuesta_diseno'), (req, res) => { if (!req.file) return res.status(400).json({ message: 'No se ha subido ningún archivo.' }); findProjectAndUpdate(req, res, (p) => { p.propuesta_diseno_url = req.file.path; p.fecha_propuesta = new Date().toISOString(); p.status = 'Pendiente Aprobación Interna'; }); });
app.put('/api/proyectos/:id/aprobar-interno', (req, res) => findProjectAndUpdate(req, res, (p) => { p.fecha_aprobacion_interna = new Date().toISOString(); p.status = 'Pendiente Aprobación Cliente'; }));
app.put('/api/proyectos/:id/solicitar-mejora', (req, res) => findProjectAndUpdate(req, res, (p) => { p.status = 'Diseño en Proceso'; if (!p.historial_revisiones) p.historial_revisiones = []; p.historial_revisiones.push({ fecha: new Date().toISOString(), comentario: req.body.comentarios }); }));
app.put('/api/proyectos/:id/aprobar-cliente', (req, res) => findProjectAndUpdate(req, res, (p) => { p.fecha_aprobacion_cliente = new Date().toISOString(); p.status = 'Pendiente de Proforma'; }));
app.put('/api/proyectos/:id/subir-proforma', upload.single('proforma'), (req, res) => { if (!req.file) return res.status(400).json({ message: 'No se ha subido ningún archivo.' }); findProjectAndUpdate(req, res, (p) => { p.proforma_url = req.file.path; p.fecha_proforma_subida = new Date().toISOString(); p.status = 'Pendiente Aprobación Proforma'; }); });
app.put('/api/proyectos/:id/solicitar-mejora-proforma', (req, res) => { findProjectAndUpdate(req, res, (p) => { p.status = 'Pendiente de Proforma'; if (!p.historial_revisiones) p.historial_revisiones = []; p.historial_revisiones.push({ fecha: new Date().toISOString(), comentario: req.body.comentarios }); }); });
app.put('/api/proyectos/:id/autorizar-produccion', upload.single('listado_final'), (req, res) => { if (!req.file) { return res.status(400).json({ message: 'El listado final es un archivo obligatorio.' }); } findProjectAndUpdate(req, res, (p) => { p.listado_final_url = req.file.path; p.fecha_autorizacion_produccion = new Date().toISOString(); p.status = 'En Lista de Producción'; }); });
app.put('/api/proyectos/:id/avanzar-etapa', (req, res) => {
    findProjectAndUpdate(req, res, (proyecto) => {
        const { nuevaEtapa } = req.body;
        proyecto.status = nuevaEtapa;
        if (!proyecto.historial_produccion) { proyecto.historial_produccion = []; }
        proyecto.historial_produccion.push({ etapa: nuevaEtapa, fecha: new Date().toISOString() });
    });
});

// --- ✅ NUEVAS RUTAS AÑADIDAS PARA CONTROL DE CALIDAD ---
app.put('/api/proyectos/:id/aprobar-calidad', (req, res) => {
    findProjectAndUpdate(req, res, (proyecto) => {
        proyecto.status = 'Listo para Entrega';
        if (!proyecto.historial_produccion) proyecto.historial_produccion = [];
        proyecto.historial_produccion.push({
            etapa: 'Aprobado Calidad',
            fecha: new Date().toISOString()
        });
    });
});

app.put('/api/proyectos/:id/reportar-incidencia', (req, res) => {
    findProjectAndUpdate(req, res, (proyecto) => {
        const { comentarios } = req.body;
        proyecto.status = 'En Confección'; // Se devuelve a la etapa anterior
        if (!proyecto.historial_incidencias) proyecto.historial_incidencias = [];
        proyecto.historial_incidencias.push({
            comentario: comentarios,
            fecha: new Date().toISOString()
        });
    });
});
// --- FIN DE RUTAS AÑADIDAS ---

app.get('/api/centros/search', (req, res) => { const q = (req.query.q || '').toLowerCase(); const db = readDB(dbMainPath); res.json((db.centers || []).filter(c => c.name.toLowerCase().includes(q))); });
app.get('/api/asesores', (req, res) => res.json(readDB(dbMainPath).advisors || []));

app.listen(port, () => console.log(`Servidor de confección escuchando en http://localhost:${port}`));