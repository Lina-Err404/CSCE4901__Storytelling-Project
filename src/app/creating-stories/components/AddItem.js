import supabase from '@/src/utils/supabase'

// creates the student's story segment one time (one row in story_segments)
const AddItem = ({ storyId, studentId, section, onCreated }) => {
    const handleCreate = async () => {
        const { error } = await supabase
            .from('story_segments')
            .insert({ story_id: storyId, student_id: studentId, section }) // empty segment to start writing in
        if (error) {
            console.log('Error creating document: ', error)
            return
        }
        console.log("Segment created for student: ", studentId)
        onCreated() // tell the parent the segment now exists
    }

    return (
        <button onClick={handleCreate}>Add Story Segment</button>
    )
}

export default AddItem