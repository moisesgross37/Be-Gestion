/**
 * pricingEngine.js
 * 
 * Este módulo contiene toda la lógica de negocio para calcular cotizaciones dinámicas.
 */

// --- Funciones de Ayuda ---

/**
 * Encuentra la regla aplicable en un conjunto de reglas basado en la cantidad de estudiantes.
 * @param {Array} rules - El array de reglas (ej. marginRules, gratuityRules).
 * @param {number} studentCount - La cantidad de estudiantes en la cotización.
 * @returns {object|null} La regla que aplica, o null si no se encuentra ninguna.
 */
const getApplicableRule = (rules, studentCount) => {
    if (!rules) return null;
    return rules.find(rule => studentCount >= rule.min_quantity && studentCount <= rule.max_quantity) || null;
};

/**
 * Calcula el precio de venta de un solo producto.
 * @param {object} product - El objeto del producto.
 * @param {number} studentCount - La cantidad de estudiantes.
 * @param {Array} marginRules - Todas las reglas de margen.
 * @returns {number} El precio de venta total para ese producto.
 */
const calculateProductPrice = (product, studentCount, marginRules) => {
    const applicableMarginRule = getApplicableRule(marginRules, studentCount);
    const margin = applicableMarginRule ? (parseFloat(applicableMarginRule.marginPercentage) / 100) : 0;

    switch (product.product_type) {
        case 'Confeccion':
        case 'Paquete_Graduacion':
            // Devuelve el precio total para este producto (precio unitario * cantidad)
            const unitPrice = parseFloat(product.costo_base) / (1 - margin);
            return unitPrice * studentCount;

        case 'Servicio_Alquiler':
            // Devuelve el precio de venta total del servicio
            return parseFloat(product.costo_base) / (1 - margin);

        case 'Servicio_Individual':
            // Devuelve el precio total escalado
            const basePrice = parseFloat(product.precio_venta_base_grupo);
            const minGroup = parseInt(product.grupo_minimo, 10);
            const additionalPrice = parseFloat(product.precio_venta_adicional);
            if (studentCount <= minGroup) {
                return basePrice;
            }
            return basePrice + ((studentCount - minGroup) * additionalPrice);

        case 'Articulo_Gratuidad':
        default:
            return 0; // Los artículos de gratuidad no tienen costo en la cotización
    }
};

// --- Función Principal ---

/**
 * Ensambla una cotización completa a partir de los datos de entrada.
 * @param {object} quoteInput - Datos del formulario (ej. { studentCount: 50, productIds: [1, 2, 3], desertionRate: 0.1 })
 * @param {object} db - El objeto completo de la base de datos con todas las reglas.
 * @returns {object} La cotización completamente calculada.
 */
const assembleQuote = (quoteInput, db) => {
    const { studentCount, productIds, desertionRate } = quoteInput;
    const { products, marginRules, gratuityRules } = db;

    // 1. Filtrar los productos seleccionados
    const selectedProducts = products.filter(p => productIds.includes(p.id.toString()));

    // 2. Calcular el Monto Total del Proyecto (sin deserción)
    let montoTotalDelProyecto = 0;
    selectedProducts.forEach(product => {
        montoTotalDelProyecto += calculateProductPrice(product, studentCount, marginRules);
    });

    // 3. Calcular el Precio Final por Estudiante (con deserción)
    const estudiantesFacturables = Math.floor(studentCount * (1 - (parseFloat(desertionRate) / 100)));
    const precioFinalPorEstudiante = montoTotalDelProyecto / estudiantesFacturables;

    // 4. Determinar y aplicar facilidades
    const facilidadesAplicadas = [];
    const applicableGratuityRule = getApplicableRule(gratuityRules, studentCount);
    const hasCombo = selectedProducts.some(p => p.product_type === 'Paquete_Graduacion');

    if (hasCombo && applicableGratuityRule) {
        facilidadesAplicadas.push(applicableGratuityRule.description);
    }

    // Regla especial "1 por 10" para Polos
    const hasPolo = selectedProducts.some(p => p.name.toLowerCase().includes('polo'));
    if (hasPolo) {
        const freePolos = Math.floor(studentCount / 10);
        if (freePolos > 0) {
            facilidadesAplicadas.push(`${freePolos} Polo(s) de cortesía (Regla 1x10)`);
        }
    }

    // 5. Construir el objeto de cotización final
    const finalQuote = {
        ...quoteInput,
        id: Date.now(),
        requestDate: new Date().toISOString(),
        calculatedPrices: {
            montoTotalProyecto: montoTotalDelProyecto.toFixed(2),
            precioFinalPorEstudiante: precioFinalPorEstudiante.toFixed(2),
            estudiantesFacturables: estudiantesFacturables
        },
        items: selectedProducts.map(p => ({ id: p.id, name: p.name, type: p.product_type })),
        facilidadesAplicadas,
        status: 'Pendiente de Aprobación'
    };

    return finalQuote;
};

module.exports = {
    assembleQuote,
};