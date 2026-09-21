import { requireRole } from '../auth.js';
import { currentProfessor, currentStudent, one, thesisData } from '../db.js';
import { escapeHtml, isProfessorParticipant, validGradeCount } from './helpers.js';

// Δημιουργεί το πλήρες εκτυπώσιμο HTML του πρακτικού εξέτασης.
function examRecordHtml(thesis) {
  // Το spread ενώνει τον επιβλέποντα με τα δύο μέλη σε μία λίστα επιτροπής.
  const committee = [
    { ...thesis.supervisor, committeeRole: 'Supervisor' },
    ...thesis.members.map((member) => ({ ...member, committeeRole: 'Committee member' })),
  ];

  const rows = committee.map((member) => {
    const grade = thesis.grades.find((item) => item.professorId === member.id);
    const hasCriteria = grade?.criteria && Object.keys(grade.criteria).length;
    const criteria = hasCriteria
      ? `Written ${escapeHtml(grade.criteria.written)} - Presentation ${escapeHtml(grade.criteria.presentation)} - Overall ${escapeHtml(grade.criteria.overall)}`
      : '-';
    return `<tr>
      <td>${escapeHtml(member.fullName)}</td>
      <td>${member.committeeRole}</td>
      <td>${criteria}</td>
      <td>${escapeHtml(grade?.value ?? '-')}</td>
      <td>${escapeHtml(grade?.comments ?? '')}</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Examination record - ThesisFlow</title>
  <link rel="stylesheet" href="/static/css/app.css?v=20260920-1">
</head>
<body>
  <main class="content">
    <article class="record">
      <div class="record-actions"><button id="print-record" class="button button-secondary">Print / PDF</button></div>
      <header><p class="eyebrow">Thesis examination record</p><h1>${escapeHtml(thesis.topic.title)}</h1></header>
      <dl class="details-grid">
        <div><dt>Student</dt><dd>${escapeHtml(thesis.student.fullName)} (${escapeHtml(thesis.student.am)})</dd></div>
        <div><dt>Supervisor</dt><dd>${escapeHtml(thesis.supervisor.fullName)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(thesis.status)}</dd></div>
        <div><dt>Date</dt><dd>${escapeHtml(thesis.presentation?.date ?? '-')}</dd></div>
      </dl>
      <h2>Committee and grades</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Role</th><th>Criteria</th><th>Grade</th><th>Comments</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><th colspan="3">Final grade</th><th colspan="2">${escapeHtml(thesis.finalGrade ?? '-')}</th></tr></tfoot>
        </table>
      </div>
    </article>
  </main>
  <script type="module" src="/static/js/exam-record.js?v=20260920-1"></script>
</body>
</html>`;
}

// Ελέγχει πρόσβαση και επιστρέφει πρακτικό μόνο όταν υπάρχουν τρεις βαθμοί.
function showExamRecord(req, res) {
  // Βρίσκει τη διπλωματική που ζητήθηκε στο URL.
  const thesis = one('SELECT * FROM Thesis WHERE id = ?', req.params.id);
  if (!thesis) return res.status(404).json({ error: 'Thesis not found.' });

  if (req.user.role === 'STUDENT') {
    const student = currentStudent(req.user.id);
    if (!student || student.id !== thesis.studentId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }
  if (req.user.role === 'PROFESSOR') {
    const professor = currentProfessor(req.user.id);
    if (!professor || !isProfessorParticipant(thesis.id, professor.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }

  if (validGradeCount(thesis.id) !== 3) {
    return res.status(409).json({ error: 'The examination record requires three valid grades.' });
  }
  return res.type('html').send(examRecordHtml(thesisData(thesis.id)));
}

// Συνδέει το URL του πρακτικού με έλεγχο ρόλου και τον handler.
export function registerExamRecordRoute(app) {
  app.get(
    '/api/theses/:id/exam-record',
    requireRole('PROFESSOR', 'STUDENT', 'SECRETARIAT'),
    showExamRecord,
  );
}
