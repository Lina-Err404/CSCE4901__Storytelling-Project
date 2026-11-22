function createRandomBreakoutRooms(studentIds, roomCount) {
  if (!Array.isArray(studentIds)) {
    const error = new Error('Student list must be an array');
    error.status = 400;
    throw error;
  }

  if (!Number.isInteger(roomCount) || roomCount < 1) {
    const error = new Error('roomCount must be a positive integer');
    error.status = 400;
    throw error;
  }

  if (studentIds.length < roomCount * 2) {
    const error = new Error(
      'There must be at least 2 students in each breakout room'
    );
    error.status = 400;
    throw error;
  }

  // Copy the list so the original lobby data is not changed.
  const shuffled = [...studentIds];

  // Fisher-Yates shuffle.
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i],
    ];
  }

  const rooms = Array.from({ length: roomCount }, (_, index) => ({
    roomId: `group${index + 1}`,
    roomName: `Group ${index + 1}`,
    studentIds: [],
  }));

  shuffled.forEach((studentId, index) => {
    rooms[index % roomCount].studentIds.push(studentId);
  });

  return rooms;
}

module.exports = { createRandomBreakoutRooms };