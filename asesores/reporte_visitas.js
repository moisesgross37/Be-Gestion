document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del HTML que vamos a manipular
    const tableBody = document.getElementById('visits-table-body');
    const filterAdvisor = document.getElementById('filterAdvisor');
    const filterCenter = document.getElementById('filterCenter'); // Filtro de centro
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');

    let allVisits = []; // Un array para guardar todas las visitas
    let allAdvisors = []; // Un array para guardar todos los asesores
    let allCenters = []; // Un array para guardar todos los centros

    /**
     * Carga los datos iniciales (visitas, asesores y centros) desde el servidor.
     */
    async function loadInitialData() {
        try {
            // Hacemos tres peticiones a la vez para ser más eficientes
            const [visitsResponse, advisorsResponse, centersResponse] = await Promise.all([
                fetch('/api/visits'),
                fetch('/api/advisors'),
                fetch('/api/centers')
            ]);
            
            if (!visitsResponse.ok || !advisorsResponse.ok || !centersResponse.ok) {
                throw new Error('No se pudieron cargar los datos del reporte.');
            }
            
            allVisits = await visitsResponse.json();
            allAdvisors = await advisorsResponse.json();
            allCenters = await centersResponse.json();
            
            // Una vez cargados los datos, llenamos los filtros y la tabla
            populateAdvisorFilter();
            populateCenterFilter();
            renderVisits(allVisits);
        } catch (error) {
            console.error("Error cargando datos:", error);
            tableBody.innerHTML = `<tr><td colspan="5">Error al cargar los datos. Por favor, revise la consola.</td></tr>`;
        }
    }

    /**
     * Llena el menú desplegable <select> con los nombres de los asesores.
     */
    function populateAdvisorFilter() {
        allAdvisors.forEach(advisor => {
            const option = document.createElement('option');
            option.value = advisor.name;
            option.textContent = advisor.name;
            filterAdvisor.appendChild(option);
        });
    }

    /**
     * Llena el menú desplegable <select> con los nombres de los centros.
     */
    function populateCenterFilter() {
        allCenters.forEach(center => {
            const option = document.createElement('option');
            option.value = center.name;
            option.textContent = center.name;
            filterCenter.appendChild(option);
        });
    }

    /**
     * Dibuja las filas de la tabla con la lista de visitas que recibe.
     * @param {Array} visits - El array de visitas a mostrar.
     */
    function renderVisits(visits) {
        tableBody.innerHTML = ''; // Limpiar la tabla antes de dibujar
        
        if (visits.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No se encontraron visitas.</td></tr>`;
            return;
        }

        // Ordenamos las visitas por fecha, de la más reciente a la más antigua
        visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));

        visits.forEach(visit => {
            const row = document.createElement('tr');
            
            // Formateamos la fecha para que sea legible
            const visitDate = new Date(visit.visitDate).toLocaleDateString('es-DO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            row.innerHTML = `
                <td>${visitDate}</td>
                <td>${visit.advisorName || 'N/A'}</td>
                <td>${visit.centerName || 'N/A'}</td>
                <td>${visit.coordinatorName || 'N/A'}</td>
                <td>${visit.comments || ''}</td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    /**
     * Se activa cada vez que el usuario cambia un filtro.
     * Toma la lista completa de visitas y aplica los filtros seleccionados.
     */
    function applyFilters() {
        let filteredVisits = [...allVisits];

        const advisor = filterAdvisor.value;
        const center = filterCenter.value;
        const startDate = filterStartDate.value;
        const endDate = filterEndDate.value;

        // Filtrar por asesor
        if (advisor) {
            filteredVisits = filteredVisits.filter(v => v.advisorName === advisor);
        }

        // Filtrar por centro
        if (center) {
            filteredVisits = filteredVisits.filter(v => v.centerName === center);
        }

        // Filtrar por fecha de inicio
        if (startDate) {
            // Añadimos T00:00:00 para asegurar que la comparación sea desde el inicio del día
            filteredVisits = filteredVisits.filter(v => new Date(v.visitDate) >= new Date(startDate + 'T00:00:00'));
        }
        // Filtrar por fecha de fin
        if (endDate) {
            filteredVisits = filteredVisits.filter(v => new Date(v.visitDate) <= new Date(endDate + 'T00:00:00'));
        }
        
        renderVisits(filteredVisits);
    }
    
    // Asignamos la función applyFilters a los eventos de cambio de los filtros
    filterAdvisor.addEventListener('change', applyFilters);
    filterCenter.addEventListener('change', applyFilters);
    filterStartDate.addEventListener('change', applyFilters);
    filterEndDate.addEventListener('change', applyFilters);

    // --- Ejecución Inicial ---
    // Cuando la página carga, llamamos a la función principal para que todo empiece a funcionar.
    loadInitialData();
});