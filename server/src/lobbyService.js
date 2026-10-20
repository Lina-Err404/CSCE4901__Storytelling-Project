const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createCode() {
  let code = '';
  while (code.length < 6) {
    for (const byte of crypto.randomBytes(8)) {
      if (byte < 224) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === 6) break;
    }
  }
  return code;
}

function isCodeCollision(error) {
  return error?.code === 6 || error?.code === '6' || error?.code === 'already-exists';
}

function createLobbyService({ admin, db, generateCode = createCode }) {
  async function getClass(classId, transaction) {
    const ref = db.collection('classes').doc(classId);
    const snapshot = transaction ? await transaction.get(ref) : await ref.get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async function createLobby(teacherId, classId, maxPlayers = 4) {
    if (typeof teacherId !== 'string' || !teacherId || typeof classId !== 'string' || !classId) {
      throw createServiceError('teacherId and classId are required', 400);
    }
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1) {
      throw createServiceError('maxPlayers must be a positive integer', 400);
    }

    let classData;
    try {
      classData = await getClass(classId);
    } catch (error) {
      throw createServiceError('Could not verify class ownership', 500);
    }
    if (!classData || classData.teacherId !== teacherId) {
      throw createServiceError('Class not found for this teacher', 403);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      let code;
      try {
        code = generateCode();
      } catch (error) {
        throw createServiceError('Could not generate a lobby code', 500);
      }
      if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
        throw createServiceError('Join-code generator returned an invalid code', 500);
      }

      const lobbyRef = db.collection('Lobbies').doc(code);
      try {
        await lobbyRef.create({
          code,
          maxPlayers,
          playerCount: 0,
          status: 'open',
          hostId: teacherId,
          classId,
          participantIds: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return code;
      } catch (error) {
        if (!isCodeCollision(error)) {
          throw createServiceError('Could not create lobby', 500);
        }
      }
    }

    throw createServiceError('Could not allocate a unique lobby code', 409);
  }

  async function joinLobby(studentId, requestedCode) {
    if (typeof studentId !== 'string' || !studentId || typeof requestedCode !== 'string') {
      throw createServiceError('Student identity and lobby code are required', 400);
    }
    const code = requestedCode.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) throw createServiceError('Lobby not found', 404);

    const lobbyRef = db.collection('Lobbies').doc(code);
    try {
      return await db.runTransaction(async (transaction) => {
        const lobbySnapshot = await transaction.get(lobbyRef);
        if (!lobbySnapshot.exists || lobbySnapshot.data().status !== 'open') {
          throw createServiceError('Lobby not found', 404);
        }

        const lobby = lobbySnapshot.data();
        if (typeof lobby.classId !== 'string' || !lobby.classId) {
          throw createServiceError('Lobby has no class assigned', 409);
        }

        const classData = await getClass(lobby.classId, transaction);
        if (!Array.isArray(classData?.studentIds) || !classData.studentIds.includes(studentId)) {
          throw createServiceError('Student is not enrolled in this class', 403);
        }

        const participantIds = Array.isArray(lobby.participantIds) ? lobby.participantIds : [];
        const playerCount = Number.isInteger(lobby.playerCount) && lobby.playerCount >= 0
          ? lobby.playerCount
          : 0;
        if (participantIds.includes(studentId)) {
          return { code, playerCount, alreadyJoined: true };
        }

        if (!Number.isInteger(lobby.maxPlayers) || lobby.maxPlayers < 1 || playerCount >= lobby.maxPlayers) {
          throw createServiceError('Lobby is full', 409);
        }

        transaction.update(lobbyRef, {
          participantIds: admin.firestore.FieldValue.arrayUnion(studentId),
          playerCount: admin.firestore.FieldValue.increment(1),
        });
        return { code, playerCount: playerCount + 1, alreadyJoined: false };
      });
    } catch (error) {
      if (Number.isInteger(error?.status)) throw error;
      throw createServiceError('Could not join lobby', 500);
    }
  }

  return { createLobby, joinLobby };
}

let defaultService;
function getDefaultService() {
  if (!defaultService) {
    defaultService = createLobbyService(require('./firebase'));
  }
  return defaultService;
}

module.exports = {
  createLobbyService,
  createLobby: (...args) => getDefaultService().createLobby(...args),
  joinLobby: (...args) => getDefaultService().joinLobby(...args),
};