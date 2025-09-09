document.addEventListener('DOMContentLoaded', async () => {
    const visitForm = document.getElementById('visit-form');
    const advisorSelect = document.getElementById('advisor');
    const centerNameInput = document.getElementById('centerName');
    const suggestionsContainer = document.getElementById('autocomplete-suggestions');
    const coordinatorNameInput = document.getElementById('coordinatorName');
    const coordinatorContactInput = document.getElementById('coordinatorContact');
    const commentsSelect = document.getElementById('comments');
    const visitDateInput = document.getElementById('visitDate');

    // Función para establecer la fecha actual
    const setCurrentDate = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexados
        const dd = String(today.getDate()).padStart(2, '0');
        visitDateInput.value = `${yyyy}-${mm}-${dd}`;
    };

    setCurrentDate(); // Establecer la fecha al cargar la página

    async function loadInitialData() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('No se pudieron cargar los datos iniciales.');
            const data = await response.json();

            // Cargar Asesores
            if (data.advisors) {
                data.advisors.forEach(advisor => {
                    advisorSelect.innerHTML += `<option value="${advisor.name}">${advisor.name}</option>`;
                });
            }

            // Cargar Comentarios
            if (data.comments) {
                data.comments.forEach(comment => {
                    commentsSelect.innerHTML += `<option value="${comment.text}">${comment.text}</option>`;
                });
            }
        } catch (error) {
            alert('No se pudieron cargar los datos necesarios. Revise la consola.');
        }
    }

    centerNameInput.addEventListener('input', async () => {
        const searchTerm = centerNameInput.value;
        if (searchTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`/api/centers/search?q=${encodeURIComponent(searchTerm)}`);
            const centers = await response.json();

            suggestionsContainer.innerHTML = '';
            if (centers.length > 0) {
                centers.forEach(center => {
                    const item = document.createElement('div');
                    item.textContent = center.name;
                    item.addEventListener('click', () => {
                        centerNameInput.value = center.name;
                        coordinatorNameInput.value = center.contactName || '';
                        coordinatorContactInput.value = center.contactNumber || '';
                        suggestionsContainer.style.display = 'none';
                    });
                    suggestionsContainer.appendChild(item);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching centers:', error);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (e.target !== centerNameInput) {
            suggestionsContainer.style.display = 'none';
        }
    });

    visitForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(visitForm);
        const visitData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/visits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(visitData),
            });
            if (!response.ok) {
                 const errorResult = await response.json();
                 throw new Error(errorResult.message || 'Error al guardar la visita.');
            }
            alert('¡Visita registrada con éxito!');
            visitForm.reset();
            setCurrentDate(); // Volver a poner la fecha actual después de resetear
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    await loadInitialData();
});