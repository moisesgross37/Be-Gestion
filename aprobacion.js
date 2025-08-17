document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('pending-quotes-table-body');
    const modal = document.getElementById('quote-details-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const detailsContent = document.getElementById('quote-details-content');
    const approveButton = document.getElementById('approve-button');
    const rejectButton = document.getElementById('reject-button');
    const modifyButton = document.getElementById('modify-button');

    let currentQuotes = [];
    let selectedQuoteId = null;

    /**
     * Carga las cotizaciones pendientes desde la API y las muestra en la tabla.
     */
    const fetchPendingQuotes = async () => {
        try {
            const response = await fetch('/api/quote-requests?status=Pendiente de Aprobación');
            if (!response.ok) throw new Error('Error al cargar las cotizaciones pendientes.');
            currentQuotes = await response.json();
            renderQuotesTable(currentQuotes);
        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
        }
    };

    /**
     * Renderiza las filas de la tabla de cotizaciones.
     * @param {Array} quotes - El array de cotizaciones a mostrar.
     */
    const renderQuotesTable = (quotes) => {
        tableBody.innerHTML = '';
        if (quotes.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No hay cotizaciones pendientes de aprobación.</td></tr>';
            return;
        }

        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${quote.quoteNumber || 'N/A'}</td>
                <td>${quote.clientName || 'N/A'}</td>
                <td>${quote.eventName || 'N/A'}</td>
                <td>$${quote.calculatedPrices.montoTotalProyecto || '0.00'}</td>
                <td>${new Date(quote.requestDate).toLocaleDateString()}</td>
                <td><button class="btn btn-edit view-details-btn" data-id="${quote.id}">Ver Detalles</button></td>
            `;
            tableBody.appendChild(row);
        });
    };

    /**
     * Muestra el modal con los detalles de una cotización específica.
     * @param {number} quoteId - El ID de la cotización a mostrar.
     */
    const showQuoteDetails = (quoteId) => {
        selectedQuoteId = quoteId;
        const quote = currentQuotes.find(q => q.id === quoteId);
        if (!quote) return;

        let detailsHTML = `
            <h3>Información General</h3>
            <p><strong># Cotización:</strong> ${quote.quoteNumber}</p>
            <p><strong>Cliente:</strong> ${quote.clientName}</p>
            <p><strong>Evento:</strong> ${quote.eventName}</p>
            <p><strong>Fecha de Solicitud:</strong> ${new Date(quote.requestDate).toLocaleString()}</p>
            <p><strong>Status:</strong> ${quote.status}</p>
            <hr>
            <h3>Cálculos de Precio</h3>
            <p><strong>Monto Total del Proyecto:</strong> $${quote.calculatedPrices.montoTotalProyecto}</p>
            <p><strong>Precio Final por Estudiante:</strong> $${quote.calculatedPrices.precioFinalPorEstudiante}</p>
            <p><strong>Estudiantes para Facturar (con deserción):</strong> ${quote.calculatedPrices.estudiantesFacturables}</p>
            <hr>
            <h3>Ítems Incluidos</h3>
            <ul>${quote.items.map(item => `<li>${item.name} (${item.type})</li>`).join('')}</ul>
            <hr>
            <h3>Facilidades Aplicadas</h3>
            <ul>${quote.facilidadesAplicadas.length > 0 ? quote.facilidadesAplicadas.map(f => `<li>${f}</li>`).join('') : '<li>Ninguna</li>'}</ul>
        `;
        detailsContent.innerHTML = detailsHTML;
        modal.style.display = 'block';
    };

    /**
     * Maneja una acción de cambio de estado (Aprobar/Rechazar).
     * @param {'approve' | 'reject'} action - La acción a realizar.
     */
    const handleStatusChange = async (action) => {
        const isRejecting = action === 'reject';
        let body = {};

        if (isRejecting) {
            const reason = prompt('Por favor, introduce el motivo del rechazo:');
            if (reason === null) return; // El usuario canceló el prompt
            body = { reason };
        }

        try {
            const response = await fetch(`/api/quote-requests/${selectedQuoteId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error al ${action} la cotización.`);
            }

            alert(`Cotización marcada como "${isRejecting ? 'Rechazada' : 'Aprobada'}" con éxito.`);
            modal.style.display = 'none';
            fetchPendingQuotes(); // Recargar la lista

        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    };

    // --- Event Listeners ---
    tableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('view-details-btn')) {
            const quoteId = parseInt(event.target.dataset.id, 10);
            showQuoteDetails(quoteId);
        }
    });

    closeModalButton.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.style.display = 'none';
    });

    approveButton.addEventListener('click', () => handleStatusChange('approve'));
    rejectButton.addEventListener('click', () => handleStatusChange('reject'));
    modifyButton.addEventListener('click', () => {
        alert('La funcionalidad de modificar una cotización se implementará en una fase futura.');
    });

    // --- Inicialización ---
    fetchPendingQuotes();
});