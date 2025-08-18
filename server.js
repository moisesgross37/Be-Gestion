const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit'); // Importar PDFKit
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
            gratuityRules: []
        }; // Return empty structure if file doesn't exist or is invalid
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing DB:', error);
    }
};

// ... (Middleware y resto de la configuración se mantienen igual)

// --- Rutas de API para Cotizaciones y Aprobaciones ---

// ... (GET, POST, PUT, approve, reject se mantienen igual)

// GET /api/quote-requests/:id/pdf (NUEVO ENDPOINT)
app.get('/api/quote-requests/:id/pdf', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const quote = db.quoteRequests.find(q => q.id === id);

    if (!quote) {
        return res.status(404).json({ message: 'Cotización no encontrada.' });
    }

    if (quote.status !== 'Aprobada') {
        return res.status(403).json({ message: 'Solo se pueden descargar en PDF las cotizaciones aprobadas.' });
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `Cotizacion-${quote.quoteNumber || quote.id}.pdf`;

    // Configurar headers para la descarga
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    // Pipe el PDF directamente a la respuesta del cliente
    doc.pipe(res);

    // --- Contenido del PDF ---
    // Header
    doc.fontSize(20).text('Cotización Be-Gestion', { align: 'center' });
    doc.moveDown();

    // Información del Cliente y Evento
    doc.fontSize(12).text(`Número de Cotización: ${quote.quoteNumber}`);
    doc.text(`Cliente: ${quote.clientName}`);
    doc.text(`Evento: ${quote.eventName}`);
    doc.text(`Fecha de Solicitud: ${new Date(quote.requestDate).toLocaleDateString()}`);
    doc.moveDown();

    // Línea divisoria
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Resumen de Precios
    doc.fontSize(14).text('Resumen de Precios', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Monto Total del Proyecto: ${quote.calculatedPrices.montoTotalProyecto}`);
    doc.text(`Precio Final por Estudiante (con deserción): ${quote.calculatedPrices.precioFinalPorEstudiante}`);
    doc.text(`Cantidad de Estudiantes para Facturar: ${quote.calculatedPrices.estudiantesFacturables}`);
    doc.moveDown();

    // Ítems Incluidos
    doc.fontSize(14).text('Ítems Incluidos', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    quote.items.forEach(item => {
        doc.text(`- ${item.name} (Tipo: ${item.type})`);
    });
    doc.moveDown();

    // Facilidades Aplicadas
    doc.fontSize(14).text('Facilidades y Condiciones Especiales', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    if (quote.facilidadesAplicadas.length > 0) {
        quote.facilidadesAplicadas.forEach(facility => {
            doc.text(`- ${facility}`);
        });
    } else {
        doc.text('Ninguna');
    }
    doc.moveDown(2);

    // Footer
    doc.fontSize(10).text('Gracias por preferir Be-Gestion.', { align: 'center' });

    // Finalizar el PDF
    doc.end();
});

// Generic GET endpoint for simple resources
app.get('/api/:resource', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    if (db[resource]) {
        res.json(db[resource]);
    } else {
        res.status(404).json({ message: 'Resource not found' });
    }
});

// Generic POST endpoint for simple resources
app.post('/api/:resource', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    const newItem = { id: Date.now(), ...req.body };
    if (db[resource]) {
        db[resource].push(newItem);
        writeDB(db);
        res.status(201).json(newItem);
    } else {
        res.status(404).json({ message: 'Resource not found' });
    }
});

// Generic DELETE endpoint for simple resources
app.delete('/api/:resource/:id', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    const id = parseInt(req.params.id, 10);
    if (db[resource]) {
        const initialLength = db[resource].length;
        db[resource] = db[resource].filter(item => item.id !== id);
        if (db[resource].length < initialLength) {
            writeDB(db);
            res.status(204).send(); // No Content
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    } else {
        res.status(404).json({ message: 'Resource not found' });
    }
});

// Generic PUT endpoint for simple resources
app.put('/api/:resource/:id', (req, res) => {
    const db = readDB();
    const resource = req.params.resource;
    const id = parseInt(req.params.id, 10);
    const updatedData = req.body;

    if (!db[resource]) {
        return res.status(404).json({ message: 'Resource not found' });
    }

    const index = db[resource].findIndex(item => item.id === id);

    if (index !== -1) {
        // Preserve the original ID, but update the rest of the data
        db[resource][index] = { ...db[resource][index], ...updatedData, id: id };
        writeDB(db);
        res.json(db[resource][index]);
    } else {
        res.status(404).json({ message: 'Item not found' });
    }
});


// Specific PUT endpoint for centers
app.put('/api/centers/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const updatedCenter = req.body;
    const index = db.centers.findIndex(c => c.id === id);
    if (index !== -1) {
        db.centers[index] = { ...db.centers[index], ...updatedCenter };
        writeDB(db);
        res.json(db.centers[index]);
    } else {
        res.status(404).json({ message: 'Center not found' });
    }
});

// --- Rutas para el Panel de Administración ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_menu.html'));
});
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

// --- Rutas de Menús Principales ---
app.get('/asesores-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'asesores-menu.html'));
});

app.get('/logistica-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'logistica-menu.html'));
});

app.get('/administrativo-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'administrativo-menu.html'));
});

// Catch-all route to serve index.html for any unhandled requests
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Abre http://localhost:3000 en tu navegador para usar la aplicación.');
});