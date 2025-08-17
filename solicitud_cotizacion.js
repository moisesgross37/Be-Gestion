document.addEventListener('DOMContentLoaded', async () => {
    const quoteRequestForm = document.getElementById('quote-request-form');
    const quoteNumberInput = document.getElementById('quote-number');
    const requestDateInput = document.getElementById('request-date');
    const advisorNameSelect = document.getElementById('advisor-name');
    const centerNameSelect = document.getElementById('center-name');
    const categoriesContainer = document.getElementById('categories-container');
    const facilitiesContainer = document.getElementById('facilities-container');
    const studentQuantityInput = document.getElementById('student-quantity');
    const successMessage = document.getElementById('success-message');

    // --- Funciones para cargar datos ---

    const fetchAndPopulateAdvisors = async () => {
        try {
            const response = await fetch('/api/advisors');
            const advisors = await response.json();
            advisors.forEach(advisor => {
                const option = document.createElement('option');
                option.value = advisor.name;
                option.textContent = advisor.name;
                advisorNameSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar asesores:', error);
        }
    };

    const fetchAndPopulateCenters = async () => {
        try {
            const response = await fetch('/api/centers');
            const centers = await response.json();
            centers.forEach(center => {
                const option = document.createElement('option');
                option.value = center.name;
                option.textContent = center.name;
                centerNameSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar centros:', error);
        }
    };

    const fetchAndPopulateCategories = async () => {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();

            categories.forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('category-item');

                const categoryCheckbox = document.createElement('input');
                categoryCheckbox.type = 'checkbox';
                categoryCheckbox.id = `cat-${category.id}`;
                categoryCheckbox.name = 'category';
                categoryCheckbox.value = category.id;

                const categoryLabel = document.createElement('label');
                categoryLabel.htmlFor = `cat-${category.id}`;
                categoryLabel.textContent = category.name;

                categoryDiv.appendChild(categoryCheckbox);
                categoryDiv.appendChild(categoryLabel);

                const subOptionsDiv = document.createElement('div');
                subOptionsDiv.id = `sub-options-${category.id}`;
                subOptionsDiv.classList.add('sub-options-container', 'hidden');

                if (category.options && category.options.length > 0) {
                    category.options.forEach(option => {
                        const subOptionCheckbox = document.createElement('input');
                        subOptionCheckbox.type = 'checkbox';
                        subOptionCheckbox.id = `sub-cat-${option.id}`;
                        subOptionCheckbox.name = `sub-category-${category.id}`;
                        subOptionCheckbox.value = option.id;

                        const subOptionLabel = document.createElement('label');
                        subOptionLabel.htmlFor = `sub-cat-${option.id}`;
                        subOptionLabel.textContent = option.name;

                        subOptionsDiv.appendChild(subOptionCheckbox);
                        subOptionsDiv.appendChild(subOptionLabel);
                        subOptionsDiv.appendChild(document.createElement('br'));
                    });
                }

                categoryCheckbox.addEventListener('change', () => {
                    if (categoryCheckbox.checked) {
                        subOptionsDiv.classList.remove('hidden');
                    } else {
                        subOptionsDiv.classList.add('hidden');
                        // Desmarcar todas las sub-opciones cuando la categoría principal se desmarca
                        subOptionsDiv.querySelectorAll('input[type="checkbox"]').forEach(subCheckbox => {
                            subCheckbox.checked = false;
                        });
                    }
                });

                categoriesContainer.appendChild(categoryDiv);
                categoriesContainer.appendChild(subOptionsDiv);
            });
        } catch (error) {
            console.error('Error al cargar categorías:', error);
        }
    };

    const fetchAndPopulateFacilities = async () => {
        try {
            const response = await fetch('/api/facilities');
            const facilities = await response.json();

            facilities.forEach(facility => {
                const facilityDiv = document.createElement('div');
                const facilityCheckbox = document.createElement('input');
                facilityCheckbox.type = 'checkbox';
                facilityCheckbox.id = `fac-${facility.id}`;
                facilityCheckbox.name = 'facilities';
                facilityCheckbox.value = facility.id;

                const facilityLabel = document.createElement('label');
                facilityLabel.htmlFor = `fac-${facility.id}`;
                facilityLabel.textContent = facility.name;

                facilityDiv.appendChild(facilityCheckbox);
                facilityDiv.appendChild(facilityLabel);
                facilitiesContainer.appendChild(facilityDiv);
            });
        } catch (error) {
            console.error('Error al cargar facilidades:', error);
        }
    };

    const fetchNextQuoteNumber = async () => {
        try {
            const response = await fetch('/api/next-quote-number');
            const data = await response.json();
            quoteNumberInput.value = data.nextQuoteNumber;
        } catch (error) {
            console.error('Error al obtener número de cotización:', error);
        }
    };

    // --- Inicialización del formulario ---
    const initializeForm = async () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0!
        const dd = String(today.getDate()).padStart(2, '0');
        requestDateInput.value = `${yyyy}-${mm}-${dd}`;

        await fetchNextQuoteNumber();
        await fetchAndPopulateAdvisors();
        await fetchAndPopulateCenters();
        await fetchAndPopulateCategories();
        await fetchAndPopulateFacilities();
    };

    // --- Manejo del envío del formulario ---
    quoteRequestForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const selectedCategories = [];
        categoriesContainer.querySelectorAll('input[name="category"]:checked').forEach(checkbox => {
            const categoryId = checkbox.value;
            const subOptions = [];
            categoriesContainer.querySelectorAll(`input[name="sub-category-${categoryId}"]:checked`).forEach(subCheckbox => {
                subOptions.push(subCheckbox.value);
            });
            selectedCategories.push({ id: categoryId, subOptions: subOptions });
        });

        const selectedFacilities = [];
        facilitiesContainer.querySelectorAll('input[name="facilities"]:checked').forEach(checkbox => {
            selectedFacilities.push(checkbox.value);
        });

        const quoteData = {
            quoteNumber: quoteNumberInput.value,
            requestDate: requestDateInput.value,
            advisorName: advisorNameSelect.value,
            centerName: centerNameSelect.value,
            categories: selectedCategories,
            studentQuantity: parseInt(studentQuantityInput.value, 10),
            facilities: selectedFacilities
        };

        try {
            const response = await fetch('/api/quote-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(quoteData),
            });

            if (response.ok) {
                successMessage.classList.remove('hidden');
                quoteRequestForm.reset();
                // Re-initialize form for next request
                await initializeForm();
                setTimeout(() => successMessage.classList.add('hidden'), 3000);
            } else {
                const errorData = await response.json();
                alert(`Error al registrar la solicitud: ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error('Error al enviar la solicitud:', error);
            alert('Error de conexión al registrar la solicitud.');
        }
    });

    // --- Cargar el formulario al inicio ---
    initializeForm();
});
