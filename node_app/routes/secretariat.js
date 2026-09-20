import bcrypt from 'bcryptjs';
import { requireRole } from '../auth.js';
import {
  addHistory,
  all,
  datetimeToMs,
  newId,
  nowMs,
  one,
  run,
  thesisData,
  transaction,
} from '../db.js';
import {
  allThesisIdsForStatus,
  cleanText,
  THESIS_STATUSES,
  validGradeCount,
} from './helpers.js';

function listTheses(req, res) {
  const status = cleanText(req.query.status, 'ALL');
  if (status !== 'ALL' && !THESIS_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const thesisRows = allThesisIdsForStatus(status);
  return res.json({ items: thesisRows.map((row) => thesisData(row.id)) });
}

function recordAssignment(thesis, req, res) {
  if (thesis.status !== 'ACTIVE') {
    return res.status(409).json({ error: 'GS assignment is recorded for an active thesis.' });
  }

  const gsNumber = cleanText(req.body?.gsNumber || req.body?.minutes);
  const gsYear = Number(req.body?.gsYear || new Date().getUTCFullYear());
  if (!gsNumber || !Number.isInteger(gsYear)) {
    return res.status(400).json({ error: 'GS minutes number and year are required.' });
  }

  transaction(() => {
    run(
      `UPDATE Thesis SET assignmentGsNumber = ?, assignmentGsYear = ?, officialAssignedAt = COALESCE(officialAssignedAt, ?)
       WHERE id = ?`,
      gsNumber,
      gsYear,
      nowMs(),
      thesis.id,
    );
    run(
      'INSERT INTO ImportLog (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
      newId(),
      'GS_ASSIGNMENT',
      JSON.stringify({ thesisId: thesis.id, number: gsNumber, year: gsYear }),
      nowMs(),
    );
  });
  return res.json({ ok: true });
}

function cancelThesis(thesis, req, res) {
  if (!['ACTIVE', 'UNDER_EXAM'].includes(thesis.status)) {
    return res.status(409).json({ error: 'Only active or examined theses can be canceled.' });
  }

  const gsNumber = cleanText(req.body?.gsNumber || req.body?.minutes);
  const gsYear = Number(req.body?.gsYear);
  const reason = cleanText(req.body?.reason);
  if (!gsNumber || !Number.isInteger(gsYear) || !reason) {
    return res.status(400).json({ error: 'GS number, year and reason are required.' });
  }

  transaction(() => {
    run(
      `UPDATE Thesis SET status = 'CANCELED', cancellationGsNumber = ?, cancellationGsYear = ?, cancellationReason = ?, updatedAt = ? WHERE id = ?`,
      gsNumber,
      gsYear,
      reason,
      nowMs(),
      thesis.id,
    );
    addHistory(thesis.id, thesis.status, 'CANCELED', req.user.id, `GS cancellation ${gsNumber}/${gsYear}: ${reason}`);
  });
  return res.json({ ok: true });
}

function completeThesis(thesis, req, res) {
  const hasAllGrades = validGradeCount(thesis.id) === 3;
  const canComplete = thesis.status === 'UNDER_EXAM'
    && hasAllGrades
    && thesis.finalRepositoryUrl;
  if (!canComplete) {
    return res.status(409).json({
      error: 'Examination status, three valid grades and a repository URL are required.',
    });
  }

  transaction(() => {
    run(`UPDATE Thesis SET status = 'COMPLETED', updatedAt = ? WHERE id = ?`, nowMs(), thesis.id);
    addHistory(thesis.id, thesis.status, 'COMPLETED', req.user.id, 'Secretariat completed the thesis.');
  });
  return res.json({ ok: true });
}

function manageThesis(req, res) {
  const thesis = one('SELECT * FROM Thesis WHERE id = ?', cleanText(req.body?.thesisId));
  if (!thesis) return res.status(404).json({ error: 'Thesis not found.' });

  let action = cleanText(req.body?.action);
  if (!action && req.body?.status) {
    const legacyActions = {
      ACTIVE: 'record_assignment',
      CANCELED: 'cancel',
      COMPLETED: 'complete',
    };
    action = legacyActions[req.body.status] || '';
  }

  if (action === 'record_assignment') return recordAssignment(thesis, req, res);
  if (action === 'cancel') return cancelThesis(thesis, req, res);
  if (action === 'complete') return completeThesis(thesis, req, res);
  return res.status(400).json({ error: 'Invalid management action.' });
}

function listPresentations(_req, res) {
  const items = all('SELECT * FROM PresentationDetails ORDER BY date').map((presentation) => ({
    id: presentation.id,
    date: presentation.date,
    room: presentation.room,
    title: presentation.title,
    mode: presentation.mode,
    meetingUrl: presentation.meetingUrl,
    thesis: thesisData(presentation.thesisId, null, false),
  }));
  res.json({ items });
}

function updatePresentation(req, res) {
  const presentation = one(
    'SELECT * FROM PresentationDetails WHERE id = ?',
    cleanText(req.body?.id),
  );
  if (!presentation) return res.status(404).json({ error: 'Presentation not found.' });

  const dateWasProvided = Object.hasOwn(req.body || {}, 'date');
  const date = dateWasProvided ? datetimeToMs(req.body.date) : presentation.date;
  if (!date) return res.status(400).json({ error: 'Invalid date.' });

  const roomWasProvided = Object.hasOwn(req.body || {}, 'room');
  const room = roomWasProvided ? cleanText(req.body.room) : presentation.room;
  run(
    'UPDATE PresentationDetails SET date = ?, room = ?, updatedAt = ? WHERE id = ?',
    date,
    room,
    nowMs(),
    presentation.id,
  );
  return res.json({ ok: true });
}

function validatePeopleImport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { bodyError: 'A JSON object is required.' };
  }

  const students = Array.isArray(body.students) ? body.students : [];
  const professors = Array.isArray(body.professors) ? body.professors : [];
  const errors = [];
  students.forEach((row, index) => {
    const missingField = !row
      || ['am', 'firstName', 'lastName', 'email'].some((field) => !cleanText(row[field]));
    if (missingField) errors.push(`Invalid student row #${index + 1}.`);
  });
  professors.forEach((row, index) => {
    const missingField = !row
      || ['code', 'firstName', 'lastName', 'email'].some((field) => !cleanText(row[field]));
    if (missingField) errors.push(`Invalid professor row #${index + 1}.`);
  });
  return { students, professors, errors };
}

function buildPeopleImportReport(students, professors) {
  const existingStudentAms = new Set(students
    .filter((row) => one('SELECT id FROM Student WHERE am = ?', cleanText(row.am)))
    .map((row) => cleanText(row.am)));
  const existingProfessorCodes = new Set(professors
    .filter((row) => one('SELECT id FROM Professor WHERE code = ?', cleanText(row.code)))
    .map((row) => cleanText(row.code)));

  return {
    students: {
      inserted: students.length - existingStudentAms.size,
      updated: existingStudentAms.size,
      warnings: [],
      errors: [],
    },
    professors: {
      inserted: professors.length - existingProfessorCodes.size,
      updated: existingProfessorCodes.size,
      warnings: [],
      errors: [],
    },
  };
}

function upsertStudent(row, passwordHash) {
  const am = cleanText(row.am);
  const existingStudent = one('SELECT * FROM Student WHERE am = ?', am);
  if (existingStudent) {
    run(
      'UPDATE Student SET firstName = ?, lastName = ? WHERE id = ?',
      cleanText(row.firstName),
      cleanText(row.lastName),
      existingStudent.id,
    );
    run(
      'UPDATE User SET email = ? WHERE id = ?',
      cleanText(row.email).toLowerCase(),
      existingStudent.userId,
    );
    return;
  }

  const userId = newId();
  run(
    'INSERT INTO User (id, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)',
    userId,
    cleanText(row.email).toLowerCase(),
    passwordHash,
    'STUDENT',
    nowMs(),
  );
  run(
    'INSERT INTO Student (id, am, firstName, lastName, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    newId(),
    am,
    cleanText(row.firstName),
    cleanText(row.lastName),
    userId,
    nowMs(),
  );
}

function upsertProfessor(row, passwordHash) {
  const code = cleanText(row.code);
  const existingProfessor = one('SELECT * FROM Professor WHERE code = ?', code);
  if (existingProfessor) {
    run(
      'UPDATE Professor SET firstName = ?, lastName = ? WHERE id = ?',
      cleanText(row.firstName),
      cleanText(row.lastName),
      existingProfessor.id,
    );
    run(
      'UPDATE User SET email = ? WHERE id = ?',
      cleanText(row.email).toLowerCase(),
      existingProfessor.userId,
    );
    return;
  }

  const userId = newId();
  run(
    'INSERT INTO User (id, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)',
    userId,
    cleanText(row.email).toLowerCase(),
    passwordHash,
    'PROFESSOR',
    nowMs(),
  );
  run(
    'INSERT INTO Professor (id, code, firstName, lastName, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    newId(),
    code,
    cleanText(row.firstName),
    cleanText(row.lastName),
    userId,
    nowMs(),
  );
}

async function importPeople(req, res) {
  const validation = validatePeopleImport(req.body);
  if (validation.bodyError) return res.status(400).json({ error: validation.bodyError });
  if (validation.errors.length) {
    return res.status(400).json({
      error: 'Validation failed.',
      report: { errors: validation.errors },
    });
  }

  const { students, professors } = validation;
  const report = buildPeopleImportReport(students, professors);
  if (cleanText(req.query.dryRun) === '1') return res.json({ report });

  const passwordHash = await bcrypt.hash('password', 10);
  try {
    transaction(() => {
      students.forEach((student) => upsertStudent(student, passwordHash));
      professors.forEach((professor) => upsertProfessor(professor, passwordHash));
      run(
        'INSERT INTO ImportLog (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
        newId(),
        'people',
        JSON.stringify(req.body),
        nowMs(),
      );
    });
  } catch (error) {
    return res.status(409).json({ error: `Import failed: ${error.constructor.name}.` });
  }
  return res.json({ report });
}

function importAcademicStatus(req, res) {
  const rows = Array.isArray(req.body?.academic_status) ? req.body.academic_status : [];
  let updated = 0;
  const notFound = [];
  const errors = [];

  transaction(() => {
    rows.forEach((row, index) => {
      const am = cleanText(row?.am);
      if (!am) {
        errors.push(`Missing AM in row #${index + 1}.`);
        return;
      }

      const student = one('SELECT id FROM Student WHERE am = ?', am);
      if (!student) {
        notFound.push(am);
        return;
      }

      const academicStatus = JSON.stringify({
        ects: row.ects,
        remaining_courses: row.remaining_courses,
      });
      run('UPDATE Student SET academicStatus = ? WHERE id = ?', academicStatus, student.id);
      updated += 1;
    });
    run(
      'INSERT INTO ImportLog (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
      newId(),
      'academic-status',
      JSON.stringify(req.body || {}),
      nowMs(),
    );
  });
  return res.json({ updated, notFound, errors });
}

export function registerSecretariatRoutes(app) {
  app.get('/api/admin/theses', requireRole('SECRETARIAT'), listTheses);
  app.patch('/api/admin/theses', requireRole('SECRETARIAT'), manageThesis);
  app.get('/api/admin/presentations', requireRole('SECRETARIAT'), listPresentations);
  app.patch('/api/admin/presentations', requireRole('SECRETARIAT'), updatePresentation);
  app.post('/api/admin/import/people', requireRole('SECRETARIAT'), importPeople);
  app.post('/api/admin/import/academic-status', requireRole('SECRETARIAT'), importAcademicStatus);
}
