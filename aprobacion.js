document.addEventListener('DOMContentLoaded', () => {

    const pendingTableBody = document.getElementById('pending-quotes-table-body');
    const finalizedTableBody = document.getElementById('finalized-quotes-table-body');
    const modal = document.getElementById('quote-details-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const detailsContent = document.getElementById('quote-details-content');
    const approveButton = document.getElementById('approve-button');
    const rejectButton = document.getElementById('reject-button');
    const modifyButton = document.getElementById('modify-button');

    let allQuotes = [];
    let selectedQuoteId = null;

    const fetchAllQuotes = async () => {
        try {
            const response = await fetch('/api/quote-requests');
            if (!response.ok) throw new Error('Error al cargar las cotizaciones.');
            allQuotes = await response.json();
            
            const pendingQuotes = allQuotes.filter(q => q.status === 'Pendiente de Aprobación');
            const finalizedQuotes = allQuotes.filter(q => q.status === 'Aprobada' || q.status === 'Rechazada');

            renderPendingQuotesTable(pendingQuotes);
            renderFinalizedQuotesTable(finalizedQuotes);

        } catch (error) {
            console.error(error);
            pendingTableBody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
        }
    };

    const renderPendingQuotesTable = (quotes) => {
        pendingTableBody.innerHTML = '';
        if (quotes.length === 0) {
            pendingTableBody.innerHTML = '<tr<td colspan="5">No hay cotizaciones pendientes de aprobación.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${quote.quoteNumber || 'N/A'}</td>
                <td>${new Date(quote.requestDate).toLocaleDateString()}</td>
                <td>${quote.clientName || 'N/A'}</td>
                <td>${quote.advisorName || 'No especificado'}</td>
                <td><button class="btn btn-edit view-details-btn" data-id="${quote.id}">Revisar</button></td>
            `;
            pendingTableBody.appendChild(row);
        });
    };

    const renderFinalizedQuotesTable = (quotes) => {
        finalizedTableBody.innerHTML = '';
        if (quotes.length === 0) {
            finalizedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones finalizadas.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            let actionsHTML = '';
            if (quote.status === 'Aprobada') {
                actionsHTML = `<a href="/api/quote-requests/${quote.id}/pdf" class="btn" target="_blank">Descargar PDF</a>`;
            } else { // Rechazada
                actionsHTML = `<button class="btn btn-delete" disabled>Rechazada</button>`;
            }

            row.innerHTML = `
                <td>${quote.quoteNumber || 'N/A'}</td>
                <td>${quote.clientName || 'N/A'}</td>
                <td>${quote.eventName || 'N/A'}</td>
                <td><strong>${quote.status}</strong></td>
                <td>${actionsHTML}</td>
            `;
            finalizedTableBody.appendChild(row);
        });
    };

    const showQuoteDetails = (quoteId) => {
        selectedQuoteId = quoteId;
        const quote = allQuotes.find(q => q.id === quoteId);
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
        
        // Mostrar/ocultar botones de acción según el estado
        const actionButtonsContainer = document.getElementById('quote-actions');
        if (quote.status === 'Pendiente de Aprobación') {
            actionButtonsContainer.style.display = 'block';
        } else {
            actionButtonsContainer.style.display = 'none';
        }

        modal.style.display = 'block';
    };

    const handleStatusChange = async (action) => {
        const isRejecting = action === 'reject';
        let body = {};
        if (isRejecting) {
            const reason = prompt('Por favor, introduce el motivo del rechazo:');
            if (reason === null) return;
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
            fetchAllQuotes();
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    };

    document.body.addEventListener('click', (event) => {
        if (event.target.classList.contains('view-details-btn')) {
            const quoteId = parseInt(event.target.dataset.id, 10);
            console.log('Botón "Revisar" presionado. Redirigiendo a la página de revisión. ID de cotización:', quoteId);
            window.location.href = `/revision_cotizacion.html?id=${quoteId}`;
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

    fetchAllQuotes();
});
