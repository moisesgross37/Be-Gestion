document.addEventListener('DOMContentLoaded', () => {
    const quoteForm = document.getElementById('quote-form');
    const quoteNumberInput = document.getElementById('quoteNumber');
    const clientNameInput = document.getElementById('clientName');
    const clientAutocompleteResults = document.getElementById('client-autocomplete-results');
    const productListContainer = document.getElementById('product-list-container');
    const successMessage = document.getElementById('success-message');

    // 1. Cargar el Número de Cotización
    const loadQuoteNumber = async () => {
        try {
            const response = await fetch('/api/next-quote-number');
            if (!response.ok) throw new Error('Error al obtener el número de cotización.');
            const data = await response.json();
            quoteNumberInput.value = data.quoteNumber;
        } catch (error) {
            console.error('Error cargando número de cotización:', error);
            quoteNumberInput.value = 'Error';
        }
    };

    // 2. Autocompletado para Nombre del Cliente
    const searchClients = async (query) => {
        if (query.length < 2) {
            clientAutocompleteResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/centers/search?q=${query}`);
            if (!response.ok) throw new Error('Error al buscar clientes.');
            const centers = await response.json();
            
            clientAutocompleteResults.innerHTML = '';
            if (centers.length === 0) {
                clientAutocompleteResults.innerHTML = '<div>No se encontraron resultados</div>';
                return;
            }

            centers.forEach(center => {
                const div = document.createElement('div');
                div.textContent = center.name;
                div.dataset.id = center.id; // Guardar el ID si es necesario
                div.addEventListener('click', () => {
                    clientNameInput.value = center.name;
                    clientAutocompleteResults.innerHTML = '';
                });
                clientAutocompleteResults.appendChild(div);
            });
        } catch (error) {
            console.error('Error en la búsqueda de clientes:', error);
            clientAutocompleteResults.innerHTML = '<div>Error en la búsqueda</div>';
        }
    };

    clientNameInput.addEventListener('input', (e) => {
        searchClients(e.target.value);
    });

    // Ocultar resultados de autocompletado al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!clientNameInput.contains(e.target) && !clientAutocompleteResults.contains(e.target)) {
            clientAutocompleteResults.innerHTML = '';
        }
    });

    // 3. Cargar y Mostrar Productos
    const loadProducts = async () => {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Error al obtener productos.');
            const products = await response.json();

            productListContainer.innerHTML = ''; // Limpiar mensaje de carga

            if (products.length === 0) {
                productListContainer.innerHTML = '<p>No hay productos disponibles.</p>';
                return;
            }

            // Agrupar productos por tipo
            const productsByCategory = products.reduce((acc, product) => {
                const category = product.product_type || 'Otros';
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(product);
                return acc;
            }, {});

            for (const category in productsByCategory) {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('product-category');
                categoryDiv.innerHTML = `<h3>${category.replace(/_/g, ' ')}</h3>`;

                productsByCategory[category].forEach(product => {
                    const label = document.createElement('label');
                    label.classList.add('product-item');
                    label.innerHTML = `
                        <input type="checkbox" name="selectedProducts" value="${product.id}"> 
                        ${product.name} 
                        ${product.costoBase ? `(Costo Base: $${product.costoBase})` : ''}
                    `;
                    categoryDiv.appendChild(label);
                });
                productListContainer.appendChild(categoryDiv);
            }

        } catch (error) {
            console.error('Error cargando productos:', error);
            productListContainer.innerHTML = '<p>Error al cargar productos.</p>';
        }
    };

    // 4. Manejar Envío del Formulario
    quoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        successMessage.classList.add('hidden'); // Ocultar mensaje de éxito anterior

        const selectedProductCheckboxes = document.querySelectorAll('input[name="selectedProducts"]:checked');
        if (selectedProductCheckboxes.length === 0) {
            alert('Por favor, seleccione al menos un producto.');
            return;
        }

        const productIds = Array.from(selectedProductCheckboxes).map(cb => cb.value);

        const formData = new FormData(quoteForm);
        const quoteData = {
            clientName: formData.get('clientName'),
            eventName: formData.get('eventName'),
            studentCount: parseInt(formData.get('studentCount'), 10),
            productIds: productIds,
            // desertionRate ya no se envía desde el frontend
        };

        try {
            const response = await fetch('/api/quote-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al generar la cotización.');
            }

            const result = await response.json();
            console.log('Cotización generada:', result);
            quoteForm.reset();
            loadQuoteNumber(); // Cargar el siguiente número de cotización
            loadProducts(); // Recargar productos si es necesario
            successMessage.classList.remove('hidden');
            window.scrollTo(0, 0); // Volver arriba

        } catch (error) {
            console.error('Error al generar cotización:', error);
            alert(`Error: ${error.message}`);
        }
    });

    // Carga inicial de datos
    loadQuoteNumber();
    loadProducts();
});
