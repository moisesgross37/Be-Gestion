// ============== SERVIDOR DE ASESORES Y VENTAS (v12.0 FINAL Con Base de Datos PostgreSQL) ==============
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { assembleQuote } = require('./pricingEngine.js');
const { checkRole } = require('./permissions.js');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');

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
    const { username, password } = req.body; // CORREGIDO: usa username
    const db = readDB();
    const user = (db.users || []).find(u => u.username === username && u.estado === 'activo'); // CORREGIDO: busca por username
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta.' });
    const userResponse = { id: user.id, nombre: user.nombre, username: user.username, rol: user.rol }; // CORREGIDO: devuelve username
    req.session.user = userResponse;
    res.status(200).json({ message: 'Login exitoso', redirectTo: '/index.html', user: userResponse });
});


// --- INICIO: RUTAS DE GESTIÓN DE USUARIOS ---

// GET /api/users - Obtener todos los usuarios para la tabla de administración
app.get('/api/users', requireLogin, requireAdmin, (req, res) => {
    try {
        const db = readDB();
        const users = (db.users || []).map(u => ({
            id: u.id,
            nombre: u.nombre,
            username: u.username, // CORREGIDO: usa username
            rol: u.rol,
            estado: u.estado
        }));
        res.status(200).json(users);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// POST /api/users - Crear un nuevo usuario directamente
app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { nombre, username, password, rol } = req.body; // CORREGIDO: usa username
        if (!nombre || !username || !password || !rol) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        const db = readDB();
        const userExists = (db.users || []).some(u => u.username === username); // CORREGIDO: busca por username
        if (userExists) {
            return res.status(409).json({ message: 'El nombre de usuario ya está registrado.' }); // CORREGIDO: mensaje
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now(),
            nombre,
            username, // CORREGIDO: usa username
            password: hashedPassword,
            rol,
            estado: 'activo'
        };

        db.users.push(newUser);
        writeDB(db);

        res.status(201).json({ message: 'Usuario creado con éxito.' });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// POST /api/users/:id/edit-role - Edita el rol de un usuario específico
app.post('/api/users/:id/edit-role', requireLogin, requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newRole } = req.body;

        const db = readDB();
        const userIndex = (db.users || []).findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        db.users[userIndex].rol = newRole;
        writeDB(db);

        res.status(200).json({ message: 'Rol del usuario actualizado con éxito.' });
    } catch (error) {
        console.error('Error al editar el rol del usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// POST /api/users/:id/toggle-status - Cambia el estado de un usuario (activo/inactivo)
app.post('/api/users/:id/toggle-status', requireLogin, requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const db = readDB();
        const userIndex = (db.users || []).findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const currentState = db.users[userIndex].estado;
        db.users[userIndex].estado = currentState === 'activo' ? 'inactivo' : 'activo';
        writeDB(db);

        res.status(200).json({ message: 'Estado del usuario cambiado con éxito.' });
    } catch (error) {
        console.error('Error al cambiar el estado del usuario:', error);
        res.status(500).json({ message: 'Error al cambiar el estado del usuario.' });
    }
});

// --- FIN: RUTAS DE GESTIÓN DE USUARIOS ---

// ... (El resto del código de asesores, cotizaciones, etc., permanece aquí sin cambios) ...

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
app.get('/api/next-quote-number', requireLogin, (req, res) => {
    const db = readDB();
    const quotes = db.quotes || [];
    const lastQuote = quotes.sort((a, b) => {
        const numA = parseInt((a.quoteNumber || 'COT-240000').split('-')[1]);
        const numB = parseInt((b.quoteNumber || 'COT-240000').split('-')[1]);
        return numB - numA;
    })[0];
    const nextNumber = lastQuote ? parseInt(lastQuote.quoteNumber.split('-')[1]) + 1 : 240001;
    res.json({ quoteNumber: `COT-${nextNumber}` });
});
app.post('/api/quotes/calculate-estimate', requireLogin, (req, res) => {
    const quoteInput = req.body;
    const dbData = readDB();
    dbData.products = products;
    const estimate = assembleQuote(quoteInput, dbData);
    res.json(estimate);
});
app.post('/api/quote-requests', requireLogin, (req, res) => {
    const quoteInput = req.body;
    const dbDataForCalculation = readDB();
    dbDataForCalculation.products = products;
    const calculationResult = assembleQuote(quoteInput, dbDataForCalculation);
    let items = [];
    let totals = {};
    if (calculationResult && calculationResult.calculatedPrices && calculationResult.calculatedPrices[0]) {
        const grandTotal = parseFloat(calculationResult.calculatedPrices[0].montoTotalProyecto);
        const subtotal = grandTotal / 1.18;
        const itbis = grandTotal - subtotal;
        totals = {
            subtotal: subtotal.toFixed(2),
            itbis: itbis.toFixed(2),
            grandTotal: grandTotal.toFixed(2)
        };
        items.push({
            description: `Servicios de graduación para ${quoteInput.studentCount} estudiantes.`,
            quantity: 1,
            unitPrice: subtotal.toFixed(2),
            subtotal: subtotal.toFixed(2),
            totalPrice: grandTotal.toFixed(2)
        });
    }
    const newQuote = {
        ...quoteInput,
        items: items,
        totals: totals,
        precioFinalPorEstudiante: calculationResult.calculatedPrices[0].precioFinalPorEstudiante,
        estudiantesParaFacturar: calculationResult.calculatedPrices[0].estudiantesFacturables,
        facilidadesAplicadas: calculationResult.facilidadesAplicadas,
        id: Date.now(),
        status: 'pendiente',
        createdAt: new Date().toISOString()
    };
    const db = readDB();
    if (!db.quotes) db.quotes = [];
    db.quotes.push(newQuote);
    writeDB(db);
    res.status(201).json({ message: 'Cotización guardada con éxito', quote: newQuote });
});

app.get('/api/quote-requests', requireLogin, (req, res) => {
    try {
        const db = readDB();
        const allQuotes = db.quotes || [];
        res.status(200).json(allQuotes);
    } catch (error) {
        console.error('Error fetching all quotes:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener cotizaciones.' });
    }
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

app.post('/api/quote-requests/:id/approve', requireLogin, requireAdmin, (req, res) => {
    const quoteId = parseInt(req.params.id);
    const db = readDB();
    const quoteIndex = db.quotes.findIndex(q => q.id === quoteId);

    if (quoteIndex === -1) {
        return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    db.quotes[quoteIndex].status = 'aprobada';
    writeDB(db);

    res.status(200).json({ message: 'Cotización aprobada con éxito' });
});

app.post('/api/quote-requests/:id/reject', requireLogin, requireAdmin, (req, res) => {
    const quoteId = parseInt(req.params.id);
    const { reason } = req.body;
    const db = readDB();
    const quoteIndex = db.quotes.findIndex(q => q.id === quoteId);

    if (quoteIndex === -1) {
        return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    db.quotes[quoteIndex].status = 'rechazada';
    db.quotes[quoteIndex].rejectionReason = reason;
    writeDB(db);

    res.status(200).json({ message: 'Cotización rechazada con éxito' });
});

app.post('/api/quote-requests/:id/archive', requireLogin, requireAdmin, (req, res) => {
    const quoteId = parseInt(req.params.id);
    const db = readDB();
    const quoteIndex = db.quotes.findIndex(q => q.id === quoteId);

    if (quoteIndex === -1) {
        return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    db.quotes[quoteIndex].status = 'archivada';
    writeDB(db);

    res.status(200).json({ message: 'Cotización archivada con éxito' });
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

// --- RUTA PARA GENERAR PDF DE COTIZACIÓN ---
app.get('/api/quote-requests/:id/pdf', requireLogin, requireAdmin, (req, res) => {
    try {
        const quoteId = req.params.id;
        const db = readDB();
        const quote = db.quotes.find(q => q.id == quoteId);

        if (!quote) {
            return res.status(404).send('Cotización no encontrada');
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${quote.quoteNumber}.pdf`);
        doc.pipe(res);

        // --- FONDO DE PÁGINA (MEMBRETE) ---
        const backgroundImagePath = path.join(__dirname, 'plantillas', 'Timbrada  BE EVENTOS.jpg');
        if (fs.existsSync(backgroundImagePath)) {
            doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height });
        }

        // --- DIBUJAR CONTENIDO ---
        const quoteDate = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('es-DO') : '';
        doc.font('Helvetica-Bold').fontSize(12).text(quote.quoteNumber || '', 470, 138, { align: 'left' });
        doc.font('Helvetica').fontSize(10).text(quoteDate, 470, 158, { align: 'left' });

        doc.font('Helvetica-Bold').fontSize(16).text('PROPUESTA', 50, 160, { align: 'center' });

        doc.font('Helvetica-Bold').fontSize(12).text(`Nombre del centro: ${quote.clientName || 'No especificado'}`, 50, 200);
        doc.text(`Nombre del Asesor: ${quote.advisorName || 'No especificado'}`, 50, 220);

        doc.font('Helvetica').fontSize(10).text('Nos complace presentarle el presupuesto detallado. Este documento ha sido diseñado para ofrecerle una visión clara y transparente de los costos asociados a su proyecto, asegurando que cada aspecto esté cuidadosamente considerado y alineado con sus necesidades.', 50, 250, { align: 'justify', width: 500 });

        let y = doc.y + 20;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 20;

        const selectedProducts = (quote.productIds || []).map(id => products.find(p => p.id == id)).filter(p => p);
        if (selectedProducts.length > 0) {
            selectedProducts.forEach(product => {
                doc.font('Helvetica-Bold').fontSize(12).text(product['PRODUCTO / SERVICIO'].trim(), 50, y);
                y = doc.y + 5;
                const detail = product['DETALLE / INCLUYE'];
                if (detail && detail.trim() !== '') {
                    const detailItems = detail.split(',').map(item => `- ${item.trim()}`);
                    const detailsText = detailItems.join('\n');
                    doc.font('Helvetica').fontSize(10).text(detailsText, 60, y, { width: 450, lineGap: 2 });
                    y = doc.y + 10;
                }
                y += 10;
            });
        } else {
            doc.font('Helvetica-Oblique').fontSize(10).text('No se especificaron productos.', 50, y);
            y += 15;
        }
        y += 20; // Extra space

        const pricePerStudent = quote.precioFinalPorEstudiante || 0;
        doc.font('Helvetica-Bold').fontSize(12).text('Presupuesto por estudiante:', 50, y, { align: 'right', width: 400 });
        doc.font('Helvetica-Bold').fontSize(14).text(`RD$ ${pricePerStudent}`, 450, y, { align: 'right', width: 100 });
        y = doc.y + 20;

        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 20;

        doc.font('Helvetica-Bold').fontSize(10).text('Comentarios y Condiciones:', 50, y);
        y += 15;
        doc.font('Helvetica').fontSize(10).text(`Cálculos basados en un mínimo de ${quote.estudiantesParaFacturar || 0} estudiantes.`, 50, y);
        y += 15;
        doc.font('Helvetica').fontSize(10).text('Condiciones de Pago a debatir.', 50, y);
        y += 15;

        if (quote.facilidadesAplicadas && quote.facilidadesAplicadas.length > 0) {
            quote.facilidadesAplicadas.forEach(facilidad => {
                doc.font('Helvetica-Bold').fontSize(10).text(facilidad, 50, y);
                y += 15;
            });
        }

        y += 15;

        const finalMessage = 'Agradecemos la oportunidad de colaborar con usted y estamos comprometidos a brindarle un servicio excepcional. Si tiene alguna pregunta o necesita más detalles, no dude en ponerse en contacto con nosotros.';
        doc.font('Helvetica').fontSize(10).text(finalMessage, 50, y, { align: 'center', width: 500 });

        doc.end();

    } catch (error) {
        console.error('Error al generar el PDF:', error);
        res.status(500).send('Error interno al generar el PDF');
    }
});

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/index.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin_menu.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_menu.html')));
app.get('/admin_asesores.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_asesores.html')));
app.get('/admin_comentarios.html', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'admin_comentarios.html')));
app.get('/registrar_visita.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'registrar_visita.html')));
app.get('/solicitud_cotizacion.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'solicitud_cotizacion.html')));
app.get('/panel_aprobacion_cotizaciones.html', requireLogin, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'panel_aprobacion_cotizaciones.html'));
});

// --- Inicio del Servidor ---
app.listen(PORT, () => {
    loadProducts();
    console.log('✅ Servidor de Asesores (v11.0 Con Cotizador) corriendo en http://localhost:3000');
});