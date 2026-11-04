const {
  createRandomBreakoutRooms,
} = require('../src/randomBreakoutRooms');

describe('random breakout rooms', () => {
  const students = [
    'student1',
    'student2',
    'student3',
    'student4',
    'student5',
    'student6',
  ];

  test('creates the requested number of rooms', () => {
    const rooms = createRandomBreakoutRooms(students, 3);

    expect(rooms).toHaveLength(3);
  });

  test('assigns every student exactly once', () => {
    const rooms = createRandomBreakoutRooms(students, 2);

    const assigned = rooms.flatMap(
      (room) => room.studentIds
    );

    expect(assigned).toHaveLength(students.length);
    expect(new Set(assigned).size).toBe(students.length);
  });

  test('creates balanced rooms', () => {
    const rooms = createRandomBreakoutRooms(students, 2);

    const sizes = rooms.map(
      (room) => room.studentIds.length
    );

    expect(
      Math.max(...sizes) - Math.min(...sizes)
    ).toBeLessThanOrEqual(1);
  });

  test('rejects too many rooms', () => {
    expect(() =>
      createRandomBreakoutRooms(students, 4)
    ).toThrow();
  });
});