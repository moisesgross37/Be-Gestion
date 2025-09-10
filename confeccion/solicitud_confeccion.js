document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const asesorSelect = document.getElementById('nombre_asesor');
    const centroInput = document.getElementById('nombre_centro');
    const autocompleteResults = document.getElementById('autocomplete-results');

    // Poblar el menú de asesores
    fetch('/api/asesores')
        .then(response => response.json())
        .then(asesores => {
            asesores.forEach(asesor => {
                const option = document.createElement('option');
                option.value = asesor.name;
                option.textContent = asesor.name;
                asesorSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error al cargar asesores:', error));

    // Autocompletado para el nombre del centro
    centroInput.addEventListener('input', () => {
        const query = centroInput.value;
        if (query.length < 2) {
            autocompleteResults.innerHTML = '';
            return;
        }

        fetch(`/api/centros/search?q=${query}`)
            .then(response => response.json())
            .then(centros => {
                autocompleteResults.innerHTML = '';
                centros.forEach(centro => {
                    const div = document.createElement('div');
                    div.textContent = centro.name;
                    div.addEventListener('click', () => {
                        centroInput.value = centro.name;
                        autocompleteResults.innerHTML = '';
                    });
                    autocompleteResults.appendChild(div);
                });
            })
            .catch(error => console.error('Error en la búsqueda de centros:', error));
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(form);

        fetch('/api/solicitudes', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(data => {
            console.log(data);
            alert('Solicitud enviada con éxito');
            form.reset();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al enviar la solicitud');
        });
    });
});
