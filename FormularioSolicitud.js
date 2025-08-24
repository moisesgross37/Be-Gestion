import React, { useState } from 'react'; // Import useState

function FormularioSolicitud() {
    // State for each form field
    const [cliente, setCliente] = useState('');
    const [nombreProyecto, setNombreProyecto] = useState('');
    const [descripcion, setDescripcion] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault(); // Prevent default form submission behavior

        const newProject = {
            cliente,
            nombre_proyecto: nombreProyecto, // Match backend expected field name
            descripcion
        };

        try {
            const response = await fetch('/api/proyectos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newProject),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Proyecto creado con éxito:', result);
            alert('Solicitud de diseño creada con éxito!');

            // Optionally, clear the form
            setCliente('');
            setNombreProyecto('');
            setDescripcion('');

        } catch (error) {
            console.error('Error al crear la solicitud:', error);
            alert(`Error al crear la solicitud: ${error.message}`);
        }
    };

    const formStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        maxWidth: '500px',
        margin: '20px auto',
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    };

    const inputStyle = {
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px'
    };

    const textareaStyle = {
        ...inputStyle,
        minHeight: '100px',
        resize: 'vertical'
    };

    const buttonStyle = {
        padding: '10px 20px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '16px'
    };

    return (
        <div>
            <h1>Nueva Solicitud de Diseño</h1>
            <form style={formStyle} onSubmit={handleSubmit}> {/* Add onSubmit handler */}
                <div>
                    <label htmlFor="cliente">Cliente:</label>
                    <input
                        type="text"
                        id="cliente"
                        name="cliente"
                        style={inputStyle}
                        value={cliente} // Controlled component
                        onChange={(e) => setCliente(e.target.value)} // Update state on change
                    />
                </div>
                <div>
                    <label htmlFor="nombre_proyecto">Nombre del Proyecto:</label>
                    <input
                        type="text"
                        id="nombre_proyecto"
                        name="nombre_proyecto"
                        style={inputStyle}
                        value={nombreProyecto} // Controlled component
                        onChange={(e) => setNombreProyecto(e.target.value)} // Update state on change
                    />
                </div>
                <div>
                    <label htmlFor="descripcion">Descripción:</label>
                    <textarea
                        id="descripcion"
                        name="descripcion"
                        style={textareaStyle}
                        value={descripcion} // Controlled component
                        onChange={(e) => setDescripcion(e.target.value)} // Update state on change
                    ></textarea>
                </div>
                <button type="submit" style={buttonStyle}>Crear Solicitud de Diseño</button>
            </form>
        </div>
    );
}

export default FormularioSolicitud;