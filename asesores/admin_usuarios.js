document.addEventListener('DOMContentLoaded', () => {
    const tableContainer = document.getElementById('users-table-container');
    const inviteForm = document.getElementById('invite-user-form');

    // --- Elementos del Modal de Edición ---
    const editModal = document.getElementById('edit-role-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const editForm = document.getElementById('edit-role-form');
    const modalUserName = document.getElementById('modal-user-name');
    const modalUserIdInput = document.getElementById('modal-user-id');
    const modalUserRoleSelect = document.getElementById('modal-user-role');

    // --- Lógica para enviar el formulario de invitación ---
    if (inviteForm) {
        inviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('new-user-email');
            const rolInput = document.getElementById('new-user-role');
            const email = emailInput.value;
            const rol = rolInput.value;

            if (!email || !rol) {
                alert('Por favor, complete todos los campos.');
                return;
            }

            try {
                const response = await fetch('/api/invite-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, rol }),
                    credentials: 'same-origin'
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || `Error del servidor: ${response.status}`);
                }
                alert(`¡Invitación enviada a ${email}!\n\nPuedes ver el correo de prueba en esta URL:\n${result.previewUrl}`);
                inviteForm.reset();
                cargarUsuarios();
            } catch (error) {
                alert(`Error al enviar la invitación: ${error.message}`);
            }
        });
    }

    // --- Lógica para abrir y cerrar el Modal de Edición ---
    if (closeModalBtn) {
        closeModalBtn.onclick = () => { editModal.style.display = 'none'; };
    }
    window.onclick = (event) => {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
    };

    // --- Lógica para los botones de la tabla (Cambiar Estado y Editar Rol) ---
    if (tableContainer) {
        tableContainer.addEventListener('click', async (e) => {
            const target = e.target;

            // Botón de Cambiar Estado
            if (target.classList.contains('status-btn')) {
                const userId = target.dataset.id;
                const userName = target.closest('tr').querySelector('td').textContent;

                if (confirm(`¿Estás seguro de que quieres cambiar el estado del usuario "${userName}"?`)) {
                    try {
                        const response = await fetch(`/api/users/${userId}/toggle-status`, {
                            method: 'POST',
                            credentials: 'same-origin'
                        });
                        const result = await response.json();
                        if (!response.ok) {
                            throw new Error(result.message || 'Error en el servidor.');
                        }
                        cargarUsuarios();
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                    }
                }
            }

            // Botón de Editar Rol
            if (target.classList.contains('edit-btn')) {
                const userRow = target.closest('tr');
                const userId = target.dataset.id;
                const userName = userRow.cells[0].textContent;
                const userRole = userRow.cells[2].textContent;

                // Llenar y mostrar el modal
                modalUserIdInput.value = userId;
                modalUserName.textContent = userName;
                modalUserRoleSelect.value = userRole;
                editModal.style.display = 'block';
            }
        });
    }

    // --- Lógica para guardar el cambio de Rol desde el Modal ---
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = modalUserIdInput.value;
            const newRole = modalUserRoleSelect.value;

            try {
                const response = await fetch(`/api/users/${userId}/edit-role`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newRole }),
                    credentials: 'same-origin'
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Error en el servidor.');
                }

                // Si tiene éxito, cerrar modal y recargar tabla
                editModal.style.display = 'none';
                cargarUsuarios();

            } catch (error) {
                alert(`Error al cambiar el rol: ${error.message}`);
            }
        });
    }

    // --- Lógica para cargar y mostrar la tabla de usuarios ---
    async function cargarUsuarios() {
        try {
            const response = await fetch('/api/users', { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const users = await response.json();
            mostrarUsuariosEnTabla(users);
        } catch (error) {
            tableContainer.innerHTML = `<p style="color: red;">Error al cargar los usuarios: ${error.message}</p>`;
        }
    }

    function mostrarUsuariosEnTabla(users) {
        if (!users || users.length === 0) {
            tableContainer.innerHTML = '<p>No hay usuarios registrados.</p>';
            return;
        }

        let tablaHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(user => {
            tablaHTML += `
                <tr>
                    <td>${user.nombre}</td>
                    <td>${user.email}</td>
                    <td>${user.rol}</td>
                    <td><span class="status-${user.estado}">${user.estado}</span></td>
                    <td>
                        <button class="edit-btn" data-id="${user.id}">Editar</button>
                        <button class="status-btn" data-id="${user.id}">Cambiar Estado</button>
                    </td>
                </tr>
            `;
        });

        tablaHTML += `
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tablaHTML;
    }

    // Iniciar la carga de usuarios solo si estamos en la página correcta
    if (tableContainer) {
        cargarUsuarios();
    }
});