document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quote-form');
    const quoteNumberInput = document.getElementById('quoteNumber');
    const productListContainer = document.getElementById('product-list-container');
    const facilitiesSection = document.getElementById('facilities-section');

    let allProducts = []; // Almacenar todos los productos para referencia futura

    /**
     * Carga el próximo número de cotización y lo muestra en el campo correspondiente.
     */
    const fetchNextQuoteNumber = async () => {
        try {
            const response = await fetch('/api/next-quote-number');
            if (!response.ok) throw new Error('Error al obtener el número de cotización.');
            const data = await response.json();
            quoteNumberInput.value = data.nextQuoteNumber;
        } catch (error) {
            console.error(error);
            quoteNumberInput.value = 'Error';
        }
    };

    /**
     * Comprueba si entre los productos seleccionados hay un paquete de graduación.
     * Si es así, muestra la sección de facilidades.
     */
    const checkPackageSelection = () => {
        const selectedCheckboxes = productListContainer.querySelectorAll('input[type="checkbox"]:checked');
        const selectedProductIds = Array.from(selectedCheckboxes).map(cb => cb.value);

        const hasPackage = selectedProductIds.some(id => {
            const product = allProducts.find(p => p.id.toString() === id);
            return product && product.product_type === 'Paquete_Graduacion';
        });

        if (hasPackage) {
            facilitiesSection.style.display = 'block';
        } else {
            facilitiesSection.style.display = 'none';
        }
    };

    /**
     * Carga todos los productos desde la API y los renderiza como checkboxes.
     */
    const fetchAndRenderProducts = async () => {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Error al cargar los productos.');
            allProducts = await response.json();

            productListContainer.innerHTML = ''; // Limpiar el mensaje "Cargando..."

            if (allProducts.length === 0) {
                productListContainer.innerHTML = '<p>No hay productos disponibles. Por favor, añada productos en el Panel de Administración.</p>';
                return;
            }

            allProducts.forEach(product => {
                const div = document.createElement('div');
                div.classList.add('checkbox-item');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `product-${product.id}`;
                checkbox.name = 'productIds';
                checkbox.value = product.id;
                checkbox.addEventListener('change', checkPackageSelection);

                const label = document.createElement('label');
                label.htmlFor = `product-${product.id}`;
                label.textContent = `${product.name} (Tipo: ${product.product_type})`;

                div.appendChild(checkbox);
                div.appendChild(label);
                productListContainer.appendChild(div);
            });

        } catch (error) {
            console.error(error);
            productListContainer.innerHTML = '<p>Error al cargar los productos. Intente recargar la página.</p>';
        }
    };

    /**
     * Maneja el envío del formulario.
     */
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        
        const selectedProductIds = Array.from(formData.getAll('productIds'));

        if (selectedProductIds.length === 0) {
            alert('Por favor, seleccione al menos un producto.');
            return;
        }

        const quoteInput = {
            quoteNumber: formData.get('quoteNumber'),
            clientName: formData.get('clientName'),
            eventName: formData.get('eventName'),
            studentCount: parseInt(formData.get('studentCount'), 10),
            desertionRate: parseFloat(formData.get('desertionRate')),
            productIds: selectedProductIds,
            // Aquí se añadiría la lógica para recolectar las facilidades seleccionadas
        };

        try {
            const response = await fetch('/api/quote-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteInput),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en el servidor.');
            }

            const result = await response.json();
            alert(`¡Cotización registrada con éxito!\nPrecio Total: ${result.quote.calculatedPrices.montoTotalProyecto}\nPrecio por Estudiante: ${result.quote.calculatedPrices.precioFinalPorEstudiante}`);
            form.reset();
            checkPackageSelection(); // Ocultar sección de facilidades
            await fetchNextQuoteNumber(); // Cargar el siguiente número

        } catch (error) {
            console.error('Error al enviar la cotización:', error);
            alert(`No se pudo registrar la cotización: ${error.message}`);
        }
    };

    // --- Inicialización ---
    const init = () => {
        fetchNextQuoteNumber();
        fetchAndRenderProducts();
        form.addEventListener('submit', handleFormSubmit);
    };

    init();
});