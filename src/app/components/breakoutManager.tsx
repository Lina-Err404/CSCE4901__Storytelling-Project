"use client";

import { BreakoutRoom, Lobby } from "@/lib/breakoutRooms";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../supabase-lobbies/supabase-client";

export default function BreakoutManager({ lobby }: { lobby: Lobby }) {
  const [rooms, setRooms] = useState<BreakoutRoom[]>([]);
  const [roomCount, setRoomCount] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const url = `/api/supabase/lobbies/${encodeURIComponent(
    lobby.lobbyId
  )}/breakout-rooms`;

  async function getAccessToken() {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    const token = data.session?.access_token;

    if (!token) {
      throw new Error("You must be signed in as a teacher.");
    }

    return token;
  }

  // Load any rooms that have already been saved.
  useEffect(() => {
    let cancelled = false;

    async function loadRooms() {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok || data.success === false) {
          throw new Error(
            data.error ?? "Rooms failed to load."
          );
        }

        const list: BreakoutRoom[] = Array.isArray(data.rooms)
          ? data.rooms.map((room: BreakoutRoom) => ({
              roomId: String(room.roomId ?? ""),
              roomName: String(room.roomName ?? "Room"),
              studentIds: Array.isArray(room.studentIds)
                ? room.studentIds
                : [],
            }))
          : [];

        if (!cancelled) {
          setRooms(list);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Rooms failed to load."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Stores the teacher's selections before they are saved.
  const updateRooms = (next: BreakoutRoom[]) => {
    setRooms(next);
    setDirty(true);
  };

  // Save the final room assignments to Supabase.
  const submitRooms = async () => {
    setSaving(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rooms,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        throw new Error(
          data.error ?? "Failed to save breakout rooms."
        );
      }

      setDirty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to save breakout rooms."
      );
    } finally {
      setSaving(false);
    }
  };

  const assignedIds = new Set(
    rooms.flatMap((room) => room.studentIds)
  );

  const unassigned = lobby.students.filter(
    (student) => !assignedIds.has(student.id)
  );

  // Add another room.
  const addRoom = () => {
    const usedNumbers = rooms.map((room) => {
      const match = /^Room (\d+)$/.exec(room.roomName);
      return match ? Number(match[1]) : 0;
    });

    const nextNumber = Math.max(0, ...usedNumbers) + 1;

    updateRooms([
      ...rooms,
      {
        roomId: crypto.randomUUID(),
        roomName: `Room ${nextNumber}`,
        studentIds: [],
      },
    ]);
  };

  // Create the initial rooms.
  const createRooms = () =>
    updateRooms(
      Array.from({ length: roomCount }, (_, i) => ({
        roomId: crypto.randomUUID(),
        roomName: `Room ${i + 1}`,
        studentIds: [],
      }))
    );

  // Delete a room.
  const removeRoom = (roomId: string) =>
    updateRooms(
      rooms.filter((room) => room.roomId !== roomId)
    );

  // Move a student between rooms or remove them.
  const moveStudent = (
    studentId: string,
    roomId: string | null
  ) =>
    updateRooms(
      rooms.map((room) => {
        const without = room.studentIds.filter(
          (id) => id !== studentId
        );

        return room.roomId === roomId
          ? {
              ...room,
              studentIds: [...without, studentId],
            }
          : {
              ...room,
              studentIds: without,
            };
      })
    );

  const nameOf = (id: string) =>
    lobby.students.find((student) => student.id === id)
      ?.name ?? id;

  const tooSmall = rooms.some(
    (room) => room.studentIds.length < 2
  );

  // Randomly assign students into balanced rooms with valid UUID roomIds.
  const handleRandomlyAssignStudents = async () => {
  try {
    setSaving(true);
    setError(null);

    const token = await getAccessToken();

    // If rooms already exist, use the current number of rooms.
    // Otherwise use the number selected by the teacher.
    const count = rooms.length > 0 ? rooms.length : roomCount;

    const randomUrl = `/api/supabase/lobbies/${encodeURIComponent(
      lobby.lobbyId
    )}/breakout-rooms/random`;

    const res = await fetch(randomUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomCount: count,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      throw new Error(
        data.error ?? "Failed to randomly assign students."
      );
    }

    const nextRooms: BreakoutRoom[] = Array.isArray(data.rooms)
      ? data.rooms.map((room: BreakoutRoom) => ({
          roomId: String(room.roomId ?? ""),
          roomName: String(room.roomName ?? "Room"),
          studentIds: Array.isArray(room.studentIds)
            ? room.studentIds
            : [],
        }))
      : [];

    updateRooms(nextRooms);
  } catch (e) {
    setError(
      e instanceof Error
        ? e.message
        : "Failed to randomly assign students."
    );
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#0D0E2C] via-[#101E4A] to-[#134790] p-6">
      <div>
        <Link className="font-bold" href="/">
          {"←"} Return
        </Link>
      </div>

      <div className="min-h-screen w-full border-solid border-7 border-[#D9D9D9] p-10 text-center text-[#082A56] space-y-2">
        <h1 className="text-lg font-bold text-[#FFFFFF]">
          Breakout Room Assignment
        </h1>

        {error && (
          <p className="text-[#E73737]">{error}</p>
        )}

        {saving && <p>Saving...</p>}

        {tooSmall && rooms.length > 0 && (
          <p className="text-[#82C2D7]">
            Each room needs at least 2 students before
            saving.
          </p>
        )}

        {rooms.length === 0 && (
          <div>
            <input
              className="bg-[#F1E9DE] border-solid border-5 border-[#45B4D9] text-center py-1 px-1 text-[#000000]"
              type="number"
              min={1}
              max={Math.max(
                1,
                Math.floor(lobby.students.length / 2)
              )}
              value={roomCount}
              onChange={(e) => {
                const maxRooms = Math.max(
                  1,
                  Math.floor(lobby.students.length / 2)
                );

                const next = Math.min(
                  maxRooms,
                  Math.max(
                    1,
                    Number(e.target.value) || 1
                  )
                );

                setRoomCount(next);
              }}
            />{" "}
            <button
              className="bg-[#F1E9DE] border-solid border-5 border-[#45B4D9] text-center text-[#134790] py-1 px-1 font-bold"
              onClick={createRooms}
              disabled={saving}
            >
              Create Rooms
            </button>
          </div>
        )}

        <div className="space-x-4">
          <button
            className="bg-[#F1E9DE] border-solid border-5 border-[#F0B684] text-[#134780] text-center py-2 px-4 font-bold"
            onClick={addRoom}
            disabled={saving}
          >
            Add Room
          </button>

          <button
            className="bg-[#F1E9DE] border-solid border-5 border-[#B099E7] text-[#134780] text-center py-2 px-4 font-bold"
            onClick={handleRandomlyAssignStudents}
            disabled={saving}
          >
            Randomly Assigned Rooms
          </button>
        </div>

        <h3 className="font-semibold text-[#FFFFFF]">
          Unassigned Students
        </h3>

        {unassigned.length === 0 && (
          <p className="font-semibold text-[#FFFFFF]">
            All students are assigned to a group.
          </p>
        )}

        <ul>
          {unassigned.map((student) => (
            <li
              className="text-[#F1E9DE] p-2"
              key={student.id}
            >
              {student.name}{" "}
              <select
                className="bg-[#FFFFFF] py-1 px-1 text-center text-[#134780]"
                value=""
                onChange={(e) =>
                  e.target.value &&
                  moveStudent(
                    student.id,
                    e.target.value
                  )
                }
                disabled={
                  rooms.length === 0 || saving
                }
              >
                <option value="">
                  {rooms.length === 0
                    ? "Create a room first"
                    : "Assign to..."}
                </option>

                {rooms.map((room) => (
                  <option
                    key={room.roomId}
                    value={room.roomId}
                  >
                    {room.roomName}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        {rooms.map((room) => (
          <div
            key={room.roomId}
            className="text-[#F1E9DE]"
          >
            <h3>
              {room.roomName}{" "}
              <button
                className="bg-[#F1E9DE] border-solid border-5 border-[#E2ACAC] py-1 px-2 text-center text-[#134780]"
                onClick={() =>
                  removeRoom(room.roomId)
                }
              >
                Delete Room
              </button>
            </h3>

            {room.studentIds.length === 0 && (
              <p>No students yet...</p>
            )}

            <ul>
              {room.studentIds.map((id) => (
                <li key={id}>
                  {nameOf(id)}{" "}
                  <select
                    value={room.roomId}
                    onChange={(e) =>
                      moveStudent(
                        id,
                        e.target.value
                      )
                    }
                    disabled={saving}
                  >
                    {rooms.map((targetRoom) => (
                      <option
                        key={targetRoom.roomId}
                        value={targetRoom.roomId}
                        className="text-[#134780]"
                      >
                        {targetRoom.roomName}
                      </option>
                    ))}
                  </select>{" "}
                  <button
                    className="font-semibold text-[#E2ACAC] py-1"
                    onClick={() =>
                      moveStudent(id, null)
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <button
          className="bg-[#F1E9DE] text-[#134780] border-solid border-7 border-[#F3B457] py-2 px-4"
          onClick={submitRooms}
          disabled={
            saving || !dirty || tooSmall
          }
        >
          Save Breakout Rooms
        </button>
      </div>
    </main>
  );
}