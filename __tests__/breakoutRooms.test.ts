import { describe, expect, test } from "@jest/globals";

import {
  Lobby,
  replaceBreakoutRooms,
  validateBreakoutRooms,
} from "../lib/breakoutRooms";

function createTestLobby(): Lobby {
  return {
    lobbyId: "lobby1",
    teacherId: "teacher1",
    students: [
      { id: "student1", name: "Alex" },
      { id: "student2", name: "Jordan" },
      { id: "student3", name: "Taylor" },
      { id: "student4", name: "Morgan" },
    ],
    breakoutRooms: [],
  };
}

describe("breakout room assignments", () => {
  test("allows a teacher to assign valid students to rooms", () => {
    const lobby = createTestLobby();

    const result = replaceBreakoutRooms(lobby, "teacher1", [
      {
        roomId: "group1",
        roomName: "Group 1",
        studentIds: ["student1", "student2"],
      },
      {
        roomId: "group2",
        roomName: "Group 2",
        studentIds: ["student3", "student4"],
      },
    ]);

    expect(result.success).toBe(true);
    expect(lobby.breakoutRooms).toHaveLength(2);
  });

  test("rejects someone who is not the lobby teacher", () => {
    const lobby = createTestLobby();

    const result = validateBreakoutRooms(lobby, "wrongTeacher", [
      {
        roomId: "group1",
        roomName: "Group 1",
        studentIds: ["student1", "student2"],
      },
    ]);

    expect(result.valid).toBe(false);
  });

  test("rejects a student who does not belong to the lobby", () => {
    const lobby = createTestLobby();

    const result = validateBreakoutRooms(lobby, "teacher1", [
      {
        roomId: "group1",
        roomName: "Group 1",
        studentIds: ["student1", "student99"],
      },
    ]);

    expect(result.valid).toBe(false);
  });

  test("rejects duplicate student assignments", () => {
    const lobby = createTestLobby();

    const result = validateBreakoutRooms(lobby, "teacher1", [
      {
        roomId: "group1",
        roomName: "Group 1",
        studentIds: ["student1", "student2"],
      },
      {
        roomId: "group2",
        roomName: "Group 2",
        studentIds: ["student1", "student3"],
      },
    ]);

    expect(result.valid).toBe(false);
  });

  test("rejects a breakout room with fewer than two students", () => {
    const lobby = createTestLobby();

    const result = validateBreakoutRooms(lobby, "teacher1", [
      {
        roomId: "group1",
        roomName: "Group 1",
        studentIds: ["student1"],
      },
    ]);

    expect(result.valid).toBe(false);
  });

  test("allows students to remain unassigned", () => {
    const lobby = createTestLobby();

    const result = replaceBreakoutRooms(lobby, "teacher1", [
      {
        roomId: "group1",
        roomName: "Group 1",
        studentIds: ["student1", "student2"],
      },
    ]);

    expect(result.success).toBe(true);
    expect(lobby.breakoutRooms[0].studentIds).not.toContain("student3");
    expect(lobby.breakoutRooms[0].studentIds).not.toContain("student4");
  });
});