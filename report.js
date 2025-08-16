document.addEventListener('DOMContentLoaded', () => {
    const reportBody = document.getElementById('report-body');

    // Obtener y mostrar el reporte
    const fetchReport = async () => {
        try {
            const response = await fetch(`/api/report`); // Sin filtros
            const visits = await response.json();

            // Limpiar tabla
            reportBody.innerHTML = '';

            if (visits.length === 0) {
                reportBody.innerHTML = '<tr><td colspan="5">No se encontraron visitas.</td></tr>';
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

    // Carga inicial
    fetchReport();
});