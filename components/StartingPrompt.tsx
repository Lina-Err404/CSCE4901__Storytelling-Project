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
      setSubmitStatus('Assigning prompt to the classroom...');
      const response = await fetch("/api/starting-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptType, promptText, assignmentType }),
      });

      const result = await response.json();
      console.log("Backend response:", result);
      
      if (response.ok || response.status === 501) { 
        setSubmitStatus('Prompt successfully assigned!');
      } else {
        setSubmitStatus('Error: ' + (result.error || 'Failed to save prompt.'));
      }
    } catch (error) {
      console.error("Could not contact the backend:", error);
      setSubmitStatus('Error: Could not reach the server.');
    }
  };

  const labelStyle = { 
    display: 'block', 
    marginBottom: '8px', 
    fontWeight: 'bold', 
    fontSize: '15px', 
    color: '#1e293b' 
  };
  
  const inputStyle = { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '10px', 
    border: '2px solid #e2e8f0', 
    backgroundColor: '#f8fafc',
    fontSize: '15px', 
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    color: '#333'
  };

  return (
    <div style={{ 
      backgroundColor: '#ffffff', 
      padding: '35px', 
      borderRadius: '16px', 
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)' 
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px', color: '#0f172a' }}>
        Assign Starting Prompt
      </h3>
      
      {/* dropdown letting teachers pick if they want to write a prompt, use a random one, or skip it entirely */}
      <div style={{ marginBottom: '24px' }}>
        <label htmlFor="prompt-mode" style={labelStyle}>Prompt Mode</label>
        <select id="prompt-mode" value={promptType} onChange={(e) => setPromptType(e.target.value)} style={inputStyle}>
          <option value="custom">Write a Custom Prompt</option>
          <option value="random">Pull a Random Prompt</option>
          <option value="none">No Prompt</option>
        </select>
      </div>

      {/* conditional render: only mount the text input area if the teacher selected 'custom' above */}
      {promptType === 'custom' && (
        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="prompt-text" style={labelStyle}>Prompt Text</label>
          <textarea 
            id="prompt-text"
            placeholder="Enter a story starter or prompt for your students..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            style={{ ...inputStyle, height: '120px', resize: 'vertical', lineHeight: '1.5' }}
          />
        </div>
      )}

      {/* dropdown handling how the prompt gets distributed (breakout groups vs the whole class) */}
      <div style={{ marginBottom: '32px' }}>
        <label htmlFor="assignment-type" style={labelStyle}>Classroom Distribution</label>
        <select id="assignment-type" value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} style={inputStyle}>
          <option value="entire-class">Entire Class (Same Prompt)</option>
          <option value="different-groups">Different Version per Breakout Group</option>
          <option value="randomized">Randomize per Breakout Group</option>
        </select>
      </div>

      {/* a button that runs the prompt submit function when the button is clicked */}
      <button 
        type="button" 
        onClick={handlePromptSubmit}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: '#72a096', 
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        Assign to Classroom
      </button>
      
      {submitStatus && (
        <p style={{ 
          marginTop: '20px', 
          fontWeight: '600', 
          fontSize: '15px', 
          textAlign: 'center',
          color: submitStatus.includes('Error') ? '#ef4444' : '#10b981' 
        }}>
          {submitStatus}
        </p>
      )}
    </div>
  );
}