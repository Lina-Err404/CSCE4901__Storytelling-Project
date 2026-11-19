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

// createLobbyService function.
// Makes the getClass and createLobby functions
function createLobbyService({ db, generateCode = createCode }) {
  async function getClass(classId) {
    const { data, error } = await supabase
      .from('classes')
      .select()
      .eq('class_id', classId);
    if (error !== null && data.length === 0) {
      return error;
    }
    else {
        return data;
    }
  }

  async function createLobby(teacherId, classId, maxPlayers = 500) {    
    // Tests function parameters to make sure data is valid
    if (typeof teacherId !== 'string' || !teacherId || typeof classId !== 'string' || !classId) {
      throw createServiceError('teacherId and classId are required', 400);
    }
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1) {
      throw createServiceError('maxPlayers must be a positive integer', 400);
    }

    // Creates class data variable
    let classData;
    try {
      const { data, error } = await supabase
          .from('classes')
          .select()
          .eq('class_id', classId);
      classData = data;
    } catch (error) {
      throw createServiceError('Could not verify class ownership', 500);
    }
    if (!classData || classData.teacherId !== teacherId) {
      throw createServiceError('Class not found for this teacher', 403);
    }

    // Attempts to create a lobby code.
    // does not attempt more than 5 times
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
          //minWords,
          //maxWords,
          //maxPlayers,
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

    // joinLobby function allows student to join
    // takes requesting student's ID and lobby code
  async function joinLobby(studentId, requestedCode) {
    // Checks validity of funct params
    if (typeof studentId !== 'string' || !studentId || typeof requestedCode !== 'string') {
      throw createServiceError('Student identity and lobby code are required', 400);
    }
    const code = requestedCode.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) throw createServiceError('Lobby not found', 404);

    try {
      // Gets lobby
      const { data1, error1 } = await supabase
      .from('lobbies')
      .select()
      .eq('join_code', code);
      const lobby = data1;
      
      /* // Possible issue with getting lobby status
      // Gets lobby status
      const { data, error } = await supabase
      .from('lobbies')
      .select('status')
      .eq('join_code', code);
      const lobbystatus = data;
      // Gets lobby classID
      const { data, error } = await supabase
      .from('lobbies')
      .select('class_id')
      .eq('join_code', code);
      const lobbyclassId = data; */
      
      if (!lobby || lobby.status !== 'open') throw createServiceError('Lobby not found', 404);
      if (typeof lobby.class_id !== 'string' || !lobbyclassId) {
        throw createServiceError('Lobby has no class assigned', 409);
      }

      // get class roster
      const { data2, error2 } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', lobby.class_id);
      const roster = data2;
      if (!roster.some((student) => student.studentId === studentId)) {
        throw createServiceError('Student is not enrolled in this class', 403);
      }

      // Player joins lobby
      const { data3, error3 } = await supabase
      .from('lobby_participants')
      .insert({ lobby_id: lobby, student_id: studentId, status: 'joined' })
      .select()
      const result = data3;

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