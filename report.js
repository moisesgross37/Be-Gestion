document.addEventListener('DOMContentLoaded', () => {
    const reportBody = document.getElementById('report-body');
    const filterForm = document.getElementById('filter-form');
    const advisorFilter = document.getElementById('advisor-filter');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const clearFiltersButton = document.getElementById('clear-filters');

    // Poblar el filtro de asesores
    const populateAdvisorFilter = async () => {
        try {
            const response = await fetch('/api/advisors');
            const advisors = await response.json();
            advisors.forEach(advisor => {
                const option = document.createElement('option');
                option.value = advisor.name;
                option.textContent = advisor.name;
                advisorFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar asesores:', error);
        }
    };

    // Obtener y mostrar el reporte
    const fetchReport = async () => {
        const advisor = advisorFilter.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        // Construir la URL con los parámetros de consulta
        const query = new URLSearchParams();
        if (advisor) query.append('advisor', advisor);
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);

        try {
            const response = await fetch(`/api/report?${query.toString()}`);
            const visits = await response.json();

            // Limpiar tabla
            reportBody.innerHTML = '';

            if (visits.length === 0) {
                reportBody.innerHTML = '<tr><td colspan="5">No se encontraron visitas con los filtros seleccionados.</td></tr>';
                return;
            }

            visits.forEach(visit => {
                const row = document.createElement('tr');
                // Corregir el manejo de la fecha para evitar problemas de zona horaria
                const visitDate = new Date(visit.visitDate);
                const formattedDate = new Date(visitDate.getTime() + visitDate.getTimezoneOffset() * 60000).toLocaleDateString('es-ES');

                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${visit.advisorName}</td>
                    <td>${visit.centerName}</td>
                    <td>${visit.contactName} (${visit.contactNumber || 'N/A'})</td>
                    <td>${visit.comments || ''}</td>
                `;
                reportBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al cargar el reporte:', error);
            reportBody.innerHTML = '<tr><td colspan="5">Error al cargar el reporte.</td></tr>';
        }
    };

    // Event Listeners
    filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        fetchReport();
    });

    clearFiltersButton.addEventListener('click', () => {
        filterForm.reset();
        fetchReport();
    });

    // Carga inicial
    const initialize = async () => {
        await populateAdvisorFilter();
        await fetchReport();
    };

    initialize();
});