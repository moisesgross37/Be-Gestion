document.addEventListener('DOMContentLoaded', () => {
    const quoteForm = document.getElementById('quote-form');
    const quoteNumberInput = document.getElementById('quoteNumber');
    const clientNameInput = document.getElementById('clientName');
    const clientAutocompleteResults = document.getElementById('client-autocomplete-results');
    const productListContainer = document.getElementById('product-list-container');
    const aporteInstitucionInput = document.getElementById('aporteInstitucion');
    const estudiantesCortesiaInput = document.getElementById('estudiantesCortesia');
    const calculatedGratuitiesDiv = document.getElementById('calculated-gratuities');
    const giftOptionsContainer = document.getElementById('gift-options-container');
    const giftOptionsRadios = document.getElementById('gift-options-radios');
    const studentCountInput = document.getElementById('studentCount');
    const summaryBillableStudents = document.getElementById('summary-billable-students');
    const summaryTotalAmount = document.getElementById('summary-total-amount');
    const summaryPricePerStudent = document.getElementById('summary-price-per-student');
    const successMessage = document.getElementById('success-message');

    let allProducts = [];
    let allVenues = [];
    let selectedProductIds = new Set();
    let selectedVenueIds = new Set();

    // --- 1. Cargar el Número de Cotización ---
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

    // --- 2. Autocompletado para Nombre del Cliente ---
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
                div.dataset.id = center.id; 
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

    document.addEventListener('click', (e) => {
        if (!clientNameInput.contains(e.target) && !clientAutocompleteResults.contains(e.target)) {
            clientAutocompleteResults.innerHTML = '';
        }
    });

    // --- 3. Cargar y Mostrar Productos y Salones ---
    const loadProductsAndVenues = async () => {
        try {
            const [productsResponse, venuesResponse] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/venues')
            ]);

            if (!productsResponse.ok) throw new Error('Error al obtener productos.');
            if (!venuesResponse.ok) throw new Error('Error al obtener salones.');

            allProducts = await productsResponse.json();
            allVenues = await venuesResponse.json();

            renderProductAndVenueSelection();

        } catch (error) {
            console.error('Error cargando productos y salones:', error);
            productListContainer.innerHTML = '<p>Error al cargar productos y salones.</p>';
        }
    };

    const renderProductAndVenueSelection = () => {
        productListContainer.innerHTML = '';

        // Agrupar productos por tipo
        const productsByCategory = allProducts.reduce((acc, product) => {
            const category = product.product_type || 'Otros';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(product);
            return acc;
        }, {});

        const categoryOrder = {
            'Paquete_Graduacion': 'Paquetes de Graduación',
            'Confeccion': 'Ropa y Artículos Individuales',
            'Servicio_Alquiler': 'Servicios y Amenidades Extras',
            'Servicio_Individual': 'Servicios y Amenidades Extras',
            'Articulo_Gratuidad': 'Artículos de Gratuidad', // Aunque no se seleccionan, pueden listarse
            'Otros': 'Otros Productos'
        };

        // Renderizar productos
        for (const key in categoryOrder) {
            const categoryName = categoryOrder[key];
            const productsInThisCategory = productsByCategory[key];

            if (productsInThisCategory && productsInThisCategory.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('product-category');
                categoryDiv.innerHTML = `<h3>${categoryName}</h3>`;

                productsInThisCategory.forEach(product => {
                    const label = document.createElement('label');
                    label.classList.add('product-item');
                    label.innerHTML = `
                        <input type="checkbox" name="selectedProducts" value="${product.id}" data-type="${product.product_type}"> 
                        ${product.name} 
                        ${product.costoBase !== undefined ? `(Costo Base: $${product.costoBase})` : ''}
                    `;
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            selectedProductIds.add(parseInt(e.target.value));
                        } else {
                            selectedProductIds.delete(parseInt(e.target.value));
                        }
                        updateSummary();
                        updateGratuitiesAndGifts();
                    });
                    categoryDiv.appendChild(label);
                });
                productListContainer.appendChild(categoryDiv);
            }
        }

        // Renderizar salones
        if (allVenues.length > 0) {
            const venuesDiv = document.createElement('div');
            venuesDiv.classList.add('product-category');
            venuesDiv.innerHTML = `<h3>Salones para Eventos</h3>`;
            allVenues.forEach(venue => {
                const label = document.createElement('label');
                label.classList.add('product-item');
                label.innerHTML = `
                    <input type="checkbox" name="selectedVenues" value="${venue.id}"> 
                    ${venue.name}
                `;
                const checkbox = label.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedVenueIds.add(parseInt(e.target.value));
                    } else {
                        selectedVenueIds.delete(parseInt(e.target.value));
                    }
                    updateSummary();
                });
                venuesDiv.appendChild(label);
            });
            productListContainer.appendChild(venuesDiv);
        }
        updateSummary(); // Actualizar resumen inicial
    };

    // --- 4. Lógica de Facilidades y Resumen en Tiempo Real ---
    const TASA_DESERCION_FIJA = 0.10; // Definida en pricingEngine.js

    const calculateQuoteEstimates = () => {
        const studentCount = parseInt(studentCountInput.value) || 0;
        const aporteInstitucion = parseFloat(aporteInstitucionInput.value) || 0;
        const estudiantesCortesia = parseInt(estudiantesCortesiaInput.value) || 0;

        let estimatedTotalProjectAmount = 0;
        const selectedProductsData = allProducts.filter(p => selectedProductIds.has(p.id));
        const selectedVenuesData = allVenues.filter(v => selectedVenueIds.has(v.id));

        // Sumar costos de productos
        selectedProductsData.forEach(product => {
            // Simplificado: solo sumar costoBase para estimación rápida
            // La lógica completa de precios está en el backend (pricingEngine)
            if (product.costoBase !== undefined) {
                estimatedTotalProjectAmount += parseFloat(product.costoBase);
            } else if (product.precioBaseGrupo) { // Para Servicio_Individual
                estimatedTotalProjectAmount += parseFloat(product.precioBaseGrupo);
            }
        });

        // Sumar costos de salones (asumiendo que tienen un costoBase)
        selectedVenuesData.forEach(venue => {
            if (venue.costoBase !== undefined) {
                estimatedTotalProjectAmount += parseFloat(venue.costoBase);
            }
        });

        // Aplicar aporte a la institución (resta del total)
        estimatedTotalProjectAmount -= aporteInstitucion;

        // Calcular estudiantes facturables
        const billableStudents = Math.floor(studentCount * (1 - TASA_DESERCION_FIJA)) - estudiantesCortesia;
        
        const estimatedPricePerStudent = billableStudents > 0 ? estimatedTotalProjectAmount / billableStudents : 0;

        return {
            billableStudents: Math.max(0, billableStudents),
            estimatedTotalAmount: estimatedTotalProjectAmount,
            estimatedPricePerStudent: estimatedPricePerStudent
        };
    };

    const updateSummary = () => {
        const estimates = calculateQuoteEstimates();
        summaryBillableStudents.textContent = estimates.billableStudents;
        summaryTotalAmount.textContent = `$${estimates.estimatedTotalAmount.toFixed(2)}`;
        summaryPricePerStudent.textContent = `$${estimates.estimatedPricePerStudent.toFixed(2)}`;
    };

    const updateGratuitiesAndGifts = () => {
        const studentCount = parseInt(studentCountInput.value) || 0;
        const selectedProductsData = allProducts.filter(p => selectedProductIds.has(p.id));

        let gratuitiesText = '';
        giftOptionsRadios.innerHTML = '';
        giftOptionsContainer.style.display = 'none';

        // Lógica de gratuidades (simplificada para el frontend)
        const hasCombo = selectedProductsData.some(p => p.product_type === 'Paquete_Graduacion');
        const hasPolo = selectedProductsData.some(p => p.name.toLowerCase().includes('polo'));

        // Simular regla de gratuidad por nivel (ej. si hay un combo y > X estudiantes)
        if (hasCombo && studentCount >= 50) { // Ejemplo: 50 estudiantes para activar
            gratuitiesText += 'Se activa gratuidad por nivel de combo. ';
            // Aquí deberíamos obtener las opciones de regalo del backend o de db.json
            // Por ahora, hardcodeamos opciones de ejemplo
            const giftOptions = [
                { id: 'gift1', name: 'Llavero Sublimado' },
                { id: 'gift2', name: 'Botón Promocional' }
            ];
            giftOptionsContainer.style.display = 'block';
            giftOptions.forEach(gift => {
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'selectedGift';
                radio.id = gift.id;
                radio.value = gift.name;
                const label = document.createElement('label');
                label.htmlFor = gift.id;
                label.textContent = gift.name;
                giftOptionsRadios.appendChild(radio);
                giftOptionsRadios.appendChild(label);
                giftOptionsRadios.appendChild(document.createElement('br'));
            });
        }

        // Regla 1 por 10 para Polos
        if (hasPolo && studentCount >= 10) {
            const freePolos = Math.floor(studentCount / 10);
            gratuitiesText += `${freePolos} Polo(s) de cortesía (Regla 1x10). `;
        }

        calculatedGratuitiesDiv.textContent = gratuitiesText || 'Ninguna cortesía calculada automáticamente.';
    };

    // Event Listeners para actualizar resumen y gratuidades
    studentCountInput.addEventListener('input', () => { updateSummary(); updateGratuitiesAndGifts(); });
    aporteInstitucionInput.addEventListener('input', updateSummary);
    estudiantesCortesiaInput.addEventListener('input', updateSummary);

    // --- 5. Manejar Envío del Formulario ---
    quoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        successMessage.classList.add('hidden'); 

        if (selectedProductIds.size === 0 && selectedVenueIds.size === 0) {
            alert('Por favor, seleccione al menos un producto o salón.');
            return;
        }

        const formData = new FormData(quoteForm);
        const quoteData = {
            quoteNumber: quoteNumberInput.value,
            clientName: formData.get('clientName'),
            eventName: formData.get('eventName'),
            studentCount: parseInt(formData.get('studentCount'), 10),
            productIds: Array.from(selectedProductIds),
            venueIds: Array.from(selectedVenueIds),
            aporteInstitucion: parseFloat(formData.get('aporteInstitucion')) || 0,
            estudiantesCortesia: parseInt(formData.get('estudiantesCortesia'), 10) || 0,
            selectedGift: formData.get('selectedGift') || null, // Si hay opción de regalo
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
            selectedProductIds.clear();
            selectedVenueIds.clear();
            loadQuoteNumber(); 
            loadProductsAndVenues(); // Recargar para resetear checkboxes
            updateSummary(); // Resetear resumen
            updateGratuitiesAndGifts(); // Resetear gratuidades
            successMessage.classList.remove('hidden');
            window.scrollTo(0, 0); 

        } catch (error) {
            console.error('Error al generar cotización:', error);
            alert(`Error: ${error.message}`);
        }
    });

    // Carga inicial de datos
    loadQuoteNumber();
    loadProductsAndVenues();
});