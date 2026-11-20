function createWaitingRoomService({ getGroupForStudent }) {
  async function getWaitingRoom(studentId) {
    if (typeof studentId !== 'string' || !studentId) {
      const error = new Error('Student ID is required');
      error.status = 400;
      throw error;
    }

    const group = await getGroupForStudent(studentId);

    // Student has joined the lobby but has not been assigned yet.
    if (!group) {
      return {
        assigned: false,
        status: 'waiting-for-group',
        groupId: null,
        myId: studentId,
        students: [],
        instructions: [],
      };
    }

    return {
      assigned: true,
      status: 'waiting-for-teacher',
      groupId: group.groupId,
      myId: studentId,
      students: group.students,
      instructions: [
        {
          title: 'How to play',
          body: 'Each player adds one sentence at a time. Build on what came before!',
        },
        {
          title: 'On your turn',
          body: 'Your box lights up when it is your turn. Keep your sentence short.',
        },
        {
          title: 'Have fun',
          body: 'There are no wrong answers. Silly stories are welcome.',
        },
      ],
    };
  }

  return {
    getWaitingRoom,
  };
}

module.exports = {
  createWaitingRoomService,
};