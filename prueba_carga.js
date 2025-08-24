document.addEventListener('DOMContentLoaded', async () => {
  console.log('Script prueba_carga.js cargado y ejecutándose.');
  try {
    const response = await fetch('/api/advisors');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const advisors = await response.json();

    const advisorSelect = document.getElementById('asesor-a-cargo-select');
    if (advisorSelect) {
        // Limpiar opciones existentes y añadir la opción por defecto
        advisorSelect.innerHTML = '<option value="">Seleccione un asesor...</option>'; 

        // Iterar sobre la lista de asesores y añadir opciones
        advisors.forEach(advisor => {
            const option = document.createElement('option');
            option.value = advisor.name;
            option.textContent = advisor.name;
            advisorSelect.appendChild(option);
        });
    } else {
        console.error('Elemento <select> con id "asesor-a-cargo-select" no encontrado.');
    }
  } catch (error) {
    console.error('Error al cargar asesores en prueba_carga.js:', error);
  }
});