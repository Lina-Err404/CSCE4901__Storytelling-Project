'use client'; // tells next.js this is a client-side component so our states actually work

import React, { useState } from 'react';

export default function StartingPrompt() {
  // state vars to track the teacher's current selections (camelCase per team rules)
  const [promptType, setPromptType] = useState('custom');
  const [promptText, setPromptText] = useState('');
  const [assignmentType, setAssignmentType] = useState('entire-class');

  //this sends the teachers prompt to the backend, the backend doesnt save the prompts yet
  const handlePromptSubmit = async () => {
    try {
      const response = await fetch("/api/starting-prompts", {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText }),
      });

      const result = await response.json();
      console.log("Backend response:", result);
    } catch (error) {
      console.error("Could not contact the backend:", error);
    }
  };

  return (
    <div className="prompt-container" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Starting Prompt</h3>
      
      {/* dropdown letting teachers pick if they want to write a prompt, use a random one, or skip it entirely */}
      <div style={{ marginBottom: '10px' }}>
        <label>Prompt Mode: </label>
        <select value={promptType} onChange={(e) => setPromptType(e.target.value)}>
          <option value="custom">Write Custom Prompt</option>
          <option value="random">Random Starting Phrase</option>
          <option value="none">No Prompt</option>
        </select>
      </div>

      {/* conditional render: only mount the text input area if the teacher selected 'custom' above */}
      {promptType === 'custom' && (
        <textarea 
          placeholder="Enter a story starter for your students..."
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          style={{ width: '100%', height: '80px', marginBottom: '10px' }}
        />
      )}

      {/* dropdown handling how the prompt gets distributed (breakout groups vs the whole class) */}
      <div style={{ marginBottom: '10px' }}>
        <label>Assign Prompt To: </label>
        <select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)}>
          <option value="entire-class">Entire Class</option>
          <option value="different-groups">Different Version per Group</option>
          <option value="randomized">Randomize per Group</option>
        </select>
      </div>

      {/* a button that runs the prompt submit function when the button is clicked */}
      <button type="button" onClick={handlePromptSubmit}>
        Submit
      </button>
      
    </div>
  );
}
