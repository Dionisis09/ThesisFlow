import { requireRole } from '../auth.js';
import {
  addHistory,
  all,
  currentProfessor,
  currentStudent,
  datetimeToMs,
  newId,
  nowMs,
  one,
  participatedThesisIds,
  professorData,
  run,
  thesisData,
  transaction,
} from '../db.js';
import {
  cleanText,
  csvEscape,
  isProfessorParticipant,
  savePdf,
  statisticsForTheses,
  TWO_YEARS_MS,
} from './helpers.js';

function listTopics(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.status(404).json({ error: 'Invalid request.' });

  const rows = all(`
    SELECT Topic.*, EXISTS(SELECT 1 FROM Thesis WHERE Thesis.topicId = Topic.id) AS assigned
    FROM Topic WHERE Topic.supervisorId = ? ORDER BY Topic.createdAt DESC
  `, professor.id);
  const items = rows.map((topic) => ({
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    status: topic.status,
    descriptionUrl: topic.descriptionUrl,
    assigned: Boolean(topic.assigned),
  }));
  return res.json({ items });
}

function createTopic(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.status(404).json({ error: 'Invalid request.' });

  const title = cleanText(req.body?.title);
  const summary = cleanText(req.body?.summary);
  if (!title || !summary || title.length > 200 || summary.length > 3000) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const topicId = newId();
  run(
    'INSERT INTO Topic (id, title, summary, descriptionUrl, status, supervisorId, createdAt) VALUES (?, ?, ?, NULL, ?, ?, ?)',
    topicId,
    title,
    summary,
    'AVAILABLE',
    professor.id,
    nowMs(),
  );
  return res.status(201).json({ id: topicId });
}

function updateTopic(req, res) {
  const professor = currentProfessor(req.user.id);
  const topic = one('SELECT * FROM Topic WHERE id = ?', req.params.id);
  if (!professor || !topic || topic.supervisorId !== professor.id) {
    return res.status(404).json({ error: 'Invalid request.' });
  }

  const topicIsAssigned = Boolean(one('SELECT id FROM Thesis WHERE topicId = ?', topic.id));
  const editsTopicData = ['title', 'summary', 'toggle']
    .some((key) => Object.hasOwn(req.body || {}, key));
  if (topicIsAssigned && editsTopicData) {
    return res.status(409).json({ error: 'Invalid request.' });
  }

  let { title, summary, status } = topic;
  if (req.body?.toggle) status = status === 'AVAILABLE' ? 'HIDDEN' : 'AVAILABLE';
  if (Object.hasOwn(req.body || {}, 'title')) {
    title = cleanText(req.body.title);
    if (!title) return res.status(400).json({ error: 'Invalid request.' });
  }
  if (Object.hasOwn(req.body || {}, 'summary')) {
    summary = cleanText(req.body.summary);
    if (!summary) return res.status(400).json({ error: 'Invalid request.' });
  }

  run('UPDATE Topic SET title = ?, summary = ?, status = ? WHERE id = ?', title, summary, status, topic.id);
  return res.json({ ok: true });
}

function uploadTopicDescription(uploadFolder) {
  return (req, res) => {
    const professor = currentProfessor(req.user.id);
    const topic = one('SELECT * FROM Topic WHERE id = ?', cleanText(req.body?.topicId));
    if (!professor || !topic || topic.supervisorId !== professor.id) {
      return res.status(404).json({ error: 'Invalid request.' });
    }

    const url = savePdf(req.file, uploadFolder);
    if (!url) return res.status(400).json({ error: 'Invalid request.' });

    run('UPDATE Topic SET descriptionUrl = ? WHERE id = ?', url, topic.id);
    return res.json({ url });
  };
}

function assignmentChoices(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.status(404).json({ error: 'Invalid request.' });

  const query = cleanText(req.query.q);
  const searchPattern = `%${query}%`;
  const students = query
    ? all(`SELECT Student.* FROM Student LEFT JOIN Thesis ON Thesis.studentId = Student.id WHERE Thesis.id IS NULL AND (Student.am LIKE ? OR Student.firstName LIKE ? OR Student.lastName LIKE ?) ORDER BY Student.am LIMIT 20`, searchPattern, searchPattern, searchPattern)
    : all('SELECT Student.* FROM Student LEFT JOIN Thesis ON Thesis.studentId = Student.id WHERE Thesis.id IS NULL ORDER BY Student.am LIMIT 20');
  const topics = query
    ? all(`SELECT Topic.* FROM Topic LEFT JOIN Thesis ON Thesis.topicId = Topic.id WHERE Topic.supervisorId = ? AND Topic.status = 'AVAILABLE' AND Thesis.id IS NULL AND (Topic.title LIKE ? OR Topic.summary LIKE ?) ORDER BY Topic.createdAt DESC LIMIT 20`, professor.id, searchPattern, searchPattern)
    : all(`SELECT Topic.* FROM Topic LEFT JOIN Thesis ON Thesis.topicId = Topic.id WHERE Topic.supervisorId = ? AND Topic.status = 'AVAILABLE' AND Thesis.id IS NULL ORDER BY Topic.createdAt DESC LIMIT 20`, professor.id);

  return res.json({
    students: students.map((student) => ({
      id: student.id,
      am: student.am,
      firstName: student.firstName,
      lastName: student.lastName,
    })),
    topics: topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      summary: topic.summary,
    })),
  });
}

function assignTopic(req, res) {
  const professor = currentProfessor(req.user.id);
  const student = one('SELECT * FROM Student WHERE id = ?', cleanText(req.body?.studentId));
  const topic = one('SELECT * FROM Topic WHERE id = ?', cleanText(req.body?.topicId));

  const studentAlreadyHasThesis = student && one('SELECT id FROM Thesis WHERE studentId = ?', student.id);
  if (!student || studentAlreadyHasThesis) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const topicAlreadyAssigned = topic && one('SELECT id FROM Thesis WHERE topicId = ?', topic.id);
  const validTopic = professor
    && topic
    && topic.supervisorId === professor.id
    && topic.status === 'AVAILABLE'
    && !topicAlreadyAssigned;
  if (!validTopic) return res.status(400).json({ error: 'Invalid request.' });

  const thesisId = newId();
  const timestamp = nowMs();
  try {
    transaction(() => {
      run(
        'INSERT INTO Thesis (id, studentId, supervisorId, topicId, status, createdAt, updatedAt, gradingOpen) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        thesisId,
        student.id,
        professor.id,
        topic.id,
        'UNDER_ASSIGNMENT',
        timestamp,
        timestamp,
      );
      addHistory(thesisId, null, 'UNDER_ASSIGNMENT', req.user.id, 'Initial assignment by supervisor.');
    });
  } catch {
    return res.status(409).json({ error: 'Invalid request.' });
  }
  return res.status(201).json({ ok: true, id: thesisId });
}

function listProfessorTheses(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.json({ items: [] });

  let items = participatedThesisIds(professor.id)
    .map((thesisId) => thesisData(thesisId, professor.id));
  const status = cleanText(req.query.status, 'ALL');
  const role = cleanText(req.query.role, 'ALL');
  if (status !== 'ALL') items = items.filter((thesis) => thesis.status === status);
  if (role !== 'ALL') items = items.filter((thesis) => thesis.role === role);
  return res.json({ items });
}

function professorExportRows(professorId) {
  return participatedThesisIds(professorId).map((thesisId) => {
    const thesis = thesisData(thesisId, professorId, false);
    return {
      id: thesis.id,
      status: thesis.status,
      role: thesis.role,
      student_am: thesis.student.am,
      student_name: thesis.student.fullName,
      topic_title: thesis.topic.title,
    };
  });
}

function exportProfessorThesesCsv(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.status(404).json({ error: 'Invalid request.' });

  const columns = ['id', 'status', 'role', 'student_am', 'student_name', 'topic_title'];
  const dataRows = professorExportRows(professor.id)
    .map((row) => columns.map((column) => csvEscape(row[column])).join(','));
  const csv = [columns.join(','), ...dataRows].join('\n');
  return res.set('Content-Disposition', 'attachment; filename="theses.csv"')
    .type('text/csv')
    .send(csv);
}

function exportProfessorThesesJson(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.status(404).json({ error: 'Invalid request.' });

  const items = participatedThesisIds(professor.id)
    .map((thesisId) => thesisData(thesisId, professor.id));
  return res.json({ items });
}

function professorStatistics(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor) return res.status(404).json({ error: 'Invalid request.' });

  const supervisedIds = all('SELECT id FROM Thesis WHERE supervisorId = ?', professor.id)
    .map((row) => row.id);
  const committeeIds = all(`
    SELECT Thesis.id FROM Thesis
    JOIN CommitteeMember ON CommitteeMember.thesisId = Thesis.id
    WHERE CommitteeMember.professorId = ? AND Thesis.supervisorId <> ?
  `, professor.id, professor.id).map((row) => row.id);

  return res.json({
    supervised: statisticsForTheses(supervisedIds),
    committee: statisticsForTheses(committeeIds),
  });
}

function listCommitteeInvitations(req, res) {
  if (req.user.role === 'STUDENT') {
    const student = currentStudent(req.user.id);
    const thesis = student ? one('SELECT id FROM Thesis WHERE studentId = ?', student.id) : null;
    if (!thesis) return res.json({ items: [] });

    const invitations = all(`
      SELECT CommitteeInvitation.*, Professor.code, Professor.firstName, Professor.lastName
      FROM CommitteeInvitation JOIN Professor ON Professor.id = CommitteeInvitation.professorId
      WHERE CommitteeInvitation.thesisId = ? ORDER BY CommitteeInvitation.createdAt DESC
    `, thesis.id);
    const items = invitations.map((invitation) => ({
      id: invitation.id,
      status: invitation.status,
      createdAt: invitation.createdAt,
      respondedAt: invitation.respondedAt,
      professor: professorData(invitation),
    }));
    return res.json({ items });
  }

  const professor = currentProfessor(req.user.id);
  if (!professor) return res.json({ items: [] });

  const invitations = all(`
    SELECT CommitteeInvitation.*, Topic.title AS topic, Student.firstName AS studentFirst,
           Student.lastName AS studentLast, Supervisor.firstName AS supervisorFirst, Supervisor.lastName AS supervisorLast
    FROM CommitteeInvitation
    JOIN Thesis ON Thesis.id = CommitteeInvitation.thesisId
    JOIN Topic ON Topic.id = Thesis.topicId
    JOIN Student ON Student.id = Thesis.studentId
    JOIN Professor AS Supervisor ON Supervisor.id = Thesis.supervisorId
    WHERE CommitteeInvitation.professorId = ? AND CommitteeInvitation.status = 'PENDING'
    ORDER BY CommitteeInvitation.createdAt DESC
  `, professor.id);
  const items = invitations.map((invitation) => ({
    id: invitation.id,
    status: invitation.status,
    createdAt: invitation.createdAt,
    thesisId: invitation.thesisId,
    topic: invitation.topic,
    student: `${invitation.studentFirst} ${invitation.studentLast}`,
    supervisor: `${invitation.supervisorFirst} ${invitation.supervisorLast}`,
  }));
  return res.json({ items });
}

function answerCommitteeInvitation(req, res) {
  const professor = currentProfessor(req.user.id);
  const invitation = one('SELECT * FROM CommitteeInvitation WHERE id = ?', cleanText(req.body?.id));
  if (!professor || !invitation || invitation.professorId !== professor.id) {
    return res.status(404).json({ error: 'Invalid request.' });
  }
  if (invitation.status !== 'PENDING') {
    return res.status(409).json({ error: 'Invalid request.' });
  }

  const thesis = one('SELECT * FROM Thesis WHERE id = ?', invitation.thesisId);
  if (thesis.status !== 'UNDER_ASSIGNMENT') {
    return res.status(409).json({ error: 'Invalid request.' });
  }

  const action = cleanText(req.body?.action);
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  if (action === 'decline') {
    run('UPDATE CommitteeInvitation SET status = ?, respondedAt = ? WHERE id = ?', 'DECLINED', nowMs(), invitation.id);
    return res.json({ ok: true });
  }

  const currentMemberCount = one(
    'SELECT COUNT(*) AS count FROM CommitteeMember WHERE thesisId = ?',
    thesis.id,
  ).count;
  if (currentMemberCount >= 2) {
    run('UPDATE CommitteeInvitation SET status = ?, respondedAt = ? WHERE id = ?', 'DECLINED', nowMs(), invitation.id);
    return res.status(409).json({ error: 'Invalid request.' });
  }

  try {
    transaction(() => {
      const timestamp = nowMs();
      run('UPDATE CommitteeInvitation SET status = ?, respondedAt = ? WHERE id = ?', 'ACCEPTED', timestamp, invitation.id);
      run(
        'INSERT INTO CommitteeMember (id, thesisId, professorId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        newId(),
        thesis.id,
        professor.id,
        currentMemberCount === 0 ? 'MEMBER1' : 'MEMBER2',
        timestamp,
      );

      if (currentMemberCount + 1 === 2) {
        run('UPDATE Thesis SET status = ?, updatedAt = ? WHERE id = ?', 'ACTIVE', timestamp, thesis.id);
        run(
          `UPDATE CommitteeInvitation SET status = 'DECLINED', respondedAt = ? WHERE thesisId = ? AND id <> ? AND status = 'PENDING'`,
          timestamp,
          thesis.id,
          invitation.id,
        );
        addHistory(thesis.id, thesis.status, 'ACTIVE', req.user.id, 'The three-member committee was completed.');
      }
    });
  } catch {
    return res.status(409).json({ error: 'Invalid request.' });
  }
  return res.json({ ok: true });
}

function listPrivateNotes(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor || !isProfessorParticipant(req.params.id, professor.id)) {
    return res.status(404).json({ error: 'Invalid request.' });
  }

  const items = all(
    'SELECT id, text, createdAt FROM ThesisNote WHERE thesisId = ? AND professorId = ? ORDER BY createdAt DESC',
    req.params.id,
    professor.id,
  );
  return res.json({ items });
}

function addPrivateNote(req, res) {
  const professor = currentProfessor(req.user.id);
  if (!professor || !isProfessorParticipant(req.params.id, professor.id)) {
    return res.status(404).json({ error: 'Invalid request.' });
  }

  const note = cleanText(req.body?.text);
  if (!note || note.length > 300) return res.status(400).json({ error: 'Invalid request.' });

  const noteId = newId();
  run(
    'INSERT INTO ThesisNote (id, thesisId, professorId, text, createdAt) VALUES (?, ?, ?, ?, ?)',
    noteId,
    req.params.id,
    professor.id,
    note,
    nowMs(),
  );
  return res.status(201).json({ id: noteId });
}

function transitionThesis(req, res) {
  const thesis = one('SELECT * FROM Thesis WHERE id = ?', cleanText(req.body?.thesisId));
  if (!thesis) return res.status(404).json({ error: 'Thesis not found.' });
  if (req.user.role === 'SECRETARIAT') {
    return res.status(400).json({ error: 'Use the secretariat thesis management page.' });
  }

  const professor = currentProfessor(req.user.id);
  if (!professor || thesis.supervisorId !== professor.id) {
    return res.status(403).json({ error: 'Only the supervisor can perform this action.' });
  }

  const action = cleanText(req.body?.action);
  if (action === 'to_under_exam') {
    if (thesis.status !== 'ACTIVE') {
      return res.status(409).json({ error: 'Thesis must be active.' });
    }
    transaction(() => {
      run('UPDATE Thesis SET status = ?, updatedAt = ? WHERE id = ?', 'UNDER_EXAM', nowMs(), thesis.id);
      addHistory(thesis.id, thesis.status, 'UNDER_EXAM', req.user.id, 'Supervisor moved thesis to examination.');
    });
  } else if (action === 'open_grading') {
    if (thesis.status !== 'UNDER_EXAM') {
      return res.status(409).json({ error: 'Thesis must be under examination.' });
    }
    run('UPDATE Thesis SET gradingOpen = 1, updatedAt = ? WHERE id = ?', nowMs(), thesis.id);
  } else if (action === 'cancel_initial') {
    if (thesis.status !== 'UNDER_ASSIGNMENT') {
      return res.status(409).json({ error: 'Initial assignment can no longer be withdrawn.' });
    }
    run('DELETE FROM Thesis WHERE id = ?', thesis.id);
  } else if (action === 'cancel_active') {
    if (thesis.status !== 'ACTIVE') {
      return res.status(409).json({ error: 'Only an active thesis can be canceled by the supervisor.' });
    }

    const assignmentStartedAt = datetimeToMs(thesis.officialAssignedAt) ?? datetimeToMs(thesis.createdAt);
    if (nowMs() - assignmentStartedAt < TWO_YEARS_MS) {
      return res.status(409).json({ error: 'Two years have not elapsed since the official assignment.' });
    }

    const gsNumber = cleanText(req.body?.gsNumber);
    const gsYear = Number(req.body?.gsYear);
    const reason = cleanText(req.body?.reason);
    if (!gsNumber || !Number.isInteger(gsYear) || !reason) {
      return res.status(400).json({ error: 'GS number, year and cancellation reason are required.' });
    }

    transaction(() => {
      run(
        `UPDATE Thesis SET status = 'CANCELED', cancellationGsNumber = ?, cancellationGsYear = ?,
         cancellationReason = ?, updatedAt = ? WHERE id = ?`,
        gsNumber,
        gsYear,
        reason,
        nowMs(),
        thesis.id,
      );
      addHistory(thesis.id, thesis.status, 'CANCELED', req.user.id, `GS cancellation ${gsNumber}/${gsYear}: ${reason}`);
    });
  } else {
    return res.status(400).json({ error: 'Invalid transition.' });
  }
  return res.json({ ok: true });
}

function saveGrade(req, res) {
  const professor = currentProfessor(req.user.id);
  const thesis = one('SELECT * FROM Thesis WHERE id = ?', cleanText(req.body?.thesisId));
  if (!professor || !thesis || !isProfessorParticipant(thesis.id, professor.id)) {
    return res.status(403).json({ error: 'You cannot grade this thesis.' });
  }
  if (thesis.status !== 'UNDER_EXAM' || !thesis.gradingOpen) {
    return res.status(409).json({ error: 'Grading has not been opened by the supervisor.' });
  }

  let criteria = req.body?.criteria && typeof req.body.criteria === 'object'
    ? req.body.criteria
    : {};
  let gradeValue;
  const criterionNames = ['written', 'presentation', 'overall'];
  const hasAllCriteria = criterionNames.every((name) => Object.hasOwn(criteria, name));
  if (hasAllCriteria) {
    criteria = Object.fromEntries(
      criterionNames.map((name) => [name, Number(criteria[name])]),
    );
    const hasInvalidCriterion = Object.values(criteria)
      .some((number) => !Number.isFinite(number) || number < 0 || number > 10);
    if (hasInvalidCriterion) {
      return res.status(400).json({ error: 'Every criterion must be a number from 0 to 10.' });
    }
    const total = Object.values(criteria).reduce((sum, number) => sum + number, 0);
    gradeValue = Number((total / 3).toFixed(2));
  } else {
    gradeValue = Number(req.body?.value);
    if (!Number.isFinite(gradeValue) || gradeValue < 0 || gradeValue > 10) {
      return res.status(400).json({ error: 'Grade must be from 0 to 10.' });
    }
    criteria = {};
  }

  const comments = cleanText(req.body?.comments).slice(0, 2000);
  const existingGrade = one(
    'SELECT id FROM Grade WHERE thesisId = ? AND professorId = ?',
    thesis.id,
    professor.id,
  );
  const timestamp = nowMs();
  if (existingGrade) {
    run(
      'UPDATE Grade SET value = ?, comments = ?, criteriaJson = ?, updatedAt = ? WHERE id = ?',
      gradeValue,
      comments,
      JSON.stringify(criteria),
      timestamp,
      existingGrade.id,
    );
  } else {
    run(
      `INSERT INTO Grade (id, thesisId, professorId, value, comments, createdAt, updatedAt, criteriaJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      thesis.id,
      professor.id,
      gradeValue,
      comments,
      timestamp,
      timestamp,
      JSON.stringify(criteria),
    );
  }

  const validGrades = all('SELECT value FROM Grade WHERE thesisId = ?', thesis.id)
    .map((grade) => Number(grade.value))
    .filter((grade) => grade >= 0 && grade <= 10);
  const finalGrade = validGrades.length === 3
    ? Number((validGrades.reduce((sum, grade) => sum + grade, 0) / 3).toFixed(2))
    : null;
  return res.json({ ok: true, gradesReceived: validGrades.length, finalGrade });
}

export function registerProfessorRoutes(app, upload, uploadFolder) {
  app.get('/api/prof/topics', requireRole('PROFESSOR'), listTopics);
  app.post('/api/prof/topics', requireRole('PROFESSOR'), createTopic);
  app.patch('/api/prof/topics/:id', requireRole('PROFESSOR'), updateTopic);
  app.post(
    '/api/upload/topic-description',
    requireRole('PROFESSOR'),
    upload.single('file'),
    uploadTopicDescription(uploadFolder),
  );
  app.get('/api/prof/assign', requireRole('PROFESSOR'), assignmentChoices);
  app.post('/api/prof/assign', requireRole('PROFESSOR'), assignTopic);
  app.get('/api/prof/theses', requireRole('PROFESSOR'), listProfessorTheses);
  app.get('/api/prof/theses/export', requireRole('PROFESSOR'), exportProfessorThesesCsv);
  app.get('/api/prof/theses/export.json', requireRole('PROFESSOR'), exportProfessorThesesJson);
  app.get('/api/prof/stats', requireRole('PROFESSOR'), professorStatistics);
  app.get('/api/committee/invitations', requireRole('PROFESSOR', 'STUDENT'), listCommitteeInvitations);
  app.patch('/api/committee/invitations', requireRole('PROFESSOR'), answerCommitteeInvitation);
  app.get('/api/prof/theses/:id/notes', requireRole('PROFESSOR'), listPrivateNotes);
  app.post('/api/prof/theses/:id/notes', requireRole('PROFESSOR'), addPrivateNote);
  app.post('/api/thesis/transition', requireRole('PROFESSOR', 'SECRETARIAT'), transitionThesis);
  app.post('/api/grades', requireRole('PROFESSOR'), saveGrade);
}
