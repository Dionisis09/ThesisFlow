import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { requireRole } from './auth.js';
import {
  addHistory, all, currentProfessor, currentStudent, datetimeToMs, isHttpUrl, msToIso,
  newId, nowMs, one, participatedThesisIds, professorData, run, thesisData, transaction,
} from './db.js';
import { roleHome } from './pages.js';

const STATUSES = ['UNDER_ASSIGNMENT', 'ACTIVE', 'UNDER_EXAM', 'COMPLETED', 'CANCELED'];
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function text(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function average(values, digits) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(digits));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character]);
}

// Validate the PDF signature before storing the upload.
function savePdf(file, uploadFolder) {
  if (!file || file.buffer.subarray(0, 5).toString() !== '%PDF-') return null;
  const filename = `${newId()}.pdf`;
  fs.writeFileSync(path.join(uploadFolder, filename), file.buffer);
  return `/uploads/${filename}`;
}

function validParticipant(thesisId, professorId) {
  return Boolean(one(`
    SELECT Thesis.id FROM Thesis
    LEFT JOIN CommitteeMember ON CommitteeMember.thesisId = Thesis.id
    WHERE Thesis.id = ? AND (Thesis.supervisorId = ? OR CommitteeMember.professorId = ?)
    LIMIT 1
  `, thesisId, professorId, professorId));
}

function csvEscape(value) {
  const raw = String(value ?? '');
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

// Accept both padded and compact professor codes, for example P002 and P2.
function normalizeCodes(rawCodes) {
  if (!Array.isArray(rawCodes)) return [];
  const result = [];
  for (const raw of rawCodes) {
    const code = text(raw).toUpperCase();
    if (!code) continue;
    result.push(code);
    const match = code.match(/^([A-Z]+)0+(\d+)$/);
    if (match) result.push(`${match[1]}${match[2]}`);
  }
  return [...new Set(result)];
}

function statsFor(ids) {
  const theses = ids.map((id) => thesisData(id));
  const completed = theses.filter((item) => item.status === 'COMPLETED');
  const grades = completed.flatMap((item) => item.grades.map((grade) => Number(grade.value)))
    .filter((value) => value >= 0 && value <= 10);
  const durations = completed.map((item) => {
    const raw = one('SELECT createdAt, officialAssignedAt, updatedAt FROM Thesis WHERE id = ?', item.id);
    const presentation = one('SELECT date FROM PresentationDetails WHERE thesisId = ?', item.id);
    const start = datetimeToMs(raw.officialAssignedAt) ?? datetimeToMs(raw.createdAt);
    const end = datetimeToMs(presentation?.date) ?? datetimeToMs(raw.updatedAt);
    return (end - start) / 86_400_000;
  }).filter((value) => Number.isFinite(value) && value >= 0);
  return {
    total: theses.length,
    averageGrade: average(grades, 2),
    averageCompletionDays: average(durations, 1),
    counts: Object.fromEntries(STATUSES.map((status) => [status, theses.filter((item) => item.status === status).length])),
  };
}

function examRecordHtml(thesis) {
  const committee = [
    { ...thesis.supervisor, committeeRole: 'Supervisor' },
    ...thesis.members.map((member) => ({ ...member, committeeRole: 'Committee member' })),
  ];
  const rows = committee.map((member) => {
    const grade = thesis.grades.find((item) => item.professorId === member.id);
    const criteria = grade?.criteria && Object.keys(grade.criteria).length
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
  <link rel="stylesheet" href="/static/css/app.css">
</head>
<body>
  <main class="content">
    <article class="record">
      <div class="record-actions"><button class="button button-secondary" onclick="window.print()">Print / PDF</button></div>
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
</body>
</html>`;
}

export function registerRoutes(app, upload, uploadFolder) {
  // Authentication and public presentation feed.
  app.post('/api/auth/login', async (req, res) => {
    const email = text(req.body?.email).toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) return res.status(400).json({ error: 'Invalid request.' });
    const user = one('SELECT * FROM User WHERE email = ?', email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid request.' });
    }
    req.session.regenerate((error) => {
      if (error) return res.status(500).json({ error: 'Invalid request.' });
      req.session.userId = user.id;
      req.session.csrfToken = newId();
      res.json({ redirect: roleHome(user.role) });
    });
  });

  app.get('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/auth/login'));
  });

  app.get('/api/public/presentations', (req, res) => {
    const fromMs = req.query.from ? datetimeToMs(req.query.from) : null;
    const toMs = req.query.to ? datetimeToMs(req.query.to) : null;
    if (req.query.from && fromMs === null) return res.status(400).json({ error: 'Invalid request.' });
    if (req.query.to && toMs === null) return res.status(400).json({ error: 'Invalid request.' });
    const conditions = [];
    const params = [];
    if (fromMs !== null) {
      conditions.push('PresentationDetails.date >= ?');
      params.push(fromMs);
    }
    if (toMs !== null) {
      conditions.push('PresentationDetails.date <= ?');
      params.push(toMs);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = all(`
      SELECT PresentationDetails.*, Thesis.id AS thesisId, Student.am, Student.firstName AS studentFirst,
             Student.lastName AS studentLast, Topic.title AS topicTitle,
             Professor.firstName AS supervisorFirst, Professor.lastName AS supervisorLast
      FROM PresentationDetails
      JOIN Thesis ON Thesis.id = PresentationDetails.thesisId
      JOIN Student ON Student.id = Thesis.studentId
      JOIN Topic ON Topic.id = Thesis.topicId
      JOIN Professor ON Professor.id = Thesis.supervisorId
      ${where} ORDER BY PresentationDetails.date
    `, ...params).map((item) => ({
      id: item.id,
      date: msToIso(item.date),
      room: item.room,
      mode: item.mode,
      meetingUrl: item.meetingUrl,
      title: item.title,
      student: `${item.studentFirst} ${item.studentLast}`,
      studentAm: item.am,
      topic: item.topicTitle,
      supervisor: `${item.supervisorFirst} ${item.supervisorLast}`,
    }));
    res.set('Cache-Control', 'public, max-age=60');
    if (String(req.query.format || 'json').toLowerCase() !== 'xml') return res.json({ items });
    const nodes = items.map((item) => {
      const fields = Object.entries(item)
        .filter(([key]) => key !== 'id')
        .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
        .join('');
      return `<presentation id="${escapeXml(item.id)}">${fields}</presentation>`;
    }).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?><presentations>${nodes}</presentations>`);
  });

  // Student profile, committee, files and presentation details.
  app.get('/api/student/thesis', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Invalid request.' });
    const thesis = one('SELECT id FROM Thesis WHERE studentId = ?', student.id);
    res.json({
      student: { id: student.id, am: student.am, firstName: student.firstName, lastName: student.lastName, fullName: `${student.firstName} ${student.lastName}` },
      thesis: thesis ? thesisData(thesis.id) : null,
    });
  });

  app.get('/api/student/profile', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Invalid request.' });
    res.json({ address: student.address || '', email: student.email, mobile: student.mobile || '', landline: student.landline || '' });
  });

  app.patch('/api/student/profile', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Invalid request.' });
    const email = text(req.body?.email, student.email).toLowerCase();
    if (!email || !email.includes('@') || email.length > 254) return res.status(400).json({ error: 'Invalid request.' });
    const existing = one('SELECT id FROM User WHERE email = ?', email);
    if (existing && existing.id !== student.userId) return res.status(409).json({ error: 'Invalid request.' });
    transaction(() => {
      run('UPDATE Student SET address = ?, mobile = ?, landline = ? WHERE id = ?', text(req.body?.address, student.address).slice(0, 500), text(req.body?.mobile, student.mobile).slice(0, 30), text(req.body?.landline, student.landline).slice(0, 30), student.id);
      run('UPDATE User SET email = ? WHERE id = ?', email, student.userId);
    });
    res.json({ ok: true });
  });

  app.get('/api/profs/list', requireRole('STUDENT', 'PROFESSOR', 'SECRETARIAT'), (_req, res) => {
    res.json({ items: all('SELECT * FROM Professor ORDER BY code').map(professorData) });
  });

  app.post('/api/committee/invitations', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
    if (thesis.status !== 'UNDER_ASSIGNMENT') return res.status(409).json({ error: 'Invalid request.' });
    const codes = normalizeCodes(req.body?.professorCodes);
    if (!codes.length) return res.status(400).json({ error: 'Invalid request.' });
    const placeholders = codes.map(() => '?').join(',');
    const professors = all(`SELECT * FROM Professor WHERE code IN (${placeholders})`, ...codes)
      .filter((professor) => professor.id !== thesis.supervisorId);
    if (!professors.length) return res.status(400).json({ error: 'Invalid request.' });
    const created = transaction(() => professors.flatMap((professor) => {
      const invitation = one('SELECT * FROM CommitteeInvitation WHERE thesisId = ? AND professorId = ?', thesis.id, professor.id);
      if (invitation?.status === 'ACCEPTED') return [];
      const id = invitation?.id || newId();
      if (invitation) run('UPDATE CommitteeInvitation SET status = ?, createdAt = ?, respondedAt = NULL WHERE id = ?', 'PENDING', nowMs(), id);
      else run('INSERT INTO CommitteeInvitation (id, thesisId, professorId, status, createdAt, respondedAt) VALUES (?, ?, ?, ?, ?, NULL)', id, thesis.id, professor.id, 'PENDING', nowMs());
      return [{ id, code: professor.code }];
    }));
    res.status(201).json({ created: created.map((item) => item.id), matchedCodes: created.map((item) => item.code) });
  });

  app.post('/api/upload/thesis-draft', requireRole('STUDENT'), upload.single('file'), (req, res) => {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
    if (thesis.status !== 'UNDER_EXAM') return res.status(409).json({ error: 'Thesis must be under examination.' });
    const url = savePdf(req.file, uploadFolder);
    if (!url) return res.status(400).json({ error: 'Invalid request.' });
    run('UPDATE Thesis SET draftUrl = ?, updatedAt = ? WHERE id = ?', url, nowMs(), thesis.id);
    res.json({ url });
  });

  app.post('/api/student/materials', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
    if (thesis.status !== 'UNDER_EXAM') return res.status(409).json({ error: 'Thesis must be under examination.' });
    const label = text(req.body?.label);
    const url = text(req.body?.url);
    if (!label || label.length > 120 || !isHttpUrl(url)) return res.status(400).json({ error: 'Invalid request.' });
    const id = newId();
    run('INSERT INTO ThesisMaterial (id, thesisId, label, url, createdAt) VALUES (?, ?, ?, ?, ?)', id, thesis.id, label, url, nowMs());
    res.status(201).json({ id });
  });

  app.post('/api/student/presentation', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
    if (thesis.status !== 'UNDER_EXAM') return res.status(409).json({ error: 'Thesis must be under examination.' });
    const date = datetimeToMs(req.body?.date);
    const title = text(req.body?.title);
    const mode = text(req.body?.mode, 'IN_PERSON').toUpperCase();
    const room = text(req.body?.room);
    const meetingUrl = text(req.body?.meetingUrl);
    if (!date || !title) return res.status(400).json({ error: 'Invalid request.' });
    if (!['IN_PERSON', 'ONLINE'].includes(mode)) return res.status(400).json({ error: 'Invalid request.' });
    if (mode === 'IN_PERSON' && !room) return res.status(400).json({ error: 'Invalid request.' });
    if (mode === 'ONLINE' && !isHttpUrl(meetingUrl)) return res.status(400).json({ error: 'Invalid request.' });
    const existing = one('SELECT id FROM PresentationDetails WHERE thesisId = ?', thesis.id);
    const id = existing?.id || newId();
    const shownRoom = mode === 'IN_PERSON' ? room : 'Online';
    if (existing) run('UPDATE PresentationDetails SET date = ?, room = ?, title = ?, mode = ?, meetingUrl = ?, updatedAt = ? WHERE id = ?', date, shownRoom, title, mode, mode === 'ONLINE' ? meetingUrl : null, nowMs(), id);
    else run('INSERT INTO PresentationDetails (id, thesisId, date, room, title, createdAt, updatedAt, mode, meetingUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, thesis.id, date, shownRoom, title, nowMs(), nowMs(), mode, mode === 'ONLINE' ? meetingUrl : null);
    res.json({ id });
  });

  app.post('/api/student/final-repository', requireRole('STUDENT'), (req, res) => {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT * FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.status(400).json({ error: 'Invalid request.' });
    const gradeCount = one('SELECT COUNT(*) AS count FROM Grade WHERE thesisId = ? AND value BETWEEN 0 AND 10', thesis.id).count;
    if (thesis.status !== 'UNDER_EXAM' || gradeCount !== 3) return res.status(409).json({ error: 'Invalid request.' });
    const url = text(req.body?.url);
    if (!isHttpUrl(url)) return res.status(400).json({ error: 'Invalid request.' });
    run('UPDATE Thesis SET finalRepositoryUrl = ?, updatedAt = ? WHERE id = ?', url, nowMs(), thesis.id);
    res.json({ ok: true });
  });

  // Professor topics, assignments, thesis lists and statistics.
  app.get('/api/prof/topics', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.status(404).json({ error: 'Invalid request.' });
    const items = all(`
      SELECT Topic.*, EXISTS(SELECT 1 FROM Thesis WHERE Thesis.topicId = Topic.id) AS assigned
      FROM Topic WHERE Topic.supervisorId = ? ORDER BY Topic.createdAt DESC
    `, professor.id).map((item) => ({
      id: item.id, title: item.title, summary: item.summary, status: item.status,
      descriptionUrl: item.descriptionUrl, assigned: Boolean(item.assigned),
    }));
    res.json({ items });
  });

  app.post('/api/prof/topics', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.status(404).json({ error: 'Invalid request.' });
    const title = text(req.body?.title);
    const summary = text(req.body?.summary);
    if (!title || !summary) return res.status(400).json({ error: 'Invalid request.' });
    if (title.length > 200 || summary.length > 3000) return res.status(400).json({ error: 'Invalid request.' });
    const id = newId();
    run('INSERT INTO Topic (id, title, summary, descriptionUrl, status, supervisorId, createdAt) VALUES (?, ?, ?, NULL, ?, ?, ?)', id, title, summary, 'AVAILABLE', professor.id, nowMs());
    res.status(201).json({ id });
  });

  app.patch('/api/prof/topics/:id', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    const topic = one('SELECT * FROM Topic WHERE id = ?', req.params.id);
    if (!professor || !topic || topic.supervisorId !== professor.id) return res.status(404).json({ error: 'Invalid request.' });
    const assigned = Boolean(one('SELECT id FROM Thesis WHERE topicId = ?', topic.id));
    if (assigned && ['title', 'summary', 'toggle'].some((key) => Object.hasOwn(req.body || {}, key))) return res.status(409).json({ error: 'Invalid request.' });
    let title = topic.title;
    let summary = topic.summary;
    let status = topic.status;
    if (req.body?.toggle) status = status === 'AVAILABLE' ? 'HIDDEN' : 'AVAILABLE';
    if (Object.hasOwn(req.body || {}, 'title')) {
      title = text(req.body.title);
      if (!title) return res.status(400).json({ error: 'Invalid request.' });
    }
    if (Object.hasOwn(req.body || {}, 'summary')) {
      summary = text(req.body.summary);
      if (!summary) return res.status(400).json({ error: 'Invalid request.' });
    }
    run('UPDATE Topic SET title = ?, summary = ?, status = ? WHERE id = ?', title, summary, status, topic.id);
    res.json({ ok: true });
  });

  app.post('/api/upload/topic-description', requireRole('PROFESSOR'), upload.single('file'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    const topic = one('SELECT * FROM Topic WHERE id = ?', text(req.body?.topicId));
    if (!professor || !topic || topic.supervisorId !== professor.id) return res.status(404).json({ error: 'Invalid request.' });
    const url = savePdf(req.file, uploadFolder);
    if (!url) return res.status(400).json({ error: 'Invalid request.' });
    run('UPDATE Topic SET descriptionUrl = ? WHERE id = ?', url, topic.id);
    res.json({ url });
  });

  app.get('/api/prof/assign', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.status(404).json({ error: 'Invalid request.' });
    const query = text(req.query.q);
    const pattern = `%${query}%`;
    const students = query
      ? all(`SELECT Student.* FROM Student LEFT JOIN Thesis ON Thesis.studentId = Student.id WHERE Thesis.id IS NULL AND (Student.am LIKE ? OR Student.firstName LIKE ? OR Student.lastName LIKE ?) ORDER BY Student.am LIMIT 20`, pattern, pattern, pattern)
      : all('SELECT Student.* FROM Student LEFT JOIN Thesis ON Thesis.studentId = Student.id WHERE Thesis.id IS NULL ORDER BY Student.am LIMIT 20');
    const topics = query
      ? all(`SELECT Topic.* FROM Topic LEFT JOIN Thesis ON Thesis.topicId = Topic.id WHERE Topic.supervisorId = ? AND Topic.status = 'AVAILABLE' AND Thesis.id IS NULL AND (Topic.title LIKE ? OR Topic.summary LIKE ?) ORDER BY Topic.createdAt DESC LIMIT 20`, professor.id, pattern, pattern)
      : all(`SELECT Topic.* FROM Topic LEFT JOIN Thesis ON Thesis.topicId = Topic.id WHERE Topic.supervisorId = ? AND Topic.status = 'AVAILABLE' AND Thesis.id IS NULL ORDER BY Topic.createdAt DESC LIMIT 20`, professor.id);
    res.json({
      students: students.map((item) => ({ id: item.id, am: item.am, firstName: item.firstName, lastName: item.lastName })),
      topics: topics.map((item) => ({ id: item.id, title: item.title, summary: item.summary })),
    });
  });

  app.post('/api/prof/assign', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    const student = one('SELECT * FROM Student WHERE id = ?', text(req.body?.studentId));
    const topic = one('SELECT * FROM Topic WHERE id = ?', text(req.body?.topicId));
    if (!student || one('SELECT id FROM Thesis WHERE studentId = ?', student?.id)) return res.status(400).json({ error: 'Invalid request.' });
    if (!professor || !topic || topic.supervisorId !== professor.id || topic.status !== 'AVAILABLE' || one('SELECT id FROM Thesis WHERE topicId = ?', topic?.id)) return res.status(400).json({ error: 'Invalid request.' });
    const id = newId();
    try {
      transaction(() => {
        run('INSERT INTO Thesis (id, studentId, supervisorId, topicId, status, createdAt, updatedAt, gradingOpen) VALUES (?, ?, ?, ?, ?, ?, ?, 0)', id, student.id, professor.id, topic.id, 'UNDER_ASSIGNMENT', nowMs(), nowMs());
        addHistory(id, null, 'UNDER_ASSIGNMENT', req.user.id, 'Initial assignment by supervisor.');
      });
    } catch {
      return res.status(409).json({ error: 'Invalid request.' });
    }
    res.status(201).json({ ok: true, id });
  });

  app.get('/api/prof/theses', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.json({ items: [] });
    let items = participatedThesisIds(professor.id).map((id) => thesisData(id, professor.id));
    const status = text(req.query.status, 'ALL');
    const role = text(req.query.role, 'ALL');
    if (status !== 'ALL') items = items.filter((item) => item.status === status);
    if (role !== 'ALL') items = items.filter((item) => item.role === role);
    res.json({ items });
  });

  function professorExportRows(professorId) {
    return participatedThesisIds(professorId).map((id) => {
      const thesis = thesisData(id, professorId, false);
      return {
        id: thesis.id, status: thesis.status, role: thesis.role,
        student_am: thesis.student.am, student_name: thesis.student.fullName, topic_title: thesis.topic.title,
      };
    });
  }

  app.get('/api/prof/theses/export', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.status(404).json({ error: 'Invalid request.' });
    const rows = professorExportRows(professor.id);
    const columns = ['id', 'status', 'role', 'student_am', 'student_name', 'topic_title'];
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n');
    res.set('Content-Disposition', 'attachment; filename="theses.csv"').type('text/csv').send(csv);
  });

  app.get('/api/prof/theses/export.json', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.status(404).json({ error: 'Invalid request.' });
    res.json({ items: participatedThesisIds(professor.id).map((id) => thesisData(id, professor.id)) });
  });

  app.get('/api/prof/stats', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.status(404).json({ error: 'Invalid request.' });
    const supervised = all('SELECT id FROM Thesis WHERE supervisorId = ?', professor.id).map((row) => row.id);
    const committee = all(`SELECT Thesis.id FROM Thesis JOIN CommitteeMember ON CommitteeMember.thesisId = Thesis.id WHERE CommitteeMember.professorId = ? AND Thesis.supervisorId <> ?`, professor.id, professor.id).map((row) => row.id);
    res.json({ supervised: statsFor(supervised), committee: statsFor(committee) });
  });

  // Committee invitations are read by students and answered by professors.
  app.get('/api/committee/invitations', requireRole('PROFESSOR', 'STUDENT'), (req, res) => {
    if (req.user.role === 'STUDENT') {
      const student = currentStudent(req.user.id);
      const thesis = student ? one('SELECT id FROM Thesis WHERE studentId = ?', student.id) : null;
      if (!thesis) return res.json({ items: [] });
      const items = all(`
        SELECT CommitteeInvitation.*, Professor.code, Professor.firstName, Professor.lastName
        FROM CommitteeInvitation JOIN Professor ON Professor.id = CommitteeInvitation.professorId
        WHERE CommitteeInvitation.thesisId = ? ORDER BY CommitteeInvitation.createdAt DESC
      `, thesis.id).map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt, respondedAt: item.respondedAt, professor: professorData(item) }));
      return res.json({ items });
    }
    const professor = currentProfessor(req.user.id);
    if (!professor) return res.json({ items: [] });
    const items = all(`
      SELECT CommitteeInvitation.*, Topic.title AS topic, Student.firstName AS studentFirst,
             Student.lastName AS studentLast, Supervisor.firstName AS supervisorFirst, Supervisor.lastName AS supervisorLast
      FROM CommitteeInvitation
      JOIN Thesis ON Thesis.id = CommitteeInvitation.thesisId
      JOIN Topic ON Topic.id = Thesis.topicId
      JOIN Student ON Student.id = Thesis.studentId
      JOIN Professor AS Supervisor ON Supervisor.id = Thesis.supervisorId
      WHERE CommitteeInvitation.professorId = ? AND CommitteeInvitation.status = 'PENDING'
      ORDER BY CommitteeInvitation.createdAt DESC
    `, professor.id).map((item) => ({
      id: item.id, status: item.status, createdAt: item.createdAt, thesisId: item.thesisId,
      topic: item.topic, student: `${item.studentFirst} ${item.studentLast}`,
      supervisor: `${item.supervisorFirst} ${item.supervisorLast}`,
    }));
    res.json({ items });
  });

  app.patch('/api/committee/invitations', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    const invitation = one('SELECT * FROM CommitteeInvitation WHERE id = ?', text(req.body?.id));
    if (!professor || !invitation || invitation.professorId !== professor.id) return res.status(404).json({ error: 'Invalid request.' });
    if (invitation.status !== 'PENDING') return res.status(409).json({ error: 'Invalid request.' });
    const thesis = one('SELECT * FROM Thesis WHERE id = ?', invitation.thesisId);
    if (thesis.status !== 'UNDER_ASSIGNMENT') return res.status(409).json({ error: 'Invalid request.' });
    const action = text(req.body?.action);
    if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid request.' });
    if (action === 'decline') {
      run('UPDATE CommitteeInvitation SET status = ?, respondedAt = ? WHERE id = ?', 'DECLINED', nowMs(), invitation.id);
      return res.json({ ok: true });
    }
    const count = one('SELECT COUNT(*) AS count FROM CommitteeMember WHERE thesisId = ?', thesis.id).count;
    if (count >= 2) {
      run('UPDATE CommitteeInvitation SET status = ?, respondedAt = ? WHERE id = ?', 'DECLINED', nowMs(), invitation.id);
      return res.status(409).json({ error: 'Invalid request.' });
    }
    try {
      transaction(() => {
        run('UPDATE CommitteeInvitation SET status = ?, respondedAt = ? WHERE id = ?', 'ACCEPTED', nowMs(), invitation.id);
        run('INSERT INTO CommitteeMember (id, thesisId, professorId, role, createdAt) VALUES (?, ?, ?, ?, ?)', newId(), thesis.id, professor.id, count === 0 ? 'MEMBER1' : 'MEMBER2', nowMs());
        if (count + 1 === 2) {
          run('UPDATE Thesis SET status = ?, updatedAt = ? WHERE id = ?', 'ACTIVE', nowMs(), thesis.id);
          run(`UPDATE CommitteeInvitation SET status = 'DECLINED', respondedAt = ? WHERE thesisId = ? AND id <> ? AND status = 'PENDING'`, nowMs(), thesis.id, invitation.id);
          addHistory(thesis.id, thesis.status, 'ACTIVE', req.user.id, 'The three-member committee was completed.');
        }
      });
    } catch {
      return res.status(409).json({ error: 'Invalid request.' });
    }
    res.json({ ok: true });
  });

  app.get('/api/prof/theses/:id/notes', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor || !validParticipant(req.params.id, professor.id)) return res.status(404).json({ error: 'Invalid request.' });
    res.json({ items: all('SELECT id, text, createdAt FROM ThesisNote WHERE thesisId = ? AND professorId = ? ORDER BY createdAt DESC', req.params.id, professor.id) });
  });

  app.post('/api/prof/theses/:id/notes', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    if (!professor || !validParticipant(req.params.id, professor.id)) return res.status(404).json({ error: 'Invalid request.' });
    const note = text(req.body?.text);
    if (!note || note.length > 300) return res.status(400).json({ error: 'Invalid request.' });
    const id = newId();
    run('INSERT INTO ThesisNote (id, thesisId, professorId, text, createdAt) VALUES (?, ?, ?, ?, ?)', id, req.params.id, professor.id, note, nowMs());
    res.status(201).json({ id });
  });

  // Thesis state transitions and grading rules are enforced on the server.
  app.post('/api/thesis/transition', requireRole('PROFESSOR', 'SECRETARIAT'), (req, res) => {
    const thesis = one('SELECT * FROM Thesis WHERE id = ?', text(req.body?.thesisId));
    if (!thesis) return res.status(404).json({ error: 'Thesis not found.' });
    if (req.user.role === 'SECRETARIAT') {
      return res.status(400).json({ error: 'Use the secretariat thesis management page.' });
    }
    const professor = currentProfessor(req.user.id);
    if (!professor || thesis.supervisorId !== professor.id) {
      return res.status(403).json({ error: 'Only the supervisor can perform this action.' });
    }

    const action = text(req.body?.action);
    if (action === 'to_under_exam') {
      if (thesis.status !== 'ACTIVE') return res.status(409).json({ error: 'Thesis must be active.' });
      transaction(() => {
        run('UPDATE Thesis SET status = ?, updatedAt = ? WHERE id = ?', 'UNDER_EXAM', nowMs(), thesis.id);
        addHistory(thesis.id, thesis.status, 'UNDER_EXAM', req.user.id, 'Supervisor moved thesis to examination.');
      });
    } else if (action === 'open_grading') {
      if (thesis.status !== 'UNDER_EXAM') return res.status(409).json({ error: 'Thesis must be under examination.' });
      run('UPDATE Thesis SET gradingOpen = 1, updatedAt = ? WHERE id = ?', nowMs(), thesis.id);
    } else if (action === 'cancel_initial') {
      if (thesis.status !== 'UNDER_ASSIGNMENT') return res.status(409).json({ error: 'Initial assignment can no longer be withdrawn.' });
      run('DELETE FROM Thesis WHERE id = ?', thesis.id);
    } else if (action === 'cancel_active') {
      if (thesis.status !== 'ACTIVE') return res.status(409).json({ error: 'Only an active thesis can be canceled by the supervisor.' });
      const start = datetimeToMs(thesis.officialAssignedAt) ?? datetimeToMs(thesis.createdAt);
      if (nowMs() - start < TWO_YEARS_MS) return res.status(409).json({ error: 'Two years have not elapsed since the official assignment.' });
      const number = text(req.body?.gsNumber);
      const year = Number(req.body?.gsYear);
      const reason = text(req.body?.reason);
      if (!number || !Number.isInteger(year) || !reason) return res.status(400).json({ error: 'GS number, year and cancellation reason are required.' });
      transaction(() => {
        run(`UPDATE Thesis SET status = 'CANCELED', cancellationGsNumber = ?, cancellationGsYear = ?,
             cancellationReason = ?, updatedAt = ? WHERE id = ?`, number, year, reason, nowMs(), thesis.id);
        addHistory(thesis.id, thesis.status, 'CANCELED', req.user.id, `GS cancellation ${number}/${year}: ${reason}`);
      });
    } else {
      return res.status(400).json({ error: 'Invalid transition.' });
    }
    return res.json({ ok: true });
  });

  app.post('/api/grades', requireRole('PROFESSOR'), (req, res) => {
    const professor = currentProfessor(req.user.id);
    const thesis = one('SELECT * FROM Thesis WHERE id = ?', text(req.body?.thesisId));
    if (!professor || !thesis || !validParticipant(thesis.id, professor.id)) {
      return res.status(403).json({ error: 'You cannot grade this thesis.' });
    }
    if (thesis.status !== 'UNDER_EXAM' || !thesis.gradingOpen) {
      return res.status(409).json({ error: 'Grading has not been opened by the supervisor.' });
    }

    let criteria = req.body?.criteria && typeof req.body.criteria === 'object' ? req.body.criteria : {};
    let value;
    if (['written', 'presentation', 'overall'].every((name) => Object.hasOwn(criteria, name))) {
      criteria = Object.fromEntries(['written', 'presentation', 'overall'].map((name) => [name, Number(criteria[name])]));
      if (Object.values(criteria).some((number) => !Number.isFinite(number) || number < 0 || number > 10)) {
        return res.status(400).json({ error: 'Every criterion must be a number from 0 to 10.' });
      }
      value = Number((Object.values(criteria).reduce((sum, number) => sum + number, 0) / 3).toFixed(2));
    } else {
      value = Number(req.body?.value);
      if (!Number.isFinite(value) || value < 0 || value > 10) return res.status(400).json({ error: 'Grade must be from 0 to 10.' });
      criteria = {};
    }
    const comments = text(req.body?.comments).slice(0, 2000);
    const existing = one('SELECT id FROM Grade WHERE thesisId = ? AND professorId = ?', thesis.id, professor.id);
    const timestamp = nowMs();
    if (existing) {
      run('UPDATE Grade SET value = ?, comments = ?, criteriaJson = ?, updatedAt = ? WHERE id = ?', value, comments, JSON.stringify(criteria), timestamp, existing.id);
    } else {
      run(`INSERT INTO Grade (id, thesisId, professorId, value, comments, createdAt, updatedAt, criteriaJson)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, newId(), thesis.id, professor.id, value, comments, timestamp, timestamp, JSON.stringify(criteria));
    }
    const values = all('SELECT value FROM Grade WHERE thesisId = ?', thesis.id)
      .map((item) => Number(item.value)).filter((number) => number >= 0 && number <= 10);
    return res.json({
      ok: true,
      gradesReceived: values.length,
      finalGrade: values.length === 3 ? Number((values.reduce((sum, number) => sum + number, 0) / 3).toFixed(2)) : null,
    });
  });

  app.get('/api/theses/:id/exam-record', requireRole('PROFESSOR', 'STUDENT', 'SECRETARIAT'), (req, res) => {
    const thesis = one('SELECT * FROM Thesis WHERE id = ?', req.params.id);
    if (!thesis) return res.status(404).json({ error: 'Thesis not found.' });
    if (req.user.role === 'STUDENT') {
      const student = currentStudent(req.user.id);
      if (!student || student.id !== thesis.studentId) return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'PROFESSOR') {
      const professor = currentProfessor(req.user.id);
      if (!professor || !validParticipant(thesis.id, professor.id)) return res.status(403).json({ error: 'Access denied.' });
    }
    res.type('html').send(examRecordHtml(thesisData(thesis.id)));
  });

  // Secretariat management, presentations and data imports.
  app.get('/api/admin/theses', requireRole('SECRETARIAT'), (req, res) => {
    const status = text(req.query.status, 'ALL');
    if (status !== 'ALL' && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const rows = status === 'ALL'
      ? all('SELECT id FROM Thesis ORDER BY createdAt DESC')
      : all('SELECT id FROM Thesis WHERE status = ? ORDER BY createdAt DESC', status);
    res.json({ items: rows.map((row) => thesisData(row.id)) });
  });

  app.patch('/api/admin/theses', requireRole('SECRETARIAT'), (req, res) => {
    const thesis = one('SELECT * FROM Thesis WHERE id = ?', text(req.body?.thesisId));
    if (!thesis) return res.status(404).json({ error: 'Thesis not found.' });
    let action = text(req.body?.action);
    if (!action && req.body?.status) {
      action = ({ ACTIVE: 'record_assignment', CANCELED: 'cancel', COMPLETED: 'complete', UNDER_EXAM: 'to_under_exam' })[req.body.status] || '';
    }

    if (action === 'record_assignment') {
      if (thesis.status !== 'ACTIVE') return res.status(409).json({ error: 'GS assignment is recorded for an active thesis.' });
      const number = text(req.body?.gsNumber || req.body?.minutes);
      const year = Number(req.body?.gsYear || new Date().getUTCFullYear());
      if (!number || !Number.isInteger(year)) return res.status(400).json({ error: 'GS minutes number and year are required.' });
      transaction(() => {
        run(`UPDATE Thesis SET assignmentGsNumber = ?, assignmentGsYear = ?, officialAssignedAt = COALESCE(officialAssignedAt, ?)
             WHERE id = ?`, number, year, nowMs(), thesis.id);
        run('INSERT INTO ImportLog (id, type, payload, createdAt) VALUES (?, ?, ?, ?)', newId(), 'GS_ASSIGNMENT', JSON.stringify({ thesisId: thesis.id, number, year }), nowMs());
      });
      return res.json({ ok: true });
    }

    if (action === 'to_under_exam') {
      if (thesis.status !== 'ACTIVE') return res.status(409).json({ error: 'Thesis must be active.' });
      transaction(() => {
        run(`UPDATE Thesis SET status = 'UNDER_EXAM', updatedAt = ? WHERE id = ?`, nowMs(), thesis.id);
        addHistory(thesis.id, thesis.status, 'UNDER_EXAM', req.user.id, 'Secretariat moved thesis to examination.');
      });
      return res.json({ ok: true });
    }

    if (action === 'cancel') {
      if (!['ACTIVE', 'UNDER_EXAM'].includes(thesis.status)) return res.status(409).json({ error: 'Only active or examined theses can be canceled.' });
      const number = text(req.body?.gsNumber || req.body?.minutes);
      const year = Number(req.body?.gsYear);
      const reason = text(req.body?.reason);
      if (!number || !Number.isInteger(year) || !reason) return res.status(400).json({ error: 'GS number, year and reason are required.' });
      transaction(() => {
        run(`UPDATE Thesis SET status = 'CANCELED', cancellationGsNumber = ?, cancellationGsYear = ?, cancellationReason = ?, updatedAt = ? WHERE id = ?`,
          number, year, reason, nowMs(), thesis.id);
        addHistory(thesis.id, thesis.status, 'CANCELED', req.user.id, `GS cancellation ${number}/${year}: ${reason}`);
      });
      return res.json({ ok: true });
    }

    if (action === 'complete') {
      const gradeCount = one('SELECT COUNT(*) AS count FROM Grade WHERE thesisId = ? AND value BETWEEN 0 AND 10', thesis.id).count;
      if (thesis.status !== 'UNDER_EXAM' || gradeCount !== 3 || !thesis.finalRepositoryUrl) {
        return res.status(409).json({ error: 'Examination status, three valid grades and a repository URL are required.' });
      }
      transaction(() => {
        run(`UPDATE Thesis SET status = 'COMPLETED', updatedAt = ? WHERE id = ?`, nowMs(), thesis.id);
        addHistory(thesis.id, thesis.status, 'COMPLETED', req.user.id, 'Secretariat completed the thesis.');
      });
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid management action.' });
  });

  app.get('/api/admin/presentations', requireRole('SECRETARIAT'), (_req, res) => {
    const items = all('SELECT * FROM PresentationDetails ORDER BY date').map((item) => ({
      id: item.id, date: item.date, room: item.room, title: item.title, mode: item.mode,
      meetingUrl: item.meetingUrl, thesis: thesisData(item.thesisId, null, false),
    }));
    res.json({ items });
  });

  app.patch('/api/admin/presentations', requireRole('SECRETARIAT'), (req, res) => {
    const presentation = one('SELECT * FROM PresentationDetails WHERE id = ?', text(req.body?.id));
    if (!presentation) return res.status(404).json({ error: 'Presentation not found.' });
    const date = Object.hasOwn(req.body || {}, 'date') ? datetimeToMs(req.body.date) : presentation.date;
    if (!date) return res.status(400).json({ error: 'Invalid date.' });
    const room = Object.hasOwn(req.body || {}, 'room') ? text(req.body.room) : presentation.room;
    run('UPDATE PresentationDetails SET date = ?, room = ?, updatedAt = ? WHERE id = ?', date, room, nowMs(), presentation.id);
    res.json({ ok: true });
  });

  app.post('/api/admin/import/people', requireRole('SECRETARIAT'), async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'A JSON object is required.' });
    const students = Array.isArray(body.students) ? body.students : [];
    const professors = Array.isArray(body.professors) ? body.professors : [];
    const errors = [];
    students.forEach((row, index) => {
      if (!row || ['am', 'firstName', 'lastName', 'email'].some((field) => !text(row[field]))) errors.push(`Invalid student row #${index + 1}.`);
    });
    professors.forEach((row, index) => {
      if (!row || ['code', 'firstName', 'lastName', 'email'].some((field) => !text(row[field]))) errors.push(`Invalid professor row #${index + 1}.`);
    });
    if (errors.length) return res.status(400).json({ error: 'Validation failed.', report: { errors } });

    const existingStudents = new Set(students.filter((row) => one('SELECT id FROM Student WHERE am = ?', text(row.am))).map((row) => text(row.am)));
    const existingProfessors = new Set(professors.filter((row) => one('SELECT id FROM Professor WHERE code = ?', text(row.code))).map((row) => text(row.code)));
    const report = {
      students: { inserted: students.length - existingStudents.size, updated: existingStudents.size, warnings: [], errors: [] },
      professors: { inserted: professors.length - existingProfessors.size, updated: existingProfessors.size, warnings: [], errors: [] },
    };
    if (text(req.query.dryRun) === '1') return res.json({ report });

    const passwordHash = await bcrypt.hash('password', 10);
    try {
      transaction(() => {
        for (const row of students) {
          const am = text(row.am);
          const existing = one('SELECT * FROM Student WHERE am = ?', am);
          if (existing) {
            run('UPDATE Student SET firstName = ?, lastName = ? WHERE id = ?', text(row.firstName), text(row.lastName), existing.id);
            run('UPDATE User SET email = ? WHERE id = ?', text(row.email).toLowerCase(), existing.userId);
          } else {
            const userId = newId();
            run('INSERT INTO User (id, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)', userId, text(row.email).toLowerCase(), passwordHash, 'STUDENT', nowMs());
            run('INSERT INTO Student (id, am, firstName, lastName, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)', newId(), am, text(row.firstName), text(row.lastName), userId, nowMs());
          }
        }
        for (const row of professors) {
          const code = text(row.code);
          const existing = one('SELECT * FROM Professor WHERE code = ?', code);
          if (existing) {
            run('UPDATE Professor SET firstName = ?, lastName = ? WHERE id = ?', text(row.firstName), text(row.lastName), existing.id);
            run('UPDATE User SET email = ? WHERE id = ?', text(row.email).toLowerCase(), existing.userId);
          } else {
            const userId = newId();
            run('INSERT INTO User (id, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)', userId, text(row.email).toLowerCase(), passwordHash, 'PROFESSOR', nowMs());
            run('INSERT INTO Professor (id, code, firstName, lastName, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)', newId(), code, text(row.firstName), text(row.lastName), userId, nowMs());
          }
        }
        run('INSERT INTO ImportLog (id, type, payload, createdAt) VALUES (?, ?, ?, ?)', newId(), 'people', JSON.stringify(body), nowMs());
      });
    } catch (error) {
      return res.status(409).json({ error: `Import failed: ${error.constructor.name}.` });
    }
    res.json({ report });
  });

  app.post('/api/admin/import/academic-status', requireRole('SECRETARIAT'), (req, res) => {
    const rows = Array.isArray(req.body?.academic_status) ? req.body.academic_status : [];
    let updated = 0;
    const notFound = [];
    const errors = [];
    transaction(() => {
      rows.forEach((row, index) => {
        const am = text(row?.am);
        if (!am) return errors.push(`Missing AM in row #${index + 1}.`);
        const student = one('SELECT id FROM Student WHERE am = ?', am);
        if (!student) return notFound.push(am);
        run('UPDATE Student SET academicStatus = ? WHERE id = ?', JSON.stringify({ ects: row.ects, remaining_courses: row.remaining_courses }), student.id);
        updated += 1;
      });
      run('INSERT INTO ImportLog (id, type, payload, createdAt) VALUES (?, ?, ?, ?)', newId(), 'academic-status', JSON.stringify(req.body || {}), nowMs());
    });
    res.json({ updated, notFound, errors });
  });
}
