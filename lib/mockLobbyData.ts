import { Lobby } from "./breakoutRooms";

// Temporary mock lobby data for Sprint 1.
// This can later be replaced with Firebase/Firestore data.
export const mockLobbies: Lobby[] = [
  {
    lobbyId: "lobby1",
    teacherId: "teacher1",
    students: [
      { id: "student1", name: "Alex" },
      { id: "student2", name: "Jordan" },
      { id: "student3", name: "Taylor" },
      { id: "student4", name: "Morgan" },
    ],
    breakoutRooms: [],
  },
];

export function getLobbyById(lobbyId: string) {
  return mockLobbies.find((lobby) => lobby.lobbyId === lobbyId);
}