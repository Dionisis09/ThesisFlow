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
  let payload;
  if (contentType.includes('json')) {
    payload = await response.json().catch(() => ({}));
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    let message = payload;
    if (typeof payload === 'object') message = payload.error;
    throw new Error(message || `Σφάλμα ${response.status}`);
  }
  return payload;
}
