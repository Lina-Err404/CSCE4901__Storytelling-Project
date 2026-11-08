const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateJoinCode } = require('../src/joinCode');
const { createRequireTeacher, createRequireStudent } = require('../src/auth');
const { toApiStatus } = require('../src/status');
function response() {
  return { statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; } };
}
function request(token = '') {
  return { get(name) { return name === 'authorization' && token ? `Bearer ${token}` : undefined; } };
}
function fakeProfileDb(role) {
  return { from(table) {
    assert.equal(table, 'profiles');
    return { select(column) {
      assert.equal(column, 'role');
      return { eq(field) {
        assert.equal(field, 'id');
        return { maybeSingle: async () => ({ data: role ? { role } : null, error: null }) };
      } };
    } };
  } };
}
function verifier(metadataRole = 'student') {
  return { auth: { getUser: async () => ({
    data: { user: { id: 'uid', email: 'user@example.com', app_metadata: { role: metadataRole } } }, error: null,
  }) } };
}
test('join codes use six allowed characters and are unique in a sample', () => {
  const codes = Array.from({ length: 1000 }, generateJoinCode);
  assert.equal(new Set(codes).size, 1000);
  codes.forEach((code) => assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/));
});
test('absent bearer token is rejected', async () => {
  const res = response();
  await createRequireTeacher(verifier(), fakeProfileDb('teacher'))(request(), res, () => assert.fail('unexpected next'));
  assert.equal(res.statusCode, 401);
});
test('teacher role comes from profiles, not misleading Auth metadata', async () => {
  const res = response();
  await createRequireTeacher(verifier('teacher'), fakeProfileDb('student'))
    (request('jwt'), res, () => assert.fail('unexpected next'));
  assert.equal(res.statusCode, 403);
});
test('teacher profile grants teacher route access', async () => {
  const req = request('jwt');
  let called = false;
  await createRequireTeacher(verifier('student'), fakeProfileDb('teacher'))(req, response(), () => { called = true; });
  assert.ok(called);
  assert.deepEqual(req.user, { uid: 'uid', email: 'user@example.com', role: 'teacher' });
});
test('student route accepts registered students', async () => {
  const req = request('jwt');
  let called = false;
  await createRequireStudent(verifier(), fakeProfileDb('student'))(req, response(), () => { called = true; });
  assert.ok(called);
  assert.equal(req.user.role, 'student');
});
test('database lobby states translate to the existing R12 UI statuses', () => {
  assert.equal(toApiStatus('waiting'), 'open');
  assert.equal(toApiStatus('active'), 'locked');
  assert.equal(toApiStatus('closed'), 'closed');
});
