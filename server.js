const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const csv = require('csv-parser');
const { assembleQuote } = require('./pricingEngine.js');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Helper functions to read/write from db.json
const readDB = () => {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading DB:', error);
        return {
            advisors: [],
            zones: [],
            comments: [],
            quoteRequests: [],
            centers: [],
            products: [],
            marginRules: [],
            gratuityRules: [],
            proyectos_confeccion: []
        };
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing DB:', error);
    }
};

// --- Rutas de API Generales y de Cotizaciones ---

app.get('/api/report', (req, res) => {
    const db = readDB();
    let visits = db.visits || [];
    const { advisor, startDate, endDate } = req.query;

    if (advisor) {
        visits = visits.filter(v => v.advisorName === advisor);
    }
    if (startDate) {
        visits = visits.filter(v => new Date(v.visitDate) >= new Date(startDate));
    }
    if (endDate) {
        visits = visits.filter(v => new Date(v.visitDate) <= new Date(endDate));
    }
    res.json(visits);
});

app.get('/api/next-quote-number', (req, res) => {
    const db = readDB();
    const lastQuote = db.quoteRequests.sort((a, b) => b.id - a.id)[0];
    const lastNumber = lastQuote ? parseInt(lastQuote.quoteNumber.split('-')[1]) : 0;
    const nextNumber = `COT-${(lastNumber + 1).toString().padStart(4, '0')}`;
    res.json({ quoteNumber: nextNumber });
});

app.get('/api/centers/search', (req, res) => {
    const db = readDB();
    const searchTerm = (req.query.q || '').toLowerCase();
    if (!searchTerm) {
        return res.json([]);
    }
    const results = db.centers.filter(center =>
        center.name.toLowerCase().includes(searchTerm)
    );
    res.json(results);
});

app.get('/api/data', (req, res) => {
    const db = readDB();
    res.json({
        advisors: db.advisors || [],
        centers: db.centers || [],
        zones: db.zones || [],
        predefinedComments: db.predefinedComments || [],
        products: db.products || []
    });
});

app.get('/api/quote-requests', (req, res) => {
    const db = readDB();
    res.json(db.quoteRequests || []);
});

app.post('/api/quotes/calculate-estimate', (req, res) => {
    const db = readDB();
    try {
        const estimatedQuote = assembleQuote(req.body, db);
        console.log('RESPUESTA DE ESTIMACIÓN ENVIADA AL FRONTEND:', estimatedQuote);
        res.json(estimatedQuote);
    } catch (error) {
        console.error('Error calculating quote estimate:', error);
        res.status(500).json({ message: 'Error al calcular la estimación.', error: error.message });
    }
});

app.post('/api/quote-requests/:id/approve', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const quote = db.quoteRequests.find(q => q.id === id);
    if (quote) {
        quote.status = 'Aprobada';
        writeDB(db);
        res.json(quote);
    } else {
        res.status(404).json({ message: 'Cotización no encontrada.' });
    }
});

app.post('/api/quote-requests/:id/reject', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const quote = db.quoteRequests.find(q => q.id === id);
    if (quote) {
        quote.status = 'Rechazada';
        quote.rejectionReason = reason || 'Sin motivo específico.';
        writeDB(db);
        res.json(quote);
    } else {
        res.status(404).json({ message: 'Cotización no encontrada.' });
    }
});

// ESTA ES LA NUEVA VERSIÓN CORREGIDA Y PROTEGIDA

// GET /api/quote-requests/:id/pdf (VERSIÓN FINAL Y COMPLETA)
app.get('/api/quote-requests/:id/pdf', (req, res) => {
    try {
        const db = readDB();
        const id = parseInt(req.params.id, 10);
        const quote = db.quoteRequests.find(q => q.id === id);

        if (!quote) {
            return res.status(404).json({ message: 'Cotización no encontrada.' });
        }

        const doc = new PDFDocument({ margin: 50 });
        const filename = `Presupuesto-${quote.quoteNumber || quote.id}.pdf`;

        res.setHeader('Content-disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // --- INICIO DEL CONTENIDO DEL PDF ---

        // 1. Logo y Encabezado
        doc.fontSize(16).text('[LOGO DE LA EMPRESA]', { align: 'center' });
        doc.moveDown(2);
        doc.fontSize(22).text('PRESUPUESTO', { align: 'center', underline: true });
        doc.moveDown(2);
        doc.fontSize(12);
        doc.text(`Nombre del Centro Educativo: ${quote.clientName || 'N/A'}`);
        doc.text(`Nombre del Evento: ${quote.eventName || 'N/A'}`);
        doc.text(`Asesor a Cargo: ${quote.advisorName || 'N/A'}`);
        doc.text(`Fecha de Emisión: ${new Date(quote.requestDate).toLocaleDateString()}`);
        doc.moveDown();

        // 2. Texto de Introducción
        doc.fontSize(10).text(
            'A continuación, presentamos el presupuesto detallado para los servicios solicitados. ' +
            'Este documento ha sido preparado cuidadosamente por nuestro equipo para reflejar con precisión ' +
            'los costos asociados a su evento, asegurando la mejor calidad y servicio.',
            { align: 'justify' }
        );
        doc.moveDown(2);

        // 3. Detalles de la Propuesta
        doc.fontSize(18).text('Detalles de la Propuesta', { underline: true });
        doc.moveDown();
        if (quote.itemsByReglon && typeof quote.itemsByReglon === 'object' && Object.keys(quote.itemsByReglon).length > 0) {
            Object.keys(quote.itemsByReglon).forEach(reglon => {
                doc.fontSize(14).text(reglon.toUpperCase(), { underline: true });
                doc.moveDown(0.7);
                (quote.itemsByReglon[reglon] || []).forEach(item => {
                    doc.fontSize(12).text(`- ${item.name || 'Producto sin nombre'}`);
                    if (item.details && item.details.trim() !== '') {
                        doc.fontSize(9).text(item.details.trim(), { indent: 20, oblique: true });
                    }
                    doc.moveDown(0.7);
                });
                doc.moveDown();
            });
        } else {
            doc.fontSize(12).text('No se han detallado productos o servicios para esta cotización.', { oblique: true });
            doc.moveDown();
        }


        // 4. Resumen de Precios y Opciones
        doc.fontSize(18).text('Resumen de Precios y Opciones', { underline: true });
        doc.moveDown();
        if (Array.isArray(quote.calculatedPrices) && quote.calculatedPrices.length > 0) {
            quote.calculatedPrices.forEach((option, index) => {
                if (quote.calculatedPrices.length > 1) {
                    const optionLetter = String.fromCharCode(65 + index);
                    doc.fontSize(14).text(`Opción ${optionLetter}: Evento realizado en ${option.venueName || 'Salón no especificado'}`, { underline: true });
                    doc.moveDown(0.7);
                }
                doc.fontSize(12).text(`Presupuesto General: ${option.montoTotalProyecto}`);
                doc.fontSize(12).text(`Presupuesto por Estudiante: ${option.precioFinalPorEstudiante}`);
                doc.fontSize(10).text(
                    `Nota: Este cálculo se basa en la participación de ${option.estudiantesFacturables} estudiantes. ` +
                    `El precio final por persona puede variar si la cantidad de participantes cambia.`,
                    { align: 'justify', indent: 20 }
                );
                doc.moveDown(1.5);
            });
        } else {
            doc.fontSize(12).text('No hay opciones de precios calculadas para esta cotización.', { oblique: true });
            doc.moveDown();
        }

        // 5. Texto de Cierre
        doc.fontSize(10).text(
            'Condiciones de Pago: Se requiere un abono del 50% para confirmar la reserva de la fecha y los servicios. ' +
            'El 50% restante deberá ser cancelado 15 días antes de la fecha del evento. ' +
            'Agradecemos su confianza y quedamos a su disposición para cualquier consulta.',
            { align: 'justify' }
        );
        doc.moveDown();

        // --- FIN DEL CONTENIDO DEL PDF ---
        doc.end();

    } catch (error) {
        console.error('*** ERROR DURANTE LA GENERACIÓN DEL PDF ***:', error);
        if (!res.headersSent) {
            res.status(500).send('Error interno al generar el PDF.');
        } else {
            res.end();
        }
    }
});

// --- Rutas Específicas del Módulo de Confección ---

app.get('/api/proyectos/fase-final', (req, res) => {
    const db = readDB();
    const proyectosEnFaseFinal = (db.proyectos_confeccion || []).filter(proyecto =>
        ['En Confección', 'En Control de Calidad', 'Listo para Entrega'].includes(proyecto.status)
    );
    res.json(proyectosEnFaseFinal);
});

app.post('/api/proyectos-confeccion', (req, res) => {
    const db = readDB();
    const { cliente, nombre_proyecto, descripcion } = req.body;

    if (!cliente || !nombre_proyecto) {
        return res.status(400).json({ message: 'El cliente y el nombre del proyecto son obligatorios.' });
    }

    const newProject = {
        id: Date.now(),
        status: 'Diseño Pendiente de Asignación',
        fecha_creacion: new Date().toISOString(),
        cliente: cliente,
        nombre_proyecto: nombre_proyecto,
        descripcion: descripcion || '',
        diseñador_id: null,
        historial_acciones: [],
        contador_revisiones_cliente: 0
    };

    if (!db.proyectos_confeccion) {
        db.proyectos_confeccion = [];
    }
    db.proyectos_confeccion.push(newProject);
    writeDB(db);
    res.status(201).json(newProject);
});

app.put('/api/proyectos-confeccion/:id/assign-designer', (req, res) => {
    const db = readDB();
    const projectId = parseInt(req.params.id, 10);
    const { designer_id } = req.body;

    if (!designer_id) {
        return res.status(400).json({ message: 'Se requiere el ID del diseñador.' });
    }

    const projectIndex = db.proyectos_confeccion.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    db.proyectos_confeccion[projectIndex].diseñador_id = designer_id;
    db.proyectos_confeccion[projectIndex].status = 'Diseño en Proceso';
    writeDB(db);
    res.json(db.proyectos_confeccion[projectIndex]);
});


// --- Rutas Genéricas (deben ir al final) ---

app.get('/api/:resource', (req, res) => {
    const db = readDB();
    if (db[req.params.resource]) {
        res.json(db[req.params.resource]);
    } else {
        res.status(404).json({ message: 'Resource not found' });
    }
});

app.get('/api/:resource/:id', (req, res) => {
    const db = readDB();
    const resource = db[req.params.resource];
    if (resource) {
        const item = resource.find(i => i.id == req.params.id);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    } else {
        res.status(404).json({ message: 'Resource not found' });
    }
});

app.post('/api/visits', (req, res) => {
    const db = readDB();
    const { centerName, zone, ...visitData } = req.body; 

    if (!centerName) {
        return res.status(400).json({ message: 'El nombre del centro es obligatorio.' });
    }

    let center = db.centers.find(c => c.name.toLowerCase() === centerName.toLowerCase());

    if (!center) {
        center = {
            id: Date.now(),
            name: centerName,
            zone: zone || 'Sin Asignar',
        };
        db.centers.push(center);
        console.log('NUEVO CENTRO CREADO:', center);
    }

    const newVisit = {
        id: Date.now() + 1, 
        centerId: center.id,
        centerName: center.name,
        ...visitData
    };

    if (!db.visits) {
        db.visits = [];
    }
    db.visits.push(newVisit);

    writeDB(db);
    res.status(201).json(newVisit);
});

app.post('/api/quote-requests', (req, res) => {
    const db = readDB();
    try {
        const assembledQuote = assembleQuote(req.body, db);
        console.log('CONTENIDO DE LA COTIZACIÓN ANTES DE GUARDAR:', assembledQuote);
        db.quoteRequests.push(assembledQuote);
        writeDB(db);
        res.status(201).json(assembledQuote);
    } catch (error) {
        console.error('Error generating quote:', error);
        res.status(500).json({ message: 'Error al generar la cotización.' });
    }
});

app.post('/api/:resource', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    const handledResources = ['quote-requests', 'visits', 'proyectos-confeccion'];
    if (handledResources.includes(resource)) {
        return res.status(400).json({ message: `Use the specific endpoint for ${resource}.` });
    }
    const newItem = { id: Date.now(), ...req.body };
    if (db[resource]) {
        db[resource].push(newItem);
    } else {
        db[resource] = [newItem];
    }
    writeDB(db);
    res.status(201).json(newItem);
});

app.delete('/api/:resource/:id', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    const id = parseInt(req.params.id, 10);
    if (db[resource]) {
        const initialLength = db[resource].length;
        db[resource] = db[resource].filter(item => item.id !== id);
        if (db[resource].length < initialLength) {
            writeDB(db);
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    } else {
        res.status(404).json({ message: 'Resource not found' });
    }
});

app.put('/api/:resource/:id', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    const id = parseInt(req.params.id, 10);
    const index = db[resource] ? db[resource].findIndex(item => item.id === id) : -1;

    if (index !== -1) {
        db[resource][index] = { ...db[resource][index], ...req.body, id: id };
        writeDB(db);
        res.json(db[resource][index]);
    } else {
        res.status(404).json({ message: 'Resource not found or item not found' });
    }
});


// --- Rutas para Servir Archivos HTML ---

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin_menu.html')));
app.get('/admin_menu.html', (req, res) => res.sendFile(path.join(__dirname, 'admin_menu.html')));
app.get('/admin/asesores', (req, res) => res.sendFile(path.join(__dirname, 'admin_asesores.html')));
// ... más rutas de admin ...
app.get('/confeccion-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'confeccion_dashboard.html')));
app.get('/formulario_solicitud.html', (req, res) => res.sendFile(path.join(__dirname, 'formulario_solicitud.html')));
// ... más rutas de HTML ...

// Catch-all para servir index.html (debe ir al final de las rutas GET)
// --- INICIO DEL BLOQUE DE RUTAS A AÑADIR ---

// --- Rutas para el Panel de Administración ---
app.get('/admin_menu.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_menu.html'));
});
app.get('/admin/asesores', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_asesores.html'));
});
app.get('/admin/zonas', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_zonas.html'));
});
app.get('/admin/centros', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_centros.html'));
});
app.get('/admin/productos', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_productos.html'));
});
app.get('/admin/margenes', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_margenes.html'));
});
app.get('/admin/gratuidades', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_gratuidades.html'));
});
app.get('/admin/comentarios', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_comentarios.html'));
});
app.get('/confeccion-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'confeccion_dashboard.html'));
});
app.get('/crear-solicitud-diseno', (req, res) => {
    res.sendFile(path.join(__dirname, 'crear_solicitud_diseno.html'));
});
app.get('/proyecto-diseno', (req, res) => {
    res.sendFile(path.join(__dirname, 'proyecto_diseno.html'));
});
app.get('/revision_cotizacion.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'revision_cotizacion.html'));
});
app.get('/prueba-calculo', (req, res) => {
    res.sendFile(path.join(__dirname, 'prueba_calculo.html'));
});

// --- Rutas de Menús Principales ---
app.get('/asesores-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'asesores-menu.html'));
});
app.get('/asesor', (req, res) => {
    res.sendFile(path.join(__dirname, 'asesor.html'));
});
app.get('/logistica-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'logistica-menu.html'));
});
app.get('/administrativo-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'administrativo-menu.html'));
});

// --- FIN DEL BLOQUE DE RUTAS A AÑADIR ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Iniciar Servidor ---
const cargarCatalogoYIniciarServidor = () => {
    const productos = [];
    const csvPath = path.join(__dirname, 'productos.csv');
    fs.createReadStream(csvPath)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => {
            if (row['PRODUCTO / SERVICIO']) {
                productos.push({
                    id: productos.length + 1,
                    reglon: row['REGLON'] || '',
                    sub_reglon: row['SUB REGLON'] || '',
                    name: row['PRODUCTO / SERVICIO'],
                    detallesIncluidos: row['DETALLES / INCLUYE'] || '',
                    costoBase: parseFloat(row['COSTO BASE']) || 0,
                    tipo_calculo: row['TIPO DE PRECIO'] || 'por_estudiante'
                });
            }
        })
        .on('end', () => {
            const db = readDB();
            db.products = productos;
            writeDB(db);
            console.log(`CARGA EXITOSA: Se cargaron ${productos.length} productos desde el CSV.`);
            
            app.listen(PORT, () => {
                console.log(`Servidor corriendo en http://localhost:${PORT}`);
                console.log('Abre http://localhost:3000 en tu navegador para usar la aplicación.');
            });
        })
        .on('error', (error) => {
            console.error("Error al leer el CSV, el servidor no se iniciará.", error);
        });
};

cargarCatalogoYIniciarServidor();