document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error en el servidor.');
        }
        
        // Si el login es exitoso, guardamos la info del usuario en el navegador
        localStorage.setItem('userInfo', JSON.stringify(data.user));
        alert('¡Bienvenido!');
        
        // Redirigir según el menú principal que usamos
        window.location.href = '/logistica-menu.html';

    } catch (error) {
        errorMessage.textContent = error.message;
    }
});