document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('pending-quotes-tbody');

    async function loadPendingQuotes() {
        try {
            const response = await fetch('/api/quotes/pending-approval');

            if (response.status === 401 || response.status === 403) {
                alert('Acceso no autorizado. Debes ser administrador para ver esta página.');
                window.location.href = '/index.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Error al cargar las cotizaciones pendientes.');
            }

            const quotes = await response.json();
            renderQuotes(quotes);

        } catch (error) {
            console.error('Error:', error);
            tbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
        }
    }

    function renderQuotes(quotes) {
        tbody.innerHTML = ''; // Limpiar la tabla antes de renderizar

        if (quotes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No hay cotizaciones pendientes de aprobación.</td></tr>';
            return;
        }

        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.dataset.quoteId = quote.id;

            const formattedDate = new Date(quote.createdAt).toLocaleDateString('es-DO', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            row.innerHTML = `
                <td>${quote.quoteNumber}</td>
                <td>${quote.clientName}</td>
                <td>${quote.advisorName}</td>
                <td>${formattedDate}</td>
                <td class="actions">
                    <a href="/api/quote-requests/${quote.id}/pdf" target="_blank" class="admin-button view-btn">Ver PDF</a>
                    <button class="approve-btn" data-id="${quote.id}">Aprobar</button>
                    <button class="reject-btn" data-id="${quote.id}">Rechazar</button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    async function handleApprove(quoteId) {
        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/approve`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falló la aprobación de la cotización.');
            }

            const rowToRemove = tbody.querySelector(`tr[data-quote-id='${quoteId}']`);
            if (rowToRemove) {
                rowToRemove.remove();
            }
            
            if (tbody.children.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="5">No hay cotizaciones pendientes de aprobación.</td></tr>';
            }

        } catch (error) {
            console.error('Error al aprobar:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async function handleReject(quoteId) {
        const reason = prompt('Por favor, ingrese el motivo del rechazo:');
        if (!reason) {
            alert('El rechazo ha sido cancelado. Debe proporcionar un motivo.');
            return;
        }

        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: reason }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falló el rechazo de la cotización.');
            }

            const rowToRemove = tbody.querySelector(`tr[data-quote-id='${quoteId}']`);
            if (rowToRemove) {
                rowToRemove.remove();
            }

            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No hay cotizaciones pendientes de aprobación.</td></tr>';
            }

        } catch (error) {
            console.error('Error al rechazar:', error);
            alert(`Error: ${error.message}`);
        }
    }

    tbody.addEventListener('click', (event) => {
        const target = event.target;
        const quoteId = target.dataset.id;

        if (target.classList.contains('approve-btn')) {
            if (confirm(`¿Está seguro de que desea APROBAR la cotización?`)) {
                handleApprove(quoteId);
            }
        } else if (target.classList.contains('reject-btn')) {
            handleReject(quoteId);
        }
    });

    loadPendingQuotes();
});
