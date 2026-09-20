import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const TEMP_FOLDER = fs.mkdtempSync(path.join(os.tmpdir(), 'thesisflow-node-test-'));
const TEST_DB = path.join(TEMP_FOLDER, 'test.db');
fs.copyFileSync(path.join(ROOT, 'data', 'dev.db'), TEST_DB);
process.env.DATABASE_URL = `sqlite:///${TEST_DB.replaceAll('\\', '/')}`;
process.env.SESSION_SECRET = 'automated-test-secret';

const { createApp } = await import(`../server.js?test=${Date.now()}`);
const database = await import('../node_app/db.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const BASE_URL = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  database.db.close();
  fs.rmSync(TEMP_FOLDER, { recursive: true, force: true });
});

async function rawRequest(route, options = {}) {
  return fetch(`${BASE_URL}${route}`, { redirect: 'manual', ...options });
}

async function login(email, home) {
  const response = await rawRequest('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password' }),
  });
  assert.equal(response.status, 200, `Login failed for ${email}: ${await response.text()}`);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const page = await rawRequest(home, { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  const html = await page.text();
  const csrf = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  assert.ok(csrf);
  return { cookie, csrf };
}

async function api(session, route, method = 'GET', body) {
  const headers = { Cookie: session.cookie };
  if (method !== 'GET') headers['X-CSRF-Token'] = session.csrf;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await rawRequest(route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('json') ? await response.json() : await response.text();
  assert.ok(response.ok, `${method} ${route} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

test('public feed, protection and server-side TTL caching work', async () => {
  const publicFeed = await rawRequest('/api/public/presentations');
  assert.equal(publicFeed.status, 200);
  assert.match(publicFeed.headers.get('cache-control'), /max-age=60/);
  assert.ok(Array.isArray((await publicFeed.json()).items));

  const xmlFeed = await rawRequest('/api/public/presentations?format=xml');
  assert.equal(xmlFeed.status, 200);
  assert.match(xmlFeed.headers.get('content-type'), /xml/);

  const protectedApi = await rawRequest('/api/admin/theses');
  assert.equal(protectedApi.status, 401);
  const protectedPage = await rawRequest('/admin');
  assert.equal(protectedPage.status, 302);

  const asset = await rawRequest('/static/css/app.css');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /max-age=3600/);
});

test('all role dashboards and read APIs load with the correct authorization', async () => {
  const roles = [
    ['sec@uni.local', '/admin', '/api/admin/theses'],
    ['prof001@uni.local', '/prof', '/api/prof/theses'],
    ['student001@uni.local', '/student', '/api/student/thesis'],
  ];
  for (const [email, home, endpoint] of roles) {
    const session = await login(email, home);
    const payload = await api(session, endpoint);
    assert.ok(payload && typeof payload === 'object');
  }
});

test('CSRF and role separation reject unauthorized writes', async () => {
  const professor = await login('prof001@uni.local', '/prof');
  const noCsrf = await rawRequest('/api/prof/topics', {
    method: 'POST', headers: { Cookie: professor.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Rejected', summary: 'Missing CSRF' }),
  });
  assert.equal(noCsrf.status, 400);
  const adminEndpoint = await rawRequest('/api/admin/theses', { headers: { Cookie: professor.cookie } });
  assert.equal(adminEndpoint.status, 403);
});

test('topic editing, initial cancellation and student profile update work', async () => {
  const professor = await login('prof001@uni.local', '/prof');
  const student = await login('student001@uni.local', '/student');

  const topic = await api(professor, '/api/prof/topics', 'POST', {
    title: 'Refactor verification topic',
    summary: 'Original summary',
  });
  await api(professor, `/api/prof/topics/${topic.id}`, 'PATCH', {
    title: 'Updated verification topic',
    summary: 'Updated summary',
  });
  const topics = await api(professor, '/api/prof/topics');
  const updatedTopic = topics.items.find((item) => item.id === topic.id);
  assert.equal(updatedTopic.title, 'Updated verification topic');
  assert.equal(updatedTopic.summary, 'Updated summary');

  const candidate = database.one(`
    SELECT Student.id FROM Student
    LEFT JOIN Thesis ON Thesis.studentId = Student.id
    WHERE Thesis.id IS NULL ORDER BY Student.am LIMIT 1
  `);
  assert.ok(candidate);
  const assignment = await api(professor, '/api/prof/assign', 'POST', {
    studentId: candidate.id,
    topicId: topic.id,
  });
  await api(professor, '/api/thesis/transition', 'POST', {
    thesisId: assignment.id,
    action: 'cancel_initial',
  });
  assert.equal(database.one('SELECT id FROM Thesis WHERE id = ?', assignment.id), null);

  const originalProfile = await api(student, '/api/student/profile');
  await api(student, '/api/student/profile', 'PATCH', {
    ...originalProfile,
    address: 'Integration test address',
  });
  const updatedProfile = await api(student, '/api/student/profile');
  assert.equal(updatedProfile.address, 'Integration test address');
});

test('complete thesis lifecycle works through the Node.js HTTP API', async () => {
  const supervisor = await login('prof001@uni.local', '/prof');
  const member2 = await login('prof002@uni.local', '/prof');
  const member3 = await login('prof003@uni.local', '/prof');
  const secretariat = await login('sec@uni.local', '/admin');

  const candidate = database.one(`
    SELECT Student.id, User.email FROM Student
    JOIN User ON User.id = Student.userId
    LEFT JOIN Thesis ON Thesis.studentId = Student.id
    WHERE Thesis.id IS NULL ORDER BY Student.am LIMIT 1
  `);
  assert.ok(candidate, 'Seed data must include one student without a thesis.');
  const student = await login(candidate.email, '/student');

  const topic = await api(supervisor, '/api/prof/topics', 'POST', {
    title: 'Node.js integration test topic', summary: 'Created in an isolated test database.',
  });
  const assignment = await api(supervisor, '/api/prof/assign', 'POST', { studentId: candidate.id, topicId: topic.id });
  const thesisId = assignment.id;

  const invitations = await api(student, '/api/committee/invitations', 'POST', { professorCodes: ['P002', 'P003'] });
  assert.equal(invitations.created.length, 2);
  const invitationRows = database.all(`
    SELECT CommitteeInvitation.id, Professor.code FROM CommitteeInvitation
    JOIN Professor ON Professor.id = CommitteeInvitation.professorId
    WHERE CommitteeInvitation.thesisId = ? ORDER BY Professor.code
  `, thesisId);
  await api(member2, '/api/committee/invitations', 'PATCH', { id: invitationRows.find((row) => row.code === 'P002').id, action: 'accept' });
  await api(member3, '/api/committee/invitations', 'PATCH', { id: invitationRows.find((row) => row.code === 'P003').id, action: 'accept' });
  assert.equal(database.one('SELECT status FROM Thesis WHERE id = ?', thesisId).status, 'ACTIVE');

  const prematurePresentation = await rawRequest('/api/student/presentation', {
    method: 'POST',
    headers: { Cookie: student.cookie, 'X-CSRF-Token': student.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: new Date(Date.now() + 86_400_000).toISOString(), title: 'Too early', mode: 'IN_PERSON', room: 'A1' }),
  });
  assert.equal(prematurePresentation.status, 409);

  const secretariatTransition = await rawRequest('/api/admin/theses', {
    method: 'PATCH',
    headers: { Cookie: secretariat.cookie, 'X-CSRF-Token': secretariat.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ thesisId, action: 'to_under_exam' }),
  });
  assert.equal(secretariatTransition.status, 400);
  assert.equal(database.one('SELECT status FROM Thesis WHERE id = ?', thesisId).status, 'ACTIVE');

  await api(supervisor, '/api/thesis/transition', 'POST', { thesisId, action: 'to_under_exam' });
  assert.equal(database.one('SELECT status FROM Thesis WHERE id = ?', thesisId).status, 'UNDER_EXAM');
  const prematureRecord = await rawRequest(`/api/theses/${thesisId}/exam-record`, { headers: { Cookie: student.cookie } });
  assert.equal(prematureRecord.status, 409);
  await api(student, '/api/student/presentation', 'POST', {
    date: new Date(Date.now() + 86_400_000).toISOString(), title: 'Integration presentation', mode: 'IN_PERSON', room: 'A1',
  });
  await api(supervisor, '/api/thesis/transition', 'POST', { thesisId, action: 'open_grading' });

  for (const [session, score] of [[supervisor, 8], [member2, 9], [member3, 10]]) {
    await api(session, '/api/grades', 'POST', {
      thesisId, comments: 'Automated integration grade', criteria: { written: score, presentation: score, overall: score },
    });
  }
  const examRecord = await rawRequest(`/api/theses/${thesisId}/exam-record`, { headers: { Cookie: student.cookie } });
  assert.equal(examRecord.status, 200);
  const examRecordHtml = await examRecord.text();
  assert.match(examRecordHtml, /Final grade/);
  assert.match(examRecordHtml, /\/static\/js\/exam-record\.js/);
  assert.doesNotMatch(examRecordHtml, /onclick=/);
  await api(student, '/api/student/final-repository', 'POST', { url: 'https://nemertes.library.example/thesis-test' });
  await api(secretariat, '/api/admin/theses', 'PATCH', { thesisId, action: 'complete' });

  const completed = database.one('SELECT status, finalRepositoryUrl FROM Thesis WHERE id = ?', thesisId);
  assert.equal(completed.status, 'COMPLETED');
  assert.match(completed.finalRepositoryUrl, /^https:/);
  assert.equal(database.one('SELECT COUNT(*) AS count FROM Grade WHERE thesisId = ?', thesisId).count, 3);
});

test('secretariat imports support validation-only mode without changing data', async () => {
  const secretariat = await login('sec@uni.local', '/admin');
  const before = database.one('SELECT COUNT(*) AS count FROM Student').count;
  const result = await api(secretariat, '/api/admin/import/people?dryRun=1', 'POST', {
    students: [{ am: 'TEST-DRY-RUN', firstName: 'Test', lastName: 'Student', email: 'dry-run@example.test' }],
    professors: [],
  });
  assert.equal(result.report.students.inserted, 1);
  assert.equal(database.one('SELECT COUNT(*) AS count FROM Student').count, before);
});

test('required database indexes are present', () => {
  const indexes = new Set(database.all("SELECT name FROM sqlite_master WHERE type = 'index'").map((row) => row.name));
  for (const name of ['Topic_supervisor_status_idx', 'Thesis_status_created_idx', 'CommitteeInvitation_professor_status_idx', 'PresentationDetails_date_idx']) {
    assert.ok(indexes.has(name), `Missing index: ${name}`);
  }
});
