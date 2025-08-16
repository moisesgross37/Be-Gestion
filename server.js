const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Middleware
app.use(express.json());
app.use(express.static(__dirname)); // Servir archivos estáticos desde el directorio raíz

// --- Funciones de Ayuda para la Base de Datos ---
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(data);
    // Asegurarse de que las propiedades principales existan
    if (!db.advisors) db.advisors = [];
    if (!db.centers) db.centers = [];
    if (!db.visits) db.visits = [];
    if (!db.zones) db.zones = [];
    if (!db.predefinedComments) db.predefinedComments = [];
    return db;
  } catch (error) {
    console.error('Error leyendo la base de datos:', error);
    // Si el archivo no existe o hay un error, retorna una estructura vacía
    return { advisors: [], centers: [], visits: [], zones: [], predefinedComments: [] };
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error escribiendo en la base de datos:', error);
  }
};

// --- Rutas de la API ---

// GET /api/data - Obtener todos los datos iniciales
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json(db);
});

// POST /api/visits - Registrar una nueva visita
app.post('/api/visits', (req, res) => {
  const db = readDB();
  const newVisit = req.body;

  newVisit.id = Date.now();
  newVisit.recordedAt = new Date().toISOString();
  db.visits.push(newVisit);

  const centerExists = db.centers.some(center => center.name.toLowerCase() === newVisit.centerName.toLowerCase());
  if (!centerExists) {
    const newCenter = {
        id: Date.now(),
        name: newVisit.centerName,
        contactName: newVisit.contactName,
        contactNumber: newVisit.contactNumber
    };
    db.centers.push(newCenter);
  }

  writeDB(db);
  res.status(201).json({ message: 'Visita registrada con éxito', visit: newVisit });
});

// --- Rutas de API para Administrar Asesores ---

app.get('/api/advisors', (req, res) => {
    const db = readDB();
    res.json(db.advisors);
});

app.post('/api/advisors', (req, res) => {
    const db = readDB();
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });
    const newAdvisor = { id: Date.now(), name };
    db.advisors.push(newAdvisor);
    writeDB(db);
    res.status(201).json({ message: 'Asesor añadido con éxito', advisor: newAdvisor });
});

app.delete('/api/advisors/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    db.advisors = db.advisors.filter(a => a.id !== id);
    writeDB(db);
    res.status(200).json({ message: 'Asesor eliminado con éxito' });
});

// --- Rutas de API para Administrar Zonas ---

app.get('/api/zones', (req, res) => {
    const db = readDB();
    res.json(db.zones);
});

app.post('/api/zones', (req, res) => {
    const db = readDB();
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });
    const newZone = { id: Date.now(), name };
    db.zones.push(newZone);
    writeDB(db);
    res.status(201).json({ message: 'Zona añadida con éxito', zone: newZone });
});

app.delete('/api/zones/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    db.zones = db.zones.filter(z => z.id !== id);
    writeDB(db);
    res.status(200).json({ message: 'Zona eliminada con éxito' });
});

// --- Rutas de API para Comentarios Predefinidos ---

app.get('/api/comments', (req, res) => {
    const db = readDB();
    res.json(db.predefinedComments);
});

app.post('/api/comments', (req, res) => {
    const db = readDB();
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });
    const newComment = { id: Date.now(), name };
    db.predefinedComments.push(newComment);
    writeDB(db);
    res.status(201).json({ message: 'Comentario añadido con éxito', comment: newComment });
});

app.delete('/api/comments/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    db.predefinedComments = db.predefinedComments.filter(c => c.id !== id);
    writeDB(db);
    res.status(200).json({ message: 'Comentario eliminado con éxito' });
});

// --- Rutas de API para Administrar Centros ---

app.get('/api/centers', (req, res) => {
    const db = readDB();
    res.json(db.centers);
});

app.put('/api/centers/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const { name, contactName, contactNumber } = req.body;

    const centerIndex = db.centers.findIndex(c => c.id === id);

    if (centerIndex === -1) {
        return res.status(404).json({ message: 'Centro no encontrado' });
    }

    // Actualizar los datos del centro
    db.centers[centerIndex].name = name || db.centers[centerIndex].name;
    db.centers[centerIndex].contactName = contactName || db.centers[centerIndex].contactName;
    db.centers[centerIndex].contactNumber = contactNumber || db.centers[centerIndex].contactNumber;
    
    writeDB(db);
    res.json({ message: 'Centro actualizado con éxito', center: db.centers[centerIndex] });
});

app.delete('/api/centers/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    db.centers = db.centers.filter(c => c.id !== id);
    writeDB(db);
    res.status(200).json({ message: 'Centro eliminado con éxito' });
});

// --- Ruta de API para Reportes ---
app.get('/api/report', (req, res) => {
    const { advisor, startDate, endDate } = req.query;
    const db = readDB();
    let filteredVisits = db.visits;

    if (advisor) filteredVisits = filteredVisits.filter(v => v.advisorName === advisor);
    if (startDate) filteredVisits = filteredVisits.filter(v => new Date(v.visitDate) >= new Date(startDate));
    if (endDate) filteredVisits = filteredVisits.filter(v => new Date(v.visitDate) <= new Date(endDate));

    res.json(filteredVisits);
});


// --- Iniciar Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log('Abre http://localhost:3000 en tu navegador para usar la aplicación.');
});
