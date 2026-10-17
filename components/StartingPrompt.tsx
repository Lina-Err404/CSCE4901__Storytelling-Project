'use client'; // tells next.js this is a client-side component so our states actually work

import React, { useState } from 'react';

export default function StartingPrompt() {
  // state vars to track the teacher's current selections (camelCase per team rules)
  const [promptType, setPromptType] = useState('custom');
  const [promptText, setPromptText] = useState('');
  const [assignmentType, setAssignmentType] = useState('entire-class');
  const [submitStatus, setSubmitStatus] = useState('');

  //this sends the teachers prompt to the backend, the backend doesnt save the prompts yet
  const handlePromptSubmit = async () => {
    try {
      setSubmitStatus('Saving...');
      const response = await fetch("/api/starting-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // sending the dropdown selections along with the prompt text
        body: JSON.stringify({ promptType, promptText, assignmentType }),
      });

      const result = await response.json();
      console.log("Backend response:", result);
      
      if (response.ok || response.status === 501) { 
        setSubmitStatus('Prompt saved successfully!');
      } else {
        setSubmitStatus('Error: ' + (result.error || 'Failed to save prompt.'));
      }
    } catch (error) {
      console.error("Could not contact the backend:", error);
      setSubmitStatus('Error: Could not reach the server.');
    }
  };

  return (
    <div className="prompt-container" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Starting Prompt</h3>
      
      {/* dropdown letting teachers pick if they want to write a prompt, use a random one, or skip it entirely */}
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="prompt-mode">Prompt Mode: </label>
        <select id="prompt-mode" value={promptType} onChange={(e) => setPromptType(e.target.value)}>
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
        <label htmlFor="assignment-type">Assign Prompt To: </label>
        <select id="assignment-type" value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)}>
          <option value="entire-class">Entire Class</option>
          <option value="different-groups">Different Version per Group</option>
          <option value="randomized">Randomize per Group</option>
        </select>
      </div>

      {/* a button that runs the prompt submit function when the button is clicked */}
      <button type="button" onClick={handlePromptSubmit}>
        Submit
      </button>
      
      {submitStatus && (
        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{submitStatus}</p>
      )}
      
    </div>
  );
}