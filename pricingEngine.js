const TASA_DESERCION_FIJA = 0.10; // 10%

function assembleQuote(quoteInput, db) {
    console.log('--- INICIO DEL CÁLCULO EN PRICING ENGINE ---');
    console.log('1. Datos recibidos del formulario:', quoteInput);

    const {
        studentCount,
        productIds,
        aporteInstitucion,
        estudiantesCortesia
    } = quoteInput;
    const allProducts = db.products || [];

    console.log(`2. Buscando ${productIds ? productIds.length : 0} productos en la base de datos...`);
    const selectedProducts = (productIds || []).map(id => {
        const product = allProducts.find(p => String(p.id) === String(id));
        if (!product) {
            console.log(`   - Producto con ID ${id} NO ENCONTRADO.`);
        }
        return product;
    }).filter(p => p);

    console.log(`3. Se encontraron ${selectedProducts.length} productos completos.`);
    if (selectedProducts.length === 0) {
        console.log('   - No hay productos válidos, retornando cotización vacía.');
        return {
            ...quoteInput,
            id: Date.now(),
            createdAt: new Date().toISOString(),
            status: 'Error en Creación',
            itemsByReglon: {},
            calculatedPrices: [],
        };
    }

    const itemsByReglon = selectedProducts.reduce((acc, product) => {
        const reglon = product.reglon || 'General';
        if (!acc[reglon]) {
            acc[reglon] = [];
        }
        acc[reglon].push({
            id: product.id,
            name: product.name,
            details: product.detallesIncluidos || ''
        });
        return acc;
    }, {});
    console.log('4. Productos agrupados por sección (reglón).');


    console.log('5. Calculando precios...');
    let montoTotalProyecto = 0;
    selectedProducts.forEach(product => {
        const costo = parseFloat(product.costoBase) || 0;
        montoTotalProyecto += costo * (studentCount || 0);
    });
    console.log(`   - Subtotal (Costo x Cantidad): ${montoTotalProyecto}`);

    const margen = 0.30; // 30% fijo por ahora
    montoTotalProyecto = montoTotalProyecto / (1 - margen);
    console.log(`   - Total después de margen del ${margen * 100}%: ${montoTotalProyecto}`);

    if (aporteInstitucion && studentCount) {
         montoTotalProyecto += aporteInstitucion * studentCount;
         console.log(`   - Total después de aporte de la institución: ${montoTotalProyecto}`);
    }

    const estudiantesFacturables = Math.max(0, Math.floor((studentCount || 0) * (1 - TASA_DESERCION_FIJA)) - (estudiantesCortesia || 0));
    const precioFinalPorEstudiante = estudiantesFacturables > 0 ? montoTotalProyecto / estudiantesFacturables : 0;
    console.log(`   - Estudiantes facturables (después de deserción y cortesías): ${estudiantesFacturables}`);
    console.log(`   - Precio final por estudiante: ${precioFinalPorEstudiante.toFixed(2)}`);

    const calculatedPrices = [{
        venueName: 'Salón Principal', // Placeholder
        montoTotalProyecto: montoTotalProyecto.toFixed(2),
        precioFinalPorEstudiante: precioFinalPorEstudiante.toFixed(2),
        estudiantesFacturables: estudiantesFacturables
    }];
    console.log('6. Opciones de precios calculadas.');

    const finalQuote = {
        ...quoteInput,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        status: 'Pendiente de Aprobación',
        itemsByReglon: itemsByReglon,
        calculatedPrices: calculatedPrices,
    };

    console.log('7. Cotización final ensamblada y lista para ser guardada.');
    console.log('--- FIN DEL CÁLCULO EN PRICING ENGINE ---');

    return finalQuote;
}

module.exports = {
    assembleQuote
};
