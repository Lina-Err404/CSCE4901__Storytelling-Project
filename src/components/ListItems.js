"use client"

import { useState, useEffect } from 'react'
import db from '../utils/firestore'
import { collection, getDocs } from "@firebase/firestore"
import DeleteItem from "./DeleteItem"

const ListItems = () => {
    const [items, setItems] = useState([])

    useEffect(() => {
        const fetchItems = async () => {
            const querySnapshot = await getDocs(collection(db, 'items')) // get all the documents in items collection
            setItems(querySnapshot.docs.map((doc) => ({...doc.data(), id: doc.id }))) // map items with ids
        }

        fetchItems()
    }, [])

    return (
        <div>
            <h2>List of Items</h2>
            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <p>{item.name}</p>
                        <DeleteItem id={item.id} />
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ListItems