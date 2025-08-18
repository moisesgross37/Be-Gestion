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
    doc.fontSize(12).text(`Monto Total del Proyecto: $${quote.calculatedPrices.montoTotalProyecto}`);
    doc.text(`Precio Final por Estudiante (con deserción): $${quote.calculatedPrices.precioFinalPorEstudiante}`);
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

// --- Iniciar Servidor ---
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