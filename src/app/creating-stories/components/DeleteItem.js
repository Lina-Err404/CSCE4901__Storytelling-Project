// unused for now, but can use it later to delete all the story segments after the activity is done 

import supabase from '@/src/utils/supabase'

// id is the segment_id of the row in story_segments
const DeleteItem = ({ id }) => {
    const handleDelete = async () => {
        const { error } = await supabase
            .from('story_segments')
            .delete()
            .eq('segment_id', id) // delete the row in the supabase database
        if (error) {
            console.error('Error deleting document', error)
            alert("Error deleting")
            return
        }
        alert('Item has been deleted successfully')
    }

    return (
        <button onClick={handleDelete} className="border bg-red-400 p-1 rounded text-white"> Delete </button>
    )
}

export default DeleteItem