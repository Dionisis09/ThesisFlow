import { renderAdmin } from './secretariat.js?v=20260920-1';
import { renderProfessor } from './professor.js?v=20260920-1';
import { renderStudent } from './student.js?v=20260920-1';
import { showMessage } from './ui.js?v=20260920-1';

const workspace = document.querySelector('#workspace');
const page = workspace?.dataset.page || '';

for (const link of document.querySelectorAll('.sidebar a')) {
  if (link.pathname === window.location.pathname) link.setAttribute('aria-current', 'page');
}

// The page key selects the renderer for the current user role.
async function start() {
  if (page.startsWith('student-')) return renderStudent(page);
  if (page.startsWith('prof-')) return renderProfessor(page);
  if (page.startsWith('admin-')) return renderAdmin(page);
  throw new Error('Άγνωστη σελίδα.');
}

start().catch((error) => {
  document.querySelector('#page-content').innerHTML = '';
  showMessage(error.message || 'Παρουσιάστηκε απρόσμενο σφάλμα.', 'error');
});
