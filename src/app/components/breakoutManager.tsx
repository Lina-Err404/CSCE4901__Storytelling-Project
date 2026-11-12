"use client";
import { BreakoutRoom, Lobby } from "@/lib/breakoutRooms";
import { randomlyAssignStudents } from "@/lib/randomBreakoutRooms";
import { useState, useEffect } from "react";
import Link from 'next/link';


export default function BreakoutManager({ lobby }: {lobby: Lobby}) {
    const [ rooms, setRooms ] = useState<BreakoutRoom[]>([]);
    const [ roomCount, setRoomCount] = useState(2);
    const [ loading, setLoading] = useState(true);
    const [ saving, setSaving] = useState(false);
    const [ error, setError] = useState<string | null>(null);
    const [ dirty, setDirty] = useState(false);


    //once db is configured change to '/api/lobbies/${lobbyId}/breakout-rooms or something similar
    const url = `/api/lobbies/${encodeURIComponent(lobby.lobbyId)}/breakout-rooms`;
    
    
    // Uses GET to load rooms.
    useEffect(() => {
        let cancelled = false;

        fetch(url)
        .then(async (res) => {
            const data = await res.json();
            if(!res.ok || data.success === false) {
                throw new Error(data.error ?? "Rooms failed to load.")
            }
            return data;
        })
        .then((data) => {
            const list : BreakoutRoom[] = Array.isArray(data.rooms)
                ? data.rooms.map((r: BreakoutRoom) => ({
                    roomId: String(r.roomId ?? ""),
                    roomName: String(r.roomName ?? "Room"),
                    studentIds: Array.isArray(r.studentIds) ? r.studentIds : [],
                }))
                : [];
            if (!cancelled) setRooms(list);

        })
        .catch((e) => {
            if (!cancelled) setError(e.message);
        })
        .finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [url]);

    // Stores the teacher's selections prior to being saved and submitted.
    const updateRooms = (next: BreakoutRoom[]) => {
        setRooms(next);
        setDirty(true);
    };
    
    // Uses POST to send the teacher's final room selections.
    const submitRooms = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teacherId: lobby.teacherId,
                    rooms
                }), 
            });

            const data = await res.json().catch(() => ({}));
            
            if (!res.ok || data.success === false) {
                throw new Error(data.error ?? "Failed to save.");
            }
            setDirty(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

        

    const assignedIds = new Set(rooms.flatMap((r) => r.studentIds));
    const unassigned = lobby.students.filter((s) => !assignedIds.has(s.id));

    // Used for adding a room to the already existing list.
    const addRoom = () => {
        const usedNumbers = rooms.map((r) => {
            const match = /^Room (\d+)$/.exec(r.roomName);
            return match ? Number(match[1]) : 0;
        });
        const nextNumber = Math.max(0, ...usedNumbers) + 1;
        updateRooms([
            ...rooms,
            { roomId: crypto.randomUUID(), roomName: `Room ${nextNumber}`, studentIds: [] },
        ]);
    };

    // Used for intial creation of rooms.
    const createRooms = () => 
        updateRooms(
            Array.from({ length: roomCount }, (_, i) => ({
                roomId: crypto.randomUUID(),
                roomName: `Room ${i + 1}`,
                studentIds: [],
            }))
        );

    // Used for deleting a room.
    const removeRoom = (roomId: string) =>
        updateRooms(rooms.filter((r) => r.roomId !== roomId));

    // Used for moving a student to a different room.
    const moveStudent = (studentId: string, roomId: string | null) =>
        updateRooms(
            rooms.map((room) => {
               const without = room.studentIds.filter((id) => id !== studentId);
               return room.roomId === roomId
               ? { ...room, studentIds: [...without, studentId] }
               : { ...room, studentIds: without };
            })
        );


    const nameOf = (id: string) => lobby.students.find((s) => s.id === id)?.name ?? id;
    

    const tooSmall = rooms.some((r) => r.studentIds.length < 2); // Used to ensure the rooms have more than 2 students.
    if (loading) return <p>Loading...</p>; // While the page is loading in, this loading screen will appear.

    // Used for randomly assigning students to rooms.
    const handleRandomlyAssignStudents = () => {
        const next = randomlyAssignStudents(lobby.students, roomCount);
        updateRooms(next);
    }

    return (
        <main className="min-h-screen w-full bg-gradient-to-b from-[#0D0E2C] via-[#101E4A] to-[#134790] p-6">
            <div>{/* This div tag holds the go back button only.*/}
                 {/* Replace this href link with whatever page the teacher should return to.*/}
                <Link className="font-bold"
                 href="/"> {"←"} Return </Link>
            </div>
        <div className="min-h-screen w-full border-solid border-7 border-[#D9D9D9] p-10 text-center text-[#082A56] space-y-2">

            <h1 className="text-lg font-bold text-[#FFFFFF]">Breakout Room Assignment</h1>

            {/* This div tag holds the entire menu for separating the students into their groups.*/}
            {error && <p className="text-[#E73737]">{error}</p>}
            {saving && <p> saving...</p>}
            
            {tooSmall && rooms.length > 0 && (
                <p className="text-[#82C2D7]">Each room needs at least 2 students before saving.</p>
            )}
            

            {rooms.length === 0 && (
            <div>{/* This div holds the button for the teacher to create a number of rooms.*/}
                <input 
                className="bg-[#F1E9DE] border-solid border-5 border-[#45B4D9] text-center py-1 px-1 text-[#000000]"
                type="number"
                min={1}
                max={Math.max(1, Math.floor(lobby.students.length / 2))}
                value={roomCount}
                onChange={(e) => {
                    const maxRooms = Math.max(1, Math.floor(lobby.students.length / 2));
                    const next = Math.min(maxRooms, Math.max(1, Number(e.target.value) || 1));
                    setRoomCount(next);
                }}/>{" "}
                <button className="bg-[#F1E9DE] border-solid border-5 border-[#45B4D9] text-center text-[#134790] py-1 px-1 font-bold" 
                    onClick={createRooms} disabled={saving}>
                    Create Rooms
                </button>
            </div>
            )}
            
            <div className="space-x-4">
                {/*This div holds the add room button and the randomly assigned rooms button. 
                If the teacher needs to, they can add an additional room with this button. */}
                <button className="bg-[#F1E9DE] border-solid border-5 border-[#F0B684] text-[#134780] text-center py-2 px-4 font-bold"
                    onClick={addRoom} disabled={saving}> 
                    Add Room 
                </button>

                {/*Teacher can choose to have students be randomly assigned to rooms, but will be able to move students afterwards. */}
                <button className="bg-[#F1E9DE] border-solid border-5 border-[#B099E7] text-[#134780] text-center py-2 px-4 font-bold" 
                    onClick={handleRandomlyAssignStudents} disabled={saving}>
                    Randomly Assigned Rooms
                </button>
            </div>

            {/* Students not assigned to a group are displayed under here. */}
            <h3 className="font-semibold text-[#FFFFFF]"> Unassigned Students </h3>
            
            {unassigned.length === 0 && <p className="font-semibold text-[#FFFFFF]">All students are assigned to a group.</p>}
           
            <ul >
                {/* A student's name is displayed along with a drop-down that allows them to be placed into a given room.
                    Once they are in a group, their name is removed from the "Unassigned Students" list. */}  
                {unassigned.map((s) => (
                    <li className="text-[#F1E9DE] p-2"
                        key={s.id}>
                        {s.name}{"  "}
                        <select
                            className="bg-[#FFFFFF] py-1 px-1 text-center text-[#134780]"
                            value=""
                            onChange={(e) => e.target.value && moveStudent(s.id, e.target.value)}
                            disabled ={rooms.length === 0 || saving}
                            >
                             <option value="">
                                {rooms.length === 0 ? "Create a room first" : "Assign to..."}
                                </option>
                                {rooms.map((r) => (
                                    <option key={r.roomId} value={r.roomId}>
                                        {r.roomName}
                                        </option>
                                ))}
                        </select>
                    </li>
                ))}
            </ul>

            {/* Once a room is created: it can be deleted, even if it is empty.
                Once a student is in a room: they can be moved to another room or removed from the room. */}
            {rooms.map((room) => (
                <div key={room.roomId}
                    className="text-[#F1E9DE]">
                    <h3>
                        {room.roomName}{"   "}
                        <button 
                        className="bg-[#F1E9DE] border-solid border-5 border-[#E2ACAC] py-1 px-2 text-center text-[#134780]"
                        onClick={() => removeRoom(room.roomId)}> Delete Room </button>
                    </h3>
                    {room.studentIds.length === 0 && <p>No students yet...</p>}
                    <ul>
                        {room.studentIds.map((id) => (
                            <li key={id}>
                                {nameOf(id)}{" "}
                                <select
                                value={room.roomId}
                                onChange={(e) => moveStudent(id, e.target.value)}
                                disabled={saving}
                                >
                                {rooms.map((r) => (
                                    <option key={r.roomId} value={r.roomId} className="text-[#134780]">
                                        {r.roomName}
                                    </option>
                                ))}
                                </select>{" "}
                               <button className="font-semibold text-[#E2ACAC] py-1"
                               onClick={() => moveStudent(id, null)}>Remove</button>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {/* Once the teacher's selection has been made they can save it by clicking this button. */}
            <button className="bg-[#F1E9DE] text-[#134780] border-solid border-7 border-[#F3B457] py-2 px-4"
            onClick={submitRooms} disabled={saving || !dirty || tooSmall}>
                Save Breakout Rooms
            </button>
            
        </div>
        </main>
    );
}