'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import React, { useEffect, useState, type FormEvent } from 'react';

type LobbyOption = { id: string; name: string; code: string };

let promptClient: SupabaseClient | undefined;

function getPromptClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase is not configured.');
  promptClient ??= createClient(url, key);
  return promptClient;
}

async function getAccessToken() {
  const { data, error } = await getPromptClient().auth.getSession();
  if (error) throw error;
  return data.session?.access_token;
}

async function fetchLobbies(token: string, signal?: AbortSignal): Promise<LobbyOption[]> {
  const response = await fetch('/api/starting-prompts', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not load your lobbies.');
  return result.lobbies;
}

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
  const [lobbies, setLobbies] = useState<LobbyOption[]>([]);
  const [lobbyId, setLobbyId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [lobbyError, setLobbyError] = useState('');
  const [promptType, setPromptType] = useState('custom');
  const [promptText, setPromptText] = useState('');
  const [assignmentType, setAssignmentType] = useState('entire-class');
  const [submitStatus, setSubmitStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLobbies() {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!controller.signal.aborted) setNeedsSignIn(true);
          return;
        }
        const lobbies = await fetchLobbies(token, controller.signal);
        if (!controller.signal.aborted) setLobbies(lobbies);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLobbyError(error instanceof Error ? error.message : 'Could not load your lobbies.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadLobbies();
    return () => controller.abort();
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    setIsLoading(true);
    setLobbyError('');
    try {
      const { data, error } = await getPromptClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Could not sign in to Supabase.');
      setLobbies(await fetchLobbies(data.session.access_token));
      setNeedsSignIn(false);
    } catch (error) {
      setLobbyError(error instanceof Error ? error.message : 'Could not sign in to Supabase.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePromptSubmit() {
    if (!lobbyId || isSubmitting) return;
    if (promptType === 'custom' && !promptText.trim()) {
      setSubmitStatus('Error: Please enter a starting prompt.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('Saving prompt settings…');
    try {
      const token = await getAccessToken();
      if (!token) {
        setNeedsSignIn(true);
        setLobbyId('');
        setLobbies([]);
        throw new Error('Sign in to Supabase again.');
      }
      const response = await fetch('/api/starting-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lobbyId,
          promptType,
          promptText: promptType === 'custom' ? promptText.trim() : '',
          assignmentType,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to save prompt.');
      setSubmitStatus('Starting prompt settings saved.');
    } catch (error) {
      setSubmitStatus(`Error: ${error instanceof Error ? error.message : 'Could not reach the server.'}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const cannotSubmit = !lobbyId || isSubmitting;

  return (
    <div style={{ backgroundColor: '#ffffff', padding: '35px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px', color: '#0f172a' }}>
        Assign Starting Prompt
      </h3>

      {needsSignIn && (
        <form onSubmit={handleSignIn} style={{ marginBottom: 24 }}>
          <p>Sign in with your Supabase teacher account.</p>
          <label htmlFor="prompt-email" style={LABEL_STYLE}>Email</label>
          <input id="prompt-email" name="email" type="email" autoComplete="username" required style={INPUT_STYLE} />
          <label htmlFor="prompt-password" style={LABEL_STYLE}>Password</label>
          <input id="prompt-password" name="password" type="password" autoComplete="current-password" required style={INPUT_STYLE} />
          <button type="submit" disabled={isLoading}>Sign in to Supabase</button>
        </form>
      )}

      <div style={{ marginBottom: 24 }}>
        <label htmlFor="prompt-lobby" style={LABEL_STYLE}>Supabase Lobby</label>
        <select id="prompt-lobby" value={lobbyId} disabled={isLoading || isSubmitting || !lobbies.length}
          onChange={(event) => { setLobbyId(event.target.value); setSubmitStatus(''); }} style={INPUT_STYLE}>
          <option value="">{isLoading ? 'Loading lobbies…' : 'Select a lobby'}</option>
          {lobbies.map((lobby) => (
            <option key={lobby.id} value={lobby.id}>{lobby.name} ({lobby.code})</option>
          ))}
        </select>
        {!isLoading && (lobbyError || (!needsSignIn && !lobbies.length)) && (
          <p role="status">{lobbyError || 'No open Supabase lobbies found for this teacher.'}</p>
        )}
      </div>

      {/* dropdown letting teachers pick if they want to write a prompt, use a random one, or skip it entirely */}
      <div style={{ marginBottom: '24px' }}>
        <label htmlFor="prompt-mode" style={LABEL_STYLE}>Prompt Mode</label>
        <select id="prompt-mode" value={promptType} onChange={(e) => setPromptType(e.target.value)} style={INPUT_STYLE}>
          <option value="custom">Write a Custom Prompt</option>
          <option value="random">Random Prompt</option>
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
        <p>Random and group options are saved as settings.</p>
      </div>

      {/* button that triggers the submit function, disabling itself and greying out while processing */}
      <button
        type="button"
        onClick={handlePromptSubmit}
        disabled={cannotSubmit}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: cannotSubmit ? '#9ca3af' : '#72a096',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: cannotSubmit ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        Assign to Classroom
      </button>

      {submitStatus && (
        <p role="status" style={{
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
