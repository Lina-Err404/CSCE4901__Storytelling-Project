function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

function mapClass(row) {
  return {
    classId: row.class_id,
    teacherId: row.teacher_id,
    name: row.name,
    activeLobbyId: row.active_lobby_id,
    createdAt: row.created_at,
  };
}

function mapLobby(row) {
  return {
    lobbyId: row.lobby_id,
    classId: row.class_id,
    joinCode: row.join_code,
    status: row.status === 'waiting' ? 'open' : row.status === 'active' ? 'locked' : 'closed',
    gameMode: row.game_mode || 'divide',
    minWords: row.min_words ?? 0,
    maxWords: row.max_words ?? 100,
    createdAt: row.created_at,
  };
}

function createSupabaseStore(supabase) {
  if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') {
    throw new Error('A configured Supabase client is required');
  }

  return {
    async createClass({ teacherId, name }) {
      const row = throwOnError(await supabase
        .from('classes')
        .insert({ teacher_id: teacherId, name })
        .select('class_id, teacher_id, name, active_lobby_id, created_at')
        .single());
      return mapClass(row);
    },

    async listClasses(teacherId) {
      const rows = throwOnError(await supabase
        .from('classes')
        .select('class_id, teacher_id, name, active_lobby_id, created_at')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: true }));
      return rows.map(mapClass);
    },

    async getClass(classId) {
      const row = throwOnError(await supabase
        .from('classes')
        .select('class_id, teacher_id, name, active_lobby_id, created_at')
        .eq('class_id', classId)
        .maybeSingle());
      return row ? mapClass(row) : null;
    },

    async listRoster(classId) {
      const rows = throwOnError(await supabase
        .from('class_students')
        .select('student_id, display_name')
        .eq('class_id', classId)
        .order('display_name', { ascending: true }));
      return rows.map(({ student_id, display_name }) => ({
        studentId: student_id,
        displayName: display_name,
      }));
    },

    async upsertRoster(classId, students) {
      return throwOnError(await supabase.rpc('r13_upsert_class_roster', {
        p_class_id: classId,
        p_students: students.map(({ studentId, displayName }) => ({
          student_id: studentId,
          display_name: displayName,
        })),
      }));
    },

    async deleteRosterStudent(classId, studentId) {
      return throwOnError(await supabase.rpc('r13_remove_roster_student', {
        p_class_id: classId,
        p_student_id: studentId,
      }));
    },

    async listLobbies(classId) {
      const rows = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id, class_id, join_code, status, game_mode, min_words, max_words, created_at')
        .eq('class_id', classId)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false }));
      return rows.map(mapLobby);
    },

    async getLobby(lobbyId) {
      const row = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id, class_id, join_code, status, game_mode, min_words, max_words, created_at')
        .eq('lobby_id', lobbyId)
        .maybeSingle());
      if (!row) return null;
      const schoolClass = await this.getClass(row.class_id);
      return { ...mapLobby(row), teacherId: schoolClass?.teacherId };
    },

    async createLobby({ teacherId, classId, joinCode, gameMode, minWords, maxWords, maxPlayers = 500 }) {
      return throwOnError(await supabase.rpc('r13_create_lobby', {
        p_teacher_id: teacherId,
        p_class_id: classId,
        p_join_code: joinCode,
        p_game_mode: gameMode,
        p_min_words: minWords,
        p_max_words: maxWords,
        p_max_players: maxPlayers,
      }));
    },

    async getLobbyByCode(joinCode) {
      const row = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id, class_id, join_code, status, game_mode, min_words, max_words, created_at')
        .eq('join_code', joinCode)
        .maybeSingle());
      return row ? mapLobby(row) : null;
    },

    async joinLobby({ lobbyId, studentId, displayName }) {
      return throwOnError(await supabase.rpc('r13_join_lobby', {
        p_lobby_id: lobbyId,
        p_student_id: studentId,
        p_display_name: displayName,
      }));
    },

    async getProfileDisplayName(studentId) {
      const row = throwOnError(await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', studentId)
        .maybeSingle());
      return row?.display_name || null;
    },

    async updateLobbyStatus(lobbyId, status) {
      return throwOnError(await supabase.rpc('r13_update_lobby_status', {
        p_lobby_id: lobbyId,
        p_status: status === 'open' ? 'waiting' : status === 'locked' ? 'active' : 'ended',
      }));
    },

    async listLobbyStudents(lobbyId) {
      const rows = throwOnError(await supabase
        .from('lobby_participants')
        .select('student_id, display_name, status')
        .eq('lobby_id', lobbyId)
        .not('status', 'in', '(kicked,removed)')
        .order('display_name', { ascending: true }));
      return rows.map(({ student_id, display_name }) => ({
        studentId: student_id,
        displayName: display_name || 'Student',
      }));
    },

    async kickLobbyStudent(lobbyId, studentId) {
      return throwOnError(await supabase.rpc('r13_kick_lobby_student', {
        p_lobby_id: lobbyId,
        p_student_id: studentId,
      }));
    },

    async getLobbySeat(lobbyId, studentId) {
      const row = throwOnError(await supabase
        .from('lobby_participants')
        .select('student_id, status')
        .eq('lobby_id', lobbyId)
        .eq('student_id', studentId)
        .maybeSingle());
      return row;
    },
  };
}

module.exports = { createSupabaseStore };
