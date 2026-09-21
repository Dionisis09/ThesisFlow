const form = document.querySelector('#login-form');
const errorNode = document.querySelector('#login-error');

// Στέλνει τα στοιχεία σύνδεσης στο backend και μεταφέρει τον χρήστη στη σελίδα του ρόλου του.
async function submitLogin(event) {
  event.preventDefault();
  errorNode.hidden = true;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    // POST: στέλνει email και password στο /api/auth/login.
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email.value.trim(),
        password: form.password.value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Η σύνδεση απέτυχε.');
    window.location.assign(data.redirect || '/');
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  } finally {
    button.disabled = false;
  }
}

form?.addEventListener('submit', submitLogin);
