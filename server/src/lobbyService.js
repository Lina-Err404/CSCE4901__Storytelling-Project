const crypto = require('crypto');
const { createSupabaseStore } = require('./store');

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

/*function createLobbyService({ db, generateCode = createCode }) {
  async function getClass(classId, transaction) {
    const ref = db.collection('classes').doc(classId);
    const snapshot = transaction ? await transaction.get(ref) : await ref.get();
    return snapshot.exists ? snapshot.data() : null;
} }*/



function createLobbyService({ db, generateCode = createCode }) {
  async function createLobby(teacherId, classId, maxPlayers = 500) {    
    if (typeof teacherId !== 'string' || !teacherId || typeof classId !== 'string' || !classId) {
      throw createServiceError('teacherId and classId are required', 400);
    }
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1) {
      throw createServiceError('maxPlayers must be a positive integer', 400);
    }

    let classData;
    try {
      classData = await db.getClass(classId);
    } catch (error) {
      throw createServiceError('Could not verify class ownership', 500);
    }
    if (!classData || classData.teacherId !== teacherId) {
      throw createServiceError('Class not found for this teacher', 403);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
        throw createServiceError('Join-code generator returned an invalid code', 500);
      }

      //const lobbyRef = db.collectionName('lobbies').doc(code);
      try {
        await db.createLobby({
          hostId: teacherId,
          classId,
          code,
          gamemode,
          minWords,
          maxWords,
          maxPlayers,
          // Commented out because not currently added here
          //playerCount: 0,
          //status: 'open',
          //participantIds: [],
        });
        return code;
      } catch (error) {
        if (error.code === '23505') continue;
        throw createServiceError('Could not create lobby', 500);
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

    try {
      const lobby = await db.getLobbyByCode(code);
      if (!lobby || lobby.status !== 'open') throw createServiceError('Lobby not found', 404);
      if (typeof lobby.classId !== 'string' || !lobby.classId) {
        throw createServiceError('Lobby has no class assigned', 409);
      }

      const roster = await db.listRoster(lobby.classId);
      if (!roster.some((student) => student.studentId === studentId)) {
        throw createServiceError('Student is not enrolled in this class', 403);
      }

      const result = await db.joinLobby({
        lobbyId: lobby.lobbyId,
        studentId,
        displayName: 'Student',
      });
      return {
        code,
        playerCount: result.playerCount,
        alreadyJoined: Boolean(result.alreadyJoined),
      };
    } catch (error) {
      if (Number.isInteger(error?.status)) throw error;
      if (error?.code === 'P0001') throw createServiceError('Lobby is full', 409);
      if (error?.code === '42501') throw createServiceError('Student is not enrolled in this class', 403);
      throw createServiceError('Could not join lobby', 500);
    }
  }

  return { createLobby, joinLobby };
}

let defaultService;
function getDefaultService() {
  if (!defaultService) {
    const { supabase } = require('./supabase');
    defaultService = createLobbyService({ db: createSupabaseStore(supabase) });
  }
  return defaultService;
}

module.exports = {
  createLobbyService,
  createLobby: (...args) => getDefaultService().createLobby(...args),
  joinLobby: (...args) => getDefaultService().joinLobby(...args),
};
 