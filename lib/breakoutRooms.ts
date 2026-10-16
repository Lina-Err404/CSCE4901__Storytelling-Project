export type Student = {
  id: string;
  name: string;
};

export type BreakoutRoom = {
  roomId: string;
  roomName: string;
  studentIds: string[];
};

export type Lobby = {
  lobbyId: string;
  teacherId: string;
  students: Student[];
  breakoutRooms: BreakoutRoom[];
};

export function validateBreakoutRooms(
  lobby: Lobby,
  teacherId: string,
  rooms: BreakoutRoom[]
) {
  // Only the teacher who owns the lobby can update breakout rooms.
  if (lobby.teacherId !== teacherId) {
    return {
      valid: false,
      error: "You do not have permission to manage this lobby.",
    };
  }

  const validStudentIds = new Set(
    lobby.students.map((student) => student.id)
  );

  const assignedStudentIds = new Set<string>();

  for (const room of rooms) {
    // Every room needs a valid name and ID.
    if (!room.roomId?.trim() || !room.roomName?.trim()) {
      return {
        valid: false,
        error: "Each breakout room must have a valid ID and name.",
      };
    }

    // Breakout rooms require at least 2 students.
    if (room.studentIds.length < 2) {
      return {
        valid: false,
        error: "Each breakout room must contain at least 2 students.",
      };
    }

    for (const studentId of room.studentIds) {
      // Student must already belong to the lobby.
      if (!validStudentIds.has(studentId)) {
        return {
          valid: false,
          error: `Student ${studentId} is not in this lobby.`,
        };
      }

      // A student cannot be placed in two rooms at once.
      if (assignedStudentIds.has(studentId)) {
        return {
          valid: false,
          error: `Student ${studentId} is assigned more than once.`,
        };
      }

      assignedStudentIds.add(studentId);
    }
  }

  return { valid: true };
}

export function replaceBreakoutRooms(
  lobby: Lobby,
  teacherId: string,
  rooms: BreakoutRoom[]
) {
  const validation = validateBreakoutRooms(
    lobby,
    teacherId,
    rooms
  );

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Replace all existing assignments with the teacher's new arrangement.
  lobby.breakoutRooms = rooms;

  return {
    success: true,
    message: "Breakout rooms updated successfully.",
    rooms: lobby.breakoutRooms,
  };
}