const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

// Κοινό σημείο σύνδεσης frontend → backend για όλα τα JSON requests.
export async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();
  let body = options.body;

  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    // Τα απλά αντικείμενα JavaScript μετατρέπονται σε JSON πριν σταλούν.
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Οι ενέργειες που αλλάζουν δεδομένα στέλνουν το CSRF token της σελίδας.
    headers.set('X-CSRF-Token', csrfToken);
  }

  // Εκτελεί το HTTP request προς το αντίστοιχο route του backend.
  const response = await fetch(url, { ...options, method, body, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'object' ? payload.error : payload;
    throw new Error(message || `Σφάλμα ${response.status}`);
  }
  return payload;
}
