function createGetGroupForStudent(supabase) {
  return async function getGroupForStudent(studentId) {
    // Find the student's breakout room.
    const { data: membership, error: membershipError } = await supabase
      .from('breakout_participants')
      .select('lobby_id, room_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (membershipError) throw membershipError;

    // Student has not been assigned to a group yet.
    if (!membership) {
      return null;
    }

    // Get the room information.
    const { data: room, error: roomError } = await supabase
      .from('breakout_rooms')
      .select('room_id, room_name')
      .eq('room_id', membership.room_id)
      .single();

    if (roomError) throw roomError;

    // Find everyone assigned to the same room.
    const { data: members, error: membersError } = await supabase
      .from('breakout_participants')
      .select('student_id')
      .eq('room_id', membership.room_id)
      .eq('lobby_id', membership.lobby_id);

    if (membersError) throw membersError;

    const studentIds = members.map(
      ({ student_id }) => student_id
    );

    if (studentIds.length === 0) {
      return {
        groupId: room.room_id,
        groupName: room.room_name,
        students: [],
      };
    }

    // Get display names for everyone in the room.
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', studentIds)
      .order('display_name');

    if (profilesError) throw profilesError;

    return {
      groupId: room.room_id,
      groupName: room.room_name,
      students: profiles.map(({ id, display_name }) => ({
        id,
        name: display_name,
      })),
    };
  };
}

module.exports = {
  createGetGroupForStudent,
};