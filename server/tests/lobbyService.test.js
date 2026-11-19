const { createLobbyService } = require('../src/lobbyService');

function createFirestoreMock() {
  const records = new Map();
  const keyFor = (collection, id) => `${collection}/${id}`;
  const snapshot = (ref) => {
    const data = records.get(keyFor(ref.collectionName, ref.id));
    return { exists: data !== undefined, data: () => data && { ...data } };
  };

  function makeRef(collectionName, id) {
    return {
      collectionName,
      id,
      get: async () => snapshot({ collectionName, id }),
      create: async (data) => {
        const key = keyFor(collectionName, id);
        if (records.has(key)) {
          const error = new Error('Already exists');
          error.code = 6;
          throw error;
        }
        records.set(key, { ...data });
      },
      set: async (data) => records.set(keyFor(collectionName, id), { ...data }),
    };
  }

  const db = {
    collection: (name) => ({ doc: (id) => makeRef(name, id) }),
    runTransaction: async (callback) => {
      const updates = [];
      const transaction = {
        get: async (ref) => snapshot(ref),
        update: (ref, data) => updates.push({ ref, data }),
      };
      const result = await callback(transaction);
      for (const { ref, data } of updates) {
        const key = keyFor(ref.collectionName, ref.id);
        const next = { ...records.get(key) };
        for (const [field, value] of Object.entries(data)) {
          if (value?.operation === 'arrayUnion') {
            const current = Array.isArray(next[field]) ? next[field] : [];
            next[field] = [...new Set([...current, ...value.values])];
          } else if (value?.operation === 'increment') {
            next[field] = (Number.isInteger(next[field]) ? next[field] : 0) + value.value;
          } else {
            next[field] = value;
          }
        }
        records.set(key, next);
      }
      return result;
    },
    records,
  };

  const admin = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ operation: 'serverTimestamp' }),
        arrayUnion: (...values) => ({ operation: 'arrayUnion', values }),
        increment: (value) => ({ operation: 'increment', value }),
      },
    },
  };
  return { admin, db };
}

describe('lobby service with mocked Firestore', () => {
  let admin;
  let db;
  let service;
  let generatedCodes;

  beforeEach(async () => {
    ({ admin, db } = createFirestoreMock());
    generatedCodes = ['C3D4EF'];
    service = createLobbyService({ admin, db, generateCode: () => generatedCodes.shift() });
    await db.collection('classes').doc('class-1').set({
      teacherId: 'teacher-1',
      studentIds: ['student-1', 'student-2'],
    });
  });

  test('rejects the wrong teacher with 403', async () => {
    await expect(service.createLobby('teacher-2', 'class-1')).rejects.toMatchObject({ status: 403 });
  });

  test('retries collisions and reports status 409 after five collisions', async () => {
    const collisionCodes = ['C3D4EF', 'G5H6JK', 'M7N8PQ', 'R9S2TU', 'V3W4XY'];
    for (const code of collisionCodes.slice(0, 2)) {
      await db.collection('Lobbies').doc(code).create({ code });
    }

    generatedCodes = ['C3D4EF', 'G5H6JK', 'M7N8PQ'];
    service = createLobbyService({ admin, db, generateCode: () => generatedCodes.shift() });
    await expect(service.createLobby('teacher-1', 'class-1')).resolves.toBe('M7N8PQ');

    for (const code of collisionCodes.slice(3)) {
      await db.collection('Lobbies').doc(code).create({ code });
    }
    generatedCodes = collisionCodes;
    service = createLobbyService({ admin, db, generateCode: () => generatedCodes.shift() });
    await expect(service.createLobby('teacher-1', 'class-1')).rejects.toMatchObject({ status: 409 });
  });

  test('creates the specified Firestore schema and an enrolled student can join', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    expect(code).toBe('C3D4EF');
    expect(db.records.get(`Lobbies/${code}`)).toMatchObject({
      code,
      maxPlayers: 4,
      playerCount: 0,
      status: 'open',
      hostId: 'teacher-1',
      classId: 'class-1',
      participantIds: [],
    });

    await expect(service.joinLobby('student-1', code)).resolves.toEqual({
      code,
      playerCount: 1,
      alreadyJoined: false,
    });
  });

  test('same student joins twice successfully without incrementing twice', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    await service.joinLobby('student-1', code);
    await expect(service.joinLobby('student-1', code)).resolves.toEqual({
      code,
      playerCount: 1,
      alreadyJoined: true,
    });
    expect(db.records.get(`Lobbies/${code}`)).toMatchObject({
      playerCount: 1,
      participantIds: ['student-1'],
    });
  });

  test('a second enrolled student joins and increments the count', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    await service.joinLobby('student-1', code);
    await expect(service.joinLobby('student-2', code)).resolves.toMatchObject({ playerCount: 2 });
    expect(db.records.get(`Lobbies/${code}`).participantIds).toEqual(['student-1', 'student-2']);
  });

  test('rejects a non-enrolled student with 403', async () => {
    const code = await service.createLobby('teacher-1', 'class-1');
    await expect(service.joinLobby('student-outsider', code)).rejects.toMatchObject({ status: 403 });
  });

  test('rejects a nonexistent code with 404', async () => {
    await expect(service.joinLobby('student-1', 'ZZZZZZ')).rejects.toMatchObject({ status: 404 });
  });

  test('rejects legacy lobby B9WD4X without classId with 409', async () => {
    await db.collection('Lobbies').doc('B9WD4X').set({
      code: 'B9WD4X', maxPlayers: 4, playerCount: 0, status: 'open',
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
    db.records.get(`Lobbies/${code}`).status = 'closed';
    await expect(service.joinLobby('student-1', code)).rejects.toMatchObject({ status: 404 });
  });
});