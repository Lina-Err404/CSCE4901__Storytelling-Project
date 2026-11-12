import { describe, expect, test } from "@jest/globals";

import { randomlyAssignStudents } from "../lib/randomBreakoutRooms";

import type { Student } from "../lib/breakoutRooms";

const students: Student[] = [
  { id: "student1", name: "Alex" },
  { id: "student2", name: "Jordan" },
  { id: "student3", name: "Taylor" },
  { id: "student4", name: "Morgan" },
  { id: "student5", name: "Sam" },
  { id: "student6", name: "Jamie" },
];

describe("random breakout room assignments", () => {
  test("creates the requested number of rooms", () => {
    const rooms = randomlyAssignStudents(students, 3);

    expect(rooms).toHaveLength(3);
  });

  test("assigns every student exactly once", () => {
    const rooms = randomlyAssignStudents(students, 2);

    const assignedStudents = rooms.flatMap(
      (room) => room.studentIds
    );

    expect(assignedStudents).toHaveLength(students.length);

    expect(new Set(assignedStudents).size).toBe(
      students.length
    );
  });

  test("keeps groups balanced", () => {
    const rooms = randomlyAssignStudents(students, 2);

    const sizes = rooms.map(
      (room) => room.studentIds.length
    );

    expect(
      Math.max(...sizes) - Math.min(...sizes)
    ).toBeLessThanOrEqual(1);
  });

  test("rejects invalid room counts", () => {
    expect(() =>
      randomlyAssignStudents(students, 0)
    ).toThrow();
  });

  test("rejects too many rooms", () => {
    expect(() =>
      randomlyAssignStudents(students, 4)
    ).toThrow();
  });
});