console.log('Página de revisión cargada. Iniciando proceso para buscar PDF...');
document.addEventListener('DOMContentLoaded', () => {
    const pdfViewer = document.getElementById('visor-pdf');
    const actionsPanel = document.getElementById('panel-acciones');
    const quoteId = new URLSearchParams(window.location.search).get('id');

    if (!quoteId) {
        pdfViewer.innerHTML = '<h1>Error: No se especificó una cotización para revisar.</h1>';
        return;
    }

    const loadQuoteForReview = async () => {
        try {
            // Cargar el PDF
            const pdfUrl = `/api/quote-requests/${quoteId}/pdf`;
            pdfViewer.innerHTML = `<embed src="${pdfUrl}" type="application/pdf" width="100%" height="800px" />`;

            // Cargar los datos de la cotización para el panel de acciones
            const response = await fetch('/api/quote-requests'); // Re-usamos el endpoint que obtiene todas
            if (!response.ok) throw new Error('No se pudieron cargar los datos de la cotización.');
            const allQuotes = await response.json();
            const quote = allQuotes.find(q => q.id == quoteId);

            if (!quote) throw new Error('Cotización no encontrada.');

            renderActionsPanel(quote);

        } catch (error) {
            console.error('Error al cargar la cotización para revisión:', error);
            pdfViewer.innerHTML = `<h1>Error al cargar la cotización: ${error.message}</h1>`;
        }
    };

    const renderActionsPanel = (quote) => {
        actionsPanel.innerHTML = `
            <h2>Detalles</h2>
            <p><strong>No. Cotización:</strong> ${quote.quoteNumber}</p>
            <p><strong>Cliente:</strong> ${quote.clientName}</p>
            <p><strong>Asesor:</strong> ${quote.advisorName || 'N/A'}</p>
            <p><strong>Monto Total:</strong> $${quote.calculatedPrices.montoTotalProyecto}</p>
            <hr style="margin: 20px 0;">
            <h2>Acciones</h2>
            <div class="form-group">
                <button id="approve-btn" class="btn">Aprobar Cotización</button>
            </div>
            <div class="form-group">
                <button id="reject-btn" class="btn btn-delete">Rechazar Cotización</button>
            </div>
        `;

        document.getElementById('approve-btn').addEventListener('click', () => handleApproval(quote.id, 'approve'));
        document.getElementById('reject-btn').addEventListener('click', () => handleApproval(quote.id, 'reject'));
    };

    const handleApproval = async (id, action) => {
        const isRejecting = action === 'reject';
        let body = {};
        if (isRejecting) {
            const reason = prompt('Por favor, introduce el motivo del rechazo:');
            if (reason === null) return; // El usuario canceló el prompt
            body = { reason };
        }

        try {
            const response = await fetch(`/api/quote-requests/${id}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ocurrió un error al procesar la solicitud.');
            }

            alert(`La cotización ha sido marcada como "${isRejecting ? 'Rechazada' : 'Aprobada'}" con éxito.`);
            window.location.href = '/aprobacion.html'; // Redirigir de vuelta al panel

        } catch (error) {
            console.error(`Error al ${action} la cotización:`, error);
            alert(`Error: ${error.message}`);
        }
    };

    loadQuoteForReview();
});
