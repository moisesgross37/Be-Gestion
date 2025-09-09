// ESTA ES LA VERSIÓN 5.3 - LA VERSIÓN DE PRUEBA DEFINITIVA
function assembleQuote(quoteInput, db) {
    // PRUEBA DE VIDA: Si vemos este mensaje, sabemos que el nuevo código se está ejecutando.
    console.log('--- PRUEBA DE VIDA v6.0: El motor de precios nuevo SE ESTÁ EJECUTANDO ---'); 

    const {
        studentCount = 0,
        productIds = [],
        aporteInstitucion = 0,
        estudiantesCortesia = 0,
        tasaDesercion = 0.10
    } = quoteInput;

    const allProducts = db.products || [];
    const marginRules = db.marginRules || [
        { min: 1, max: 49, margin: 0.40 },
        { min: 50, max: 99, margin: 0.30 },
        { min: 100, max: 199, margin: 0.25 },
        { min: 200, max: Infinity, margin: 0.15 }
    ];

    const selectedProducts = productIds.map(id => allProducts.find(p => p.id === id)).filter(p => p);

    if (studentCount <= 0 || selectedProducts.length === 0) {
        return { error: 'Datos insuficientes para calcular.' };
    }

    const applicableMarginRule = marginRules.find(r => studentCount >= r.min && studentCount <= r.max);
    const beneficioNetoEmpresa = applicableMarginRule ? applicableMarginRule.margin : 0.30;
    const comisionAsesorPercentageOfSale = 0.10;

    let costoTotalProyecto = 0;
    selectedProducts.forEach(product => {
        const costoBaseText = product['COSTO BASE'] || '0';
        const costoBase = parseFloat(costoBaseText.replace(/[^0-9.]/g, '')) || 0;
        const tipoPrecio = product['TIPO DE PRECIO'] || '';

        if (tipoPrecio.trim() === 'por_estudiante') {
            costoTotalProyecto += costoBase * studentCount;
        } else {
            costoTotalProyecto += costoBase;
        }
    });

    // --- FÓRMULA DE PRECIO CORREGIDA Y DEFINITIVA ---
    let precioVentaTotalProyecto = costoTotalProyecto / (1 - beneficioNetoEmpresa - comisionAsesorPercentageOfSale);

    if (aporteInstitucion > 0) {
        precioVentaTotalProyecto += aporteInstitucion * studentCount;
    }

    // --- CÁLCULO DE ESTUDIANTES CORREGIDO Y DEFINITIVO ---
    const estudiantesParaFacturar = Math.floor(Math.max(0, (studentCount * (1 - tasaDesercion)) - estudiantesCortesia));
    const precioFinalPorEstudiante = estudiantesParaFacturar > 0 ? precioVentaTotalProyecto / estudiantesParaFacturar : 0;

    const result = {
        calculatedPrices: [{
            montoTotalProyecto: precioVentaTotalProyecto.toFixed(2),
            precioFinalPorEstudiante: precioFinalPorEstudiante.toFixed(2),
            estudiantesFacturables: estudiantesParaFacturar
        }],
        facilidadesAplicadas: [] // Lógica de facilidades puede ir aquí
    };

    return result;
}

module.exports = { assembleQuote };