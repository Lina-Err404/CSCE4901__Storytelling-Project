"use client"

import { useState, useEffect } from 'react'
import supabase from '@/src/utils/supabase'

const ListItems = ({ storyId }) => {
    const [items, setItems] = useState([])

    useEffect(() => {
        const load = async () => {
            const { data, error } = await supabase
                .from('story_segments')
                .select('segment_id, writing_content')
                .eq('story_id', storyId)
            if (error) {
                console.log('Error reading segments: ', error)
                return
            }
            setItems(data.map((row) => ({ id: row.segment_id, name: row.writing_content }))) // map items with ids
        }

        load()
        // listens for changes, so the list updates after a submit or delete
        const channel = supabase
            .channel(`list-${storyId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'story_segments', filter: `story_id=eq.${storyId}` }, load)
            .subscribe()

        return () => { supabase.removeChannel(channel) } // stop listening when the component unmounts
    }, [storyId])

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