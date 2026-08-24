import { api } from './api.js';
import { clearMessage, dashboardCard, dashboardHero, empty, escapeHtml, formatDate, showMessage, statusBadge, toLocalInput } from './ui.js';

const content = () => document.querySelector('#page-content');

function dashboard() {
  const cards = [
    { href: '/student/thesis', icon: 'ΔΕ', title: 'Η διπλωματική μου', description: 'Κατάσταση, επιτροπή, βαθμοί και ιστορικό.', tone: 'blue' },
    { href: '/student/invitations', icon: 'ΤΜ', title: 'Τριμελής επιτροπή', description: 'Επιλογή διδασκόντων και πορεία προσκλήσεων.', tone: 'violet' },
    { href: '/student/upload', icon: 'ΑΡ', title: 'Αρχεία και σύνδεσμοι', description: 'Πρόχειρο κείμενο και υποστηρικτικό υλικό.', tone: 'green' },
    { href: '/student/presentation', icon: 'ΠΡ', title: 'Παρουσίαση', description: 'Ημερομηνία, αίθουσα ή τηλεδιάσκεψη.', tone: 'amber' },
    { href: '/student/profile', icon: 'ΠΦ', title: 'Προφίλ', description: 'Στοιχεία επικοινωνίας και προσωπικά δεδομένα.', tone: 'slate' },
  ];
  content().innerHTML = `
    ${dashboardHero('Χώρος φοιτητή', 'Η διπλωματική σου, οργανωμένη.', 'Βρες γρήγορα την κατάσταση, την επιτροπή, τα αρχεία και την παρουσίασή σου.')}
    <div class="dashboard-section-title"><div><p class="eyebrow">Γρήγορη πρόσβαση</p><h2>Οι βασικές ενέργειες</h2></div><span>${cards.length} επιλογές</span></div>
    <div class="grid dashboard-grid">${cards.map(dashboardCard).join('')}</div>`;
}

function gradeRows(thesis) {
  if (!thesis.grades?.length) return empty('Δεν έχουν καταχωριστεί βαθμοί.');
  return `<div class="table-wrap"><table>
    <thead><tr><th>Διδάσκων</th><th>Κριτήρια</th><th>Βαθμός</th><th>Σχόλια</th></tr></thead>
    <tbody>${thesis.grades.map((grade) => `<tr>
      <td>${escapeHtml(grade.professor.fullName)}</td>
      <td>${Object.keys(grade.criteria || {}).length ? `Γραπτό ${escapeHtml(grade.criteria.written)} · Παρουσίαση ${escapeHtml(grade.criteria.presentation)} · Σύνολο ${escapeHtml(grade.criteria.overall)}` : '—'}</td>
      <td>${escapeHtml(grade.value)}</td>
      <td>${escapeHtml(grade.comments || '—')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function studentThesis() {
  const data = await api('/api/student/thesis');
  if (!data.thesis) {
    content().innerHTML = empty('Δεν έχει γίνει ακόμη αρχική ανάθεση θέματος.');
    return;
  }
  const thesis = data.thesis;
  const members = [thesis.supervisor, ...(thesis.members || [])];
  const history = thesis.history?.length
    ? `<ul class="timeline">${thesis.history.map((item) => `<li><strong>${escapeHtml(item.toStatus)}</strong><br><span class="muted small">${formatDate(item.createdAt)} · ${escapeHtml(item.note || '')}</span></li>`).join('')}</ul>`
    : empty('Δεν υπάρχουν ακόμη καταγεγραμμένες μεταβάσεις.');
  const materials = thesis.materials?.length
    ? `<ul>${thesis.materials.map((item) => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a></li>`).join('')}</ul>`
    : '<span class="muted">—</span>';
  const repositoryForm = thesis.status === 'UNDER_EXAM' && thesis.grades?.filter((item) => item.value >= 0 && item.value <= 10).length === 3 && !thesis.finalRepositoryUrl
    ? `<form id="repository-form" class="inline section"><input class="compact-input" name="url" type="url" placeholder="Σύνδεσμος Νημερτή" required><button class="button button-primary">Καταχώριση τελικού κειμένου</button></form>`
    : '';

  content().innerHTML = `
    <section class="card">
      <div class="split"><div><h2>${escapeHtml(thesis.topic.title)}</h2><p class="topic-summary">${escapeHtml(thesis.topic.summary)}</p></div>${statusBadge(thesis.status)}</div>
      <dl class="details-grid section">
        <div><dt>Φοιτητής</dt><dd>${escapeHtml(data.student.fullName)}</dd></div>
        <div><dt>Επιβλέπων</dt><dd>${escapeHtml(thesis.supervisor.fullName)}</dd></div>
        <div><dt>Οριστική ανάθεση</dt><dd>${formatDate(thesis.officialAssignedAt)}<br><span class="muted small">${escapeHtml(thesis.elapsedDays)} ημέρες</span></dd></div>
        <div><dt>Τελικός βαθμός</dt><dd>${thesis.finalGrade ?? '—'}</dd></div>
        <div><dt>Πρόχειρο</dt><dd>${thesis.draftUrl ? `<a href="${escapeHtml(thesis.draftUrl)}" target="_blank">Προβολή PDF</a>` : '—'}</dd></div>
        <div><dt>Τελικό κείμενο</dt><dd>${thesis.finalRepositoryUrl ? `<a href="${escapeHtml(thesis.finalRepositoryUrl)}" target="_blank" rel="noreferrer">Νημερτής</a>` : '—'}</dd></div>
      </dl>
      ${repositoryForm}
    </section>
    <section class="grid grid-2 section">
      <div class="card"><h2 class="section-heading">Τριμελής επιτροπή</h2><ul>${members.map((member, index) => `<li>${escapeHtml(member.fullName)} ${index === 0 ? '(επιβλέπων)' : ''}</li>`).join('')}</ul></div>
      <div class="card"><h2 class="section-heading">Παρουσίαση</h2>${thesis.presentation ? `<p><strong>${formatDate(thesis.presentation.date)}</strong></p><p>${escapeHtml(thesis.presentation.mode === 'ONLINE' ? 'Διαδικτυακά' : thesis.presentation.room)}</p>` : '<p class="muted">Δεν έχουν οριστεί στοιχεία.</p>'}</div>
    </section>
    <section class="card section"><h2 class="section-heading">Βαθμολογία</h2>${gradeRows(thesis)}${thesis.grades?.length ? `<p class="section"><a href="/api/theses/${escapeHtml(thesis.id)}/exam-record" target="_blank">Πρακτικό εξέτασης</a></p>` : ''}</section>
    <section class="grid grid-2 section">
      <div class="card"><h2 class="section-heading">Ιστορικό</h2>${history}</div>
      <div class="card"><h2 class="section-heading">Υποστηρικτικό υλικό</h2>${materials}</div>
    </section>`;

  document.querySelector('#repository-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();
    try {
      await api('/api/student/final-repository', { method: 'POST', body: { url: event.currentTarget.url.value } });
      showMessage('Ο σύνδεσμος τελικού κειμένου αποθηκεύτηκε.');
      await studentThesis();
    } catch (error) { showMessage(error.message, 'error'); }
  });
}

async function profile() {
  const data = await api('/api/student/profile');
  content().innerHTML = `<form id="profile-form" class="card form-grid">
    <label class="full">Πλήρης ταχυδρομική διεύθυνση<textarea name="address">${escapeHtml(data.address)}</textarea></label>
    <label>Email επικοινωνίας<input name="email" type="email" value="${escapeHtml(data.email)}" required></label>
    <label>Κινητό τηλέφωνο<input name="mobile" value="${escapeHtml(data.mobile)}"></label>
    <label>Σταθερό τηλέφωνο<input name="landline" value="${escapeHtml(data.landline)}"></label>
    <div class="full"><button class="button button-primary">Αποθήκευση</button></div>
  </form>`;
  document.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api('/api/student/profile', { method: 'PATCH', body: {
        address: form.address.value, email: form.email.value, mobile: form.mobile.value, landline: form.landline.value,
      }});
      showMessage('Το προφίλ ενημερώθηκε.');
    } catch (error) { showMessage(error.message, 'error'); }
  });
}

async function invitations() {
  const [thesisData, professorData, invitationData] = await Promise.all([
    api('/api/student/thesis'), api('/api/profs/list'), api('/api/committee/invitations'),
  ]);
  if (!thesisData.thesis) {
    content().innerHTML = empty('Χρειάζεται πρώτα αρχική ανάθεση θέματος από διδάσκοντα.');
    return;
  }
  const thesis = thesisData.thesis;
  const invitedIds = new Set((invitationData.items || []).filter((item) => item.status === 'ACCEPTED').map((item) => item.professor.id));
  const choices = professorData.items.filter((professor) => professor.id !== thesis.supervisor.id && !invitedIds.has(professor.id));
  const canInvite = thesis.status === 'UNDER_ASSIGNMENT';
  content().innerHTML = `
    <section class="card">
      <div class="split"><h2>Επιλογή διδασκόντων</h2>${statusBadge(thesis.status)}</div>
      ${canInvite ? `<form id="invite-form" class="stack">
        <div class="grid grid-2">${choices.map((professor) => `<label class="card"><span><input type="checkbox" name="codes" value="${escapeHtml(professor.code)}" style="width:auto"> ${escapeHtml(professor.fullName)} (${escapeHtml(professor.code)})</span></label>`).join('')}</div>
        <div><button class="button button-primary">Αποστολή προσκλήσεων</button></div>
      </form>` : '<p class="muted">Η τριμελής έχει οριστικοποιηθεί.</p>'}
    </section>
    <section class="section"><h2 class="section-heading">Πορεία προσκλήσεων</h2>
      ${(invitationData.items || []).length ? invitationData.items.map((item) => `<article class="card split"><span>${escapeHtml(item.professor.fullName)} (${escapeHtml(item.professor.code)})<br><span class="muted small">Αποστολή: ${formatDate(item.createdAt)} · Απάντηση: ${formatDate(item.respondedAt)}</span></span><strong>${escapeHtml(item.status)}</strong></article>`).join('') : empty('Δεν υπάρχουν προσκλήσεις.')}
    </section>`;
  document.querySelector('#invite-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const codes = [...event.currentTarget.querySelectorAll('input[name="codes"]:checked')].map((node) => node.value);
    try {
      await api('/api/committee/invitations', { method: 'POST', body: { professorCodes: codes } });
      showMessage('Οι προσκλήσεις στάλθηκαν.');
      await invitations();
    } catch (error) { showMessage(error.message, 'error'); }
  });
}

async function upload() {
  const { thesis } = await api('/api/student/thesis');
  if (!thesis) { content().innerHTML = empty('Δεν υπάρχει διπλωματική.'); return; }
  content().innerHTML = `
    <div class="grid grid-2">
      <form id="draft-form" class="card stack">
        <h2>Πρόχειρο κείμενο</h2>
        <p class="muted small">Έγκυρο PDF έως 16 MB. Επιτρέπεται σε ενεργή ή υπό εξέταση διπλωματική.</p>
        <input name="file" type="file" accept="application/pdf" required>
        <button class="button button-primary">Ανέβασμα PDF</button>
        ${thesis.draftUrl ? `<a href="${escapeHtml(thesis.draftUrl)}" target="_blank">Τρέχον πρόχειρο</a>` : ''}
      </form>
      <form id="material-form" class="card stack">
        <h2>Υποστηρικτικό υλικό</h2>
        <label>Περιγραφή<input name="label" placeholder="π.χ. Κώδικας εφαρμογής" required></label>
        <label>Σύνδεσμος<input name="url" type="url" placeholder="https://…" required></label>
        <button class="button button-primary">Προσθήκη συνδέσμου</button>
      </form>
    </div>`;
  document.querySelector('#draft-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData();
    data.append('file', form.file.files[0]);
    try { await api('/api/upload/thesis-draft', { method: 'POST', body: data }); showMessage('Το PDF ανέβηκε επιτυχώς.'); await upload(); }
    catch (error) { showMessage(error.message, 'error'); }
  });
  document.querySelector('#material-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try { await api('/api/student/materials', { method: 'POST', body: { label: form.label.value, url: form.url.value } }); showMessage('Ο σύνδεσμος προστέθηκε.'); form.reset(); }
    catch (error) { showMessage(error.message, 'error'); }
  });
}

async function presentation() {
  const { thesis } = await api('/api/student/thesis');
  if (!thesis) { content().innerHTML = empty('Δεν υπάρχει διπλωματική.'); return; }
  const item = thesis.presentation || {};
  content().innerHTML = `<form id="presentation-form" class="card form-grid">
    <label>Ημερομηνία και ώρα<input name="date" type="datetime-local" value="${toLocalInput(item.date)}" required></label>
    <label>Τρόπος παρουσίασης<select name="mode"><option value="IN_PERSON" ${item.mode !== 'ONLINE' ? 'selected' : ''}>Δια ζώσης</option><option value="ONLINE" ${item.mode === 'ONLINE' ? 'selected' : ''}>Διαδικτυακά</option></select></label>
    <label class="full">Τίτλος ανακοίνωσης<input name="title" value="${escapeHtml(item.title || `Παρουσίαση: ${thesis.topic.title}`)}" required></label>
    <label id="room-field">Αίθουσα<input name="room" value="${escapeHtml(item.room || '')}"></label>
    <label id="meeting-field">Σύνδεσμος τηλεδιάσκεψης<input name="meetingUrl" type="url" value="${escapeHtml(item.meetingUrl || '')}"></label>
    <div class="full"><button class="button button-primary">Αποθήκευση</button></div>
  </form>`;
  const form = document.querySelector('#presentation-form');
  const syncMode = () => {
    document.querySelector('#room-field').hidden = form.mode.value === 'ONLINE';
    document.querySelector('#meeting-field').hidden = form.mode.value !== 'ONLINE';
  };
  form.mode.addEventListener('change', syncMode); syncMode();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/student/presentation', { method: 'POST', body: {
        date: form.date.value, mode: form.mode.value, title: form.title.value,
        room: form.room.value, meetingUrl: form.meetingUrl.value,
      }});
      showMessage('Τα στοιχεία παρουσίασης αποθηκεύτηκαν.');
    } catch (error) { showMessage(error.message, 'error'); }
  });
}

export async function renderStudent(page) {
  const renderers = {
    'student-dashboard': dashboard,
    'student-thesis': studentThesis,
    'student-profile': profile,
    'student-invitations': invitations,
    'student-upload': upload,
    'student-presentation': presentation,
  };
  return renderers[page]();
}
