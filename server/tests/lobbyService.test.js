const { createLobbyService } = require('../src/lobbyService');
const { createMemoryStore } = require('./helpers');

describe('Supabase lobby service', () => {
  let db;
  let service;
  let generatedCodes;

  beforeEach(async () => {
    db = createMemoryStore();
    generatedCodes = ['C3D4EF'];
    service = createLobbyService({ db, generateCode: () => generatedCodes.shift() });
    await db.seedClass({ classId: 'class-1', teacherId: 'teacher-1', name: 'Class One' });
    await db.seedStudent('class-1', { studentId: 'student-1', displayName: 'Student One' });
    await db.seedStudent('class-1', { studentId: 'student-2', displayName: 'Student Two' })
  });

  test('rejects the wrong teacher with 403', async () => {
    await expect(service.createLobby('teacher-2', 'class-1')).rejects.toMatchObject({ status: 403 });
  });

  test('retries join-code collisions and reports status 409 after five collisions', async () => {
    await db.setCode('C3D4EF', 'existing-lobby');
    await db.setCode('G5H6JK', 'existing-lobby');
    generatedCodes = ['C3D4EF', 'G5H6JK', 'M7N8PQ'];
    service = createLobbyService({ db, generateCode: () => generatedCodes.shift() });
    await expect(service.createLobby('teacher-1', 'class-1')).resolves.toBe('M7N8PQ');

    await db.updateLobbyStatus('lobby-1', 'closed');
    for (const code of ['R9S2TU', 'V3W4XY', 'Y5Z6AB', 'C7D8EF', 'G9H2JK']) {
      await db.setCode(code, 'existing-lobby');
    }
    generatedCodes = ['R9S2TU', 'V3W4XY', 'Y5Z6AB', 'C7D8EF', 'G9H2JK'];
    service = createLobbyService({ db, generateCode: () => generatedCodes.shift() });
    await expect(service.createLobby('teacher-1', 'class-1')).rejects.toMatchObject({ status: 409 });
  });

  test('creates a lobby and permits an enrolled student to join', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    expect(code).toBe('C3D4EF');
    const lobby = await db.getLobbyByCode(code);
    expect(lobby).toMatchObject({
      joinCode: code,
      status: 'open',
      teacherId: 'teacher-1',
      classId: 'class-1',
      maxWords: 100,
    });

    await expect(service.joinLobby('student-1', code)).resolves.toEqual({
      code,
      playerCount: 1,
      alreadyJoined: false,
    });
  });

  test('same student joins twice without incrementing twice', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    await service.joinLobby('student-1', code);
    await expect(service.joinLobby('student-1', code)).resolves.toEqual({
      code,
      playerCount: 1,
      alreadyJoined: true,
    });
    expect((await db.getLobbyByCode(code)).playerCount).toBe(1);
  });

  test('a second enrolled student joins and increments the count', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    await service.joinLobby('student-1', code);
    await expect(service.joinLobby('student-2', code)).resolves.toMatchObject({ playerCount: 2 });
  });

  test('rejects a non-enrolled student with 403', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    await expect(service.joinLobby('student-outsider', code)).rejects.toMatchObject({ status: 403 });
  });

  test('rejects a nonexistent code with 404', async () => {
    await expect(service.joinLobby('student-1', 'ZZZZZZ')).rejects.toMatchObject({ status: 404 });
  });

  test('rejects legacy lobby without a class with 409', async () => {
    await db.seedLobby({
      lobbyId: 'lobby-legacy',
      classId: null,
      teacherId: 'teacher-1',
      joinCode: 'B9WD4X',
      status: 'open',
    });
    await expect(service.joinLobby('student-1', 'B9WD4X')).rejects.toMatchObject({ status: 409 });
  });

  test('rejects a full lobby with 409', async () => {
    const code = await service.createLobby('teacher-1', 'class-1', 1);
    await service.joinLobby('student-1', code);
    await expect(service.joinLobby('student-2', code)).rejects.toMatchObject({ status: 409 });
  });

  test('rejects a closed lobby with 404', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    const lobbyId = await db.getCodeLobbyId(code);
    await db.updateLobbyStatus(lobbyId, 'closed');
    await expect(service.joinLobby('student-1', code)).rejects.toMatchObject({ status: 404 });
  });
});
