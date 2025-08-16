document.addEventListener('DOMContentLoaded', () => {

    // --- Lógica del Acordeón ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            // Alternar la clase 'active' en el header presionado
            header.classList.toggle('active');

            // El contenido a mostrar/ocultar es el siguiente elemento hermano
            const accordionContent = header.nextElementSibling;

            // Si el panel ya está abierto (tiene un maxHeight), ciérralo
            if (accordionContent.style.maxHeight) {
                accordionContent.style.maxHeight = null;
            } else {
                // Si está cerrado, ábrelo ajustando el maxHeight a su altura real
                accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
            }
        });
    });

    /**
     * Crea un manejador de recursos CRUD para una entidad específica (ej. Asesores, Zonas).
     * @param {string} resourceName - El nombre del recurso (ej. 'advisors', 'zones'). Usado para la URL de la API.
     * @param {string} entityDisplayName - El nombre para mostrar en los mensajes (ej. 'Asesor', 'Zona').
     * @param {string} formId - El ID del formulario para añadir un nuevo ítem.
     * @param {string} inputId - El ID del input para el nuevo nombre.
     * @param {string} listId - El ID de la lista <ul> para mostrar los ítems.
     */
    const createResourceHandler = (resourceName, entityDisplayName, formId, inputId, listId) => {
        const form = document.getElementById(formId);
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        const API_URL = `/api/${resourceName}`;

        // Función para obtener y mostrar los ítems
        const fetchAndDisplayItems = async () => {
            try {
                const response = await fetch(API_URL);
                if (!response.ok) throw new Error(`Error al obtener ${resourceName}.`);
                const items = await response.json();

                list.innerHTML = ''; // Limpiar lista

                if (items.length === 0) {
                    list.innerHTML = `<li>No hay ${resourceName} registrados.</li>`;
                    return;
                }

                items.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.textContent = item.name;
                    
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Eliminar';
                    deleteButton.classList.add('btn-delete');
                    deleteButton.addEventListener('click', () => deleteItem(item.id));

                    listItem.appendChild(deleteButton);
                    list.appendChild(listItem);
                });
            } catch (error) {
                console.error(error);
                list.innerHTML = `<li>Error al cargar ${resourceName}.</li>`;
            }
        };

        // Función para añadir un nuevo ítem
        const addItem = async (name) => {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });
                if (!response.ok) throw new Error(`Error al añadir ${entityDisplayName}.`);
                input.value = '';
                await fetchAndDisplayItems();
            } catch (error) {
                console.error(error);
                alert(`No se pudo añadir el ${entityDisplayName}.`);
            }
        };

        // Función para eliminar un ítem
        const deleteItem = async (id) => {
            if (!confirm(`¿Estás seguro de que quieres eliminar este ${entityDisplayName.toLowerCase()}?`)) return;

            try {
                const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error(`Error al eliminar ${entityDisplayName}.`);
                await fetchAndDisplayItems();
            } catch (error) {
                console.error(error);
                alert(`No se pudo eliminar el ${entityDisplayName}.`);
            }
        };

        // Event listener para el formulario
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = input.value.trim();
            if (name) addItem(name);
        });

        // Carga inicial
        fetchAndDisplayItems();
    };

    // Inicializar los manejadores para cada recurso
    createResourceHandler('advisors', 'Asesor', 'add-advisor-form', 'new-advisor-name', 'advisor-list');
    createResourceHandler('zones', 'Zona', 'add-zone-form', 'new-zone-name', 'zone-list');
    createResourceHandler('comments', 'Comentario', 'add-comment-form', 'new-comment-name', 'comment-list');

    // --- Lógica para la Gestión de Centros de Estudio ---

    const centersTableBody = document.getElementById('centers-table-body');
    const modal = document.getElementById('edit-center-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const editCenterForm = document.getElementById('edit-center-form');

    const editCenterId = document.getElementById('edit-center-id');
    const editCenterName = document.getElementById('edit-center-name');
    const editContactName = document.getElementById('edit-contact-name');
    const editContactNumber = document.getElementById('edit-contact-number');

    const fetchAndDisplayCenters = async () => {
        try {
            const response = await fetch('/api/centers');
            if (!response.ok) {
                throw new Error('Error al obtener centros.');
            }
            const centers = await response.json();

            centersTableBody.innerHTML = '';

            if (centers.length === 0) {
                centersTableBody.innerHTML = '<tr><td colspan="4">No hay centros registrados.</td></tr>';
                return;
            }

            centers.forEach(center => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${center.name}</td>
                    <td>${center.contactName || ''}</td>
                    <td>${center.contactNumber || ''}</td>
                    <td><button class="btn btn-edit" data-id="${center.id}">Editar</button></td>
                `;
                centersTableBody.appendChild(row);
            });

        } catch (error) {
            console.error('Error al mostrar centros:', error);
            centersTableBody.innerHTML = '<tr><td colspan="4">Error al cargar los centros.</td></tr>';
        }
    };

    const openEditModal = (center) => {
        editCenterId.value = center.id;
        editCenterName.value = center.name;
        editContactName.value = center.contactName;
        editContactNumber.value = center.contactNumber;

        modal.style.display = 'block';
    };

    const handleEditClick = async (event) => {
        if (!event.target.classList.contains('btn-edit')) return;
        
        const centerId = parseInt(event.target.dataset.id, 10);
        try {
            const response = await fetch('/api/centers');
            const centers = await response.json();
            const centerToEdit = centers.find(c => c.id === centerId);
            if (centerToEdit) {
                openEditModal(centerToEdit);
            }
        } catch (error) {
            console.error('Error al buscar centro para editar:', error);
        }
    };

    const handleUpdateCenter = async (event) => {
        event.preventDefault();
        const id = parseInt(editCenterId.value, 10);
        const updatedData = {
            name: editCenterName.value,
            contactName: editContactName.value,
            contactNumber: editContactNumber.value
        };

        try {
            const response = await fetch(`/api/centers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                throw new Error('Error al actualizar el centro.');
            }

            modal.style.display = 'none';
            await fetchAndDisplayCenters(); // Refrescar la tabla

        } catch (error) {
            console.error(error);
            alert('No se pudo actualizar el centro.');
        }
    };

    // Event Listeners para el modal y la tabla
    closeModalButton.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    centersTableBody.addEventListener('click', handleEditClick);
    editCenterForm.addEventListener('submit', handleUpdateCenter);

    // Carga inicial de los centros
    fetchAndDisplayCenters();
});
