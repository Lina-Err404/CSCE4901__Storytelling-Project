"use client"

import { useState, useEffect } from 'react'
import db from '@/src/utils/firestore'
import { collection, onSnapshot } from "@firebase/firestore"

const ListItems = () => {
    const [items, setItems] = useState([])

    useEffect(() => {
        // listens for changes, so the list updates after a submit or delete
        const unsubscribe = onSnapshot(collection(db, 'items'), (snapshot) => {
            setItems(snapshot.docs.map((doc) => ({...doc.data(), id: doc.id }))) // map items with ids
        })

        return () => unsubscribe() // stop listening when the component unmounts
    }, [])

    return (
        <div>
            <h2>List of Items</h2>
            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <p>{item.name}</p>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ListItems