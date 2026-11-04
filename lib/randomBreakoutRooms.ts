import type {
  BreakoutRoom,
  Student,
} from "./breakoutRooms";

export function randomlyAssignStudents(
  students: Student[],
  roomCount: number
): BreakoutRoom[] {
  // Room count must be a positive whole number.
  if (!Number.isInteger(roomCount) || roomCount < 1) {
    throw new Error("Room count must be at least 1.");
  }

  // Every room must have at least 2 students.
  if (students.length < roomCount * 2) {
    throw new Error(
      "There are not enough students to place at least 2 students in each room."
    );
  }

  // Copy the array so we do not modify the original student list.
  const shuffledStudents = [...students];

  // Fisher-Yates shuffle.
  for (let i = shuffledStudents.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1)
    );

    [
      shuffledStudents[i],
      shuffledStudents[randomIndex],
    ] = [
      shuffledStudents[randomIndex],
      shuffledStudents[i],
    ];
  }

  // Create the requested number of rooms.
  const rooms: BreakoutRoom[] = Array.from(
    { length: roomCount },
    (_, index) => ({
      roomId: `group${index + 1}`,
      roomName: `Group ${index + 1}`,
      studentIds: [],
    })
  );

  // Spread students across rooms as evenly as possible.
  shuffledStudents.forEach((student, index) => {
    rooms[index % roomCount].studentIds.push(student.id);
  });

  return rooms;
}