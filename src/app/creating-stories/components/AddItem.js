import db from '../utils/firestore'
import { doc, setDoc } from "@firebase/firestore"

// creates the student's document one time using their student ID as the document ID
const AddItem = ({ studentId, onCreated }) => {
    const handleCreate = async () => {
        try {
            await setDoc(doc(db, 'items', studentId), { name: '' }) // empty segment to start writing in
            console.log("Document created with ID: ", studentId)
            onCreated() // tell the parent the document now exists
        } catch (error) {
            console.log('Error creating document: ', error)
        }
    }

    return (
        <button onClick={handleCreate}>Add Story Segment</button>
    )
}

export default AddItem