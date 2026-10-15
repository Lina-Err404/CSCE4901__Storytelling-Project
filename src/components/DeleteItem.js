// unused for now, but can use it later to delete all the story segments after the activity is done 

import db from '../utils/firestore'
import { doc, deleteDoc } from '@firebase/firestore'

const DeleteItem = ({ id }) => {
    const handleDelete = async () => {
        const itemRef = doc(db, 'items', id)
        try {
            await deleteDoc(itemRef) // delete document in the firestore database
            alert('Item has been deleted successfully')
        } catch (error) {
            console.error('Error deleting document', error)
            alert("Error deleting")
        }
    }

    return (
        <button onClick={handleDelete} className = "border bg-red-400 p-1 rounded text-white"> Delete </button>
    )
}

export default DeleteItem