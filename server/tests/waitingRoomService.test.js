const {
  createWaitingRoomService,
} = require('../src/waitingRoomService');

describe('R40 waiting room service', () => {
  test('returns the student group and members', async () => {
    const getGroupForStudent = jest.fn().mockResolvedValue({
      groupId: 'group-1',
      students: [
        { id: 'student-1', name: 'Ezra' },
        { id: 'student-2', name: 'Alessia' },
        { id: 'student-3', name: 'Priya' },
      ],
    });

    const service = createWaitingRoomService({
      getGroupForStudent,
    });

    const result = await service.getWaitingRoom('student-2');

    expect(result.assigned).toBe(true);
    expect(result.groupId).toBe('group-1');
    expect(result.myId).toBe('student-2');
    expect(result.students).toHaveLength(3);
  });

  test('only returns the group supplied for that student', async () => {
    const getGroupForStudent = jest.fn().mockResolvedValue({
      groupId: 'group-2',
      students: [
        { id: 'student-4', name: 'Jordan' },
        { id: 'student-5', name: 'Maya' },
      ],
    });

    const service = createWaitingRoomService({
      getGroupForStudent,
    });

    const result = await service.getWaitingRoom('student-4');

    expect(result.groupId).toBe('group-2');
    expect(result.students).toEqual([
      { id: 'student-4', name: 'Jordan' },
      { id: 'student-5', name: 'Maya' },
    ]);
  });

  test('returns a waiting state when student is not assigned yet', async () => {
    const getGroupForStudent = jest.fn().mockResolvedValue(null);

    const service = createWaitingRoomService({
      getGroupForStudent,
    });

    const result = await service.getWaitingRoom('student-1');

    expect(result.assigned).toBe(false);
    expect(result.status).toBe('waiting-for-group');
    expect(result.groupId).toBeNull();
    expect(result.students).toEqual([]);
  });

  test('includes activity instructions for assigned students', async () => {
    const getGroupForStudent = jest.fn().mockResolvedValue({
      groupId: 'group-1',
      students: [
        { id: 'student-1', name: 'Ezra' },
        { id: 'student-2', name: 'Alessia' },
      ],
    });

    const service = createWaitingRoomService({
      getGroupForStudent,
    });

    const result = await service.getWaitingRoom('student-1');

    expect(result.instructions.length).toBeGreaterThan(0);
    expect(result.instructions[0]).toHaveProperty('title');
    expect(result.instructions[0]).toHaveProperty('body');
  });

  test('rejects a missing student ID', async () => {
    const getGroupForStudent = jest.fn();

    const service = createWaitingRoomService({
      getGroupForStudent,
    });

    await expect(
      service.getWaitingRoom('')
    ).rejects.toThrow('Student ID is required');
  });
});