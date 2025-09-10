console.log('Script loaded: confeccion_dashboard.js');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded: confeccion_dashboard.js');

    const columnMapping = {
        "Nuevo Pedido": document.getElementById('cards-nuevo-pedido'),
        "Diseño en Proceso": document.getElementById('cards-diseno-en-proceso'),
        "Pendiente Aprobación Interna": document.getElementById('cards-pendiente-aprobacion-interna'),
        "Pendiente Aprobación Cliente": document.getElementById('cards-pendiente-aprobacion-cliente'),
        "Diseño Bloqueado (3 Revisiones)": document.getElementById('cards-diseno-bloqueado'),
        "Pendiente de Pro Forma": document.getElementById('cards-pendiente-pro-forma'),
        "Pendiente de Listado": document.getElementById('cards-pendiente-de-listado'),
        "En Lista de Producción": document.getElementById('cards-en-lista-de-produccion'),
        "Pendiente de Impresión": document.getElementById('cards-pendiente-de-impresion'),
        "Pendiente de Calandrado": document.getElementById('cards-pendiente-de-calandrado'),
        "Pendiente de Confección": document.getElementById('cards-pendiente-de-confeccion'),
        "En Confección": document.getElementById('cards-en-confeccion'),
        "En Control de Calidad": document.getElementById('cards-en-control-de-calidad'),
        "Listo para Entrega": document.getElementById('cards-listo-para-entrega')
    };

    const modal = document.getElementById('assign-designer-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const designerSelect = document.getElementById('designer-select');
    const confirmAssignmentBtn = document.getElementById('confirm-assignment-btn');
    const modalProjectName = document.getElementById('modal-project-name');

    let currentProjectId = null;
    let allProjects = [];

    // Lista de diseñadores de ejemplo
    const designers = [
        { id: 1, name: 'Ana López' },
        { id: 2, name: 'Carlos Martínez' },
        { id: 3, name: 'Sofía Rodríguez' }
    ];

    const fetchAndRenderProjects = async () => {
        try {
            const response = await fetch('/api/proyectos_confeccion');
            if (!response.ok) throw new Error(`Error al cargar los proyectos: ${response.statusText}`);
            allProjects = await response.json();
            renderProjects(allProjects);
        } catch (error) {
            console.error(error);
        }
    };

    const renderProjects = (projects) => {
        Object.values(columnMapping).forEach(container => {
            if(container) container.innerHTML = '';
        });

        if (projects.length === 0) {
            const firstColumn = Object.values(columnMapping)[0];
            if(firstColumn) firstColumn.innerHTML = '<p>No hay proyectos para mostrar.</p>';
            return;
        }

        projects.forEach(project => {
            const card = createProjectCard(project);
            const targetColumn = columnMapping[project.status];
            if (targetColumn) {
                targetColumn.appendChild(card);
            } else {
                const firstColumn = columnMapping["Nuevo Pedido"];
                if(firstColumn) firstColumn.appendChild(card);
            }
        });
    };

    const createProjectCard = (project) => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.id = project.id;

        let remainingDaysHtml = '';
        if (project.fecha_inicio_produccion && project.fecha_compromiso_entrega) {
            const today = new Date();
            const deliveryDate = new Date(project.fecha_compromiso_entrega);
            const diffTime = deliveryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0) {
                remainingDaysHtml = `<p><strong>Días restantes:</strong> ${diffDays} días</p>`;
            } else {
                remainingDaysHtml = `<p><strong>Días de retraso:</strong> ${Math.abs(diffDays)} días</p>`;
            }
        }

        card.innerHTML = `
            <h3>${project.nombre_proyecto || 'Proyecto sin nombre'}</h3>
            <p><strong>Cliente:</strong> ${project.cliente || 'No especificado'}</p>
            ${remainingDaysHtml}
            <button class="btn view-details-btn">Ver Detalles</button>
        `;

        card.querySelector('.view-details-btn').addEventListener('click', (event) => {
            event.stopPropagation(); 
            handleCardClick(project);
        });

        return card;
    };

    const handleCardClick = (project) => {
        currentProjectId = project.id;
        if (project.status === 'Nuevo Pedido') {
            openAssignModal(project);
        } else {
            // Para todos los demás estados, abrir la página de detalles
            window.location.href = `/proyecto_diseno.html?id=${project.id}`;
        }
    };

    const openAssignModal = (project) => {
        modalProjectName.textContent = project.nombre_proyecto;
        designerSelect.innerHTML = ''; // Limpiar opciones anteriores
        designers.forEach(designer => {
            const option = document.createElement('option');
            option.value = designer.id;
            option.textContent = designer.name;
            designerSelect.appendChild(option);
        });
        modal.style.display = 'block';
    };

    const closeAssignModal = () => {
        modal.style.display = 'none';
    };

    const assignDesigner = async () => {
        const designerId = designerSelect.value;
        if (!currentProjectId || !designerId) return;

        try {
            const response = await fetch(`/api/proyectos-confeccion/${currentProjectId}/assign-designer`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designer_id: designerId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al asignar diseñador.');
            }

            alert('Diseñador asignado con éxito.');
            closeAssignModal();
            fetchAndRenderProjects(); // Recargar los proyectos para ver el cambio

        } catch (error) {
            console.error('Error al asignar:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // Event Listeners
    closeModalButton.addEventListener('click', closeAssignModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeAssignModal();
    });
    confirmAssignmentBtn.addEventListener('click', assignDesigner);

    // Carga inicial
    fetchAndRenderProjects();
});