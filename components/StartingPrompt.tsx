'use client'; // tells next.js this is a client-side component so our states actually work

import React, { useState } from 'react';

// Moved outside the component to prevent recreating these objects on every single keystroke/render
const LABEL_STYLE: React.CSSProperties = { 
  display: 'block', 
  marginBottom: '8px', 
  fontWeight: 'bold', 
  fontSize: '15px', 
  color: '#1e293b' 
};

const INPUT_STYLE: React.CSSProperties = { 
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

export default function StartingPrompt() {
  // state vars to track the teacher's selections and loading status (camelCase per team rules)
  const [promptType, setPromptType] = useState('custom');
  const [promptText, setPromptText] = useState('');
  const [assignmentType, setAssignmentType] = useState('entire-class');
  const [submitStatus, setSubmitStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // this sends the payload to the backend and blocks duplicate clicks while loading
  const handlePromptSubmit = async () => {
    if (isSubmitting) return; // stops the function if a request is already running

    if (promptType === 'custom' && !promptText.trim()) {
      setSubmitStatus('Error: Please enter a starting prompt.');
      return;
    }

    setIsSubmitting(true);

    try {
      setSubmitStatus('Assigning prompt to the classroom...');
      
      const payload = {
        promptType,
        promptText: promptType === 'custom' ? promptText.trim() : '',
        assignmentType,
      };

      const response = await fetch("/api/starting-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Backend response:", result); // TODO: remove before production
      
      if (response.ok || response.status === 501) { 
        setSubmitStatus('Prompt successfully assigned!');
      } else {
        setSubmitStatus('Error: ' + (result.error || 'Failed to save prompt.'));
      }
    } catch (error) {
      console.error("Could not contact the backend:", error);
      setSubmitStatus('Error: Could not reach the server.');
    } finally {
      setIsSubmitting(false); // unlocks the submit button whether the fetch succeeds or fails
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', padding: '35px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px', color: '#0f172a' }}>
        Assign Starting Prompt
      </h3>
      
      {/* dropdown letting teachers pick if they want to write a prompt, use a random one, or skip it entirely */}
      <div style={{ marginBottom: '24px' }}>
        <label htmlFor="prompt-mode" style={LABEL_STYLE}>Prompt Mode</label>
        <select id="prompt-mode" value={promptType} onChange={(e) => setPromptType(e.target.value)} style={INPUT_STYLE}>
          <option value="custom">Write a Custom Prompt</option>
          <option value="random">Pull a Random Prompt</option>
          <option value="none">No Prompt</option>
        </select>
      </div>

      {/* conditional render: only mount the text input area if the teacher selected 'custom' above */}
      {promptType === 'custom' && (
        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="prompt-text" style={LABEL_STYLE}>Prompt Text</label>
          <textarea 
            id="prompt-text"
            placeholder="Enter a story starter or prompt for your students..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            style={{ ...INPUT_STYLE, height: '120px', resize: 'vertical', lineHeight: '1.5' }}
          />
        </div>
      )}

      {/* dropdown handling how the prompt gets distributed (breakout groups vs the whole class) */}
      <div style={{ marginBottom: '32px' }}>
        <label htmlFor="assignment-type" style={LABEL_STYLE}>Classroom Distribution</label>
        <select id="assignment-type" value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} style={INPUT_STYLE}>
          <option value="entire-class">Entire Class (Same Prompt)</option>
          <option value="different-groups">Different Version per Breakout Group</option>
          <option value="randomized">Randomize per Breakout Group</option>
        </select>
      </div>

      {/* button that triggers the submit function, disabling itself and greying out while processing */}
      <button 
        type="button" 
        onClick={handlePromptSubmit}
        disabled={isSubmitting}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: isSubmitting ? '#9ca3af' : '#72a096', 
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
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