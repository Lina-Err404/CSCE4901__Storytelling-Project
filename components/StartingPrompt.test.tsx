import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createClient } from '@supabase/supabase-js';
import StartingPrompt from './StartingPrompt';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const lobby = { id: '11111111-1111-4111-8111-111111111111', name: 'English Lobby', code: 'ABC123' };
const fetchMock = jest.fn();
const getSession = jest.fn();
const signInWithPassword = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  (createClient as jest.Mock).mockReturnValue({ auth: { getSession, signInWithPassword } });
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'teacher-token' } }, error: null });
  signInWithPassword.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ lobbies: [lobby] }) });
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
});

async function chooseLobby() {
  await screen.findByRole('option', { name: 'English Lobby (ABC123)' });
  fireEvent.change(screen.getByLabelText('Supabase Lobby'), { target: { value: lobby.id } });
}

it('saves a custom prompt to the selected lobby with the Supabase session', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  render(<StartingPrompt />);
  await chooseLobby();
  fireEvent.change(screen.getByLabelText('Prompt Text'), { target: { value: '  Once upon a time…  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Assign to Classroom' }));

  expect(await screen.findByText('Starting prompt settings saved.')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith('/api/starting-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-token' },
    body: JSON.stringify({
      lobbyId: lobby.id, promptType: 'custom', promptText: 'Once upon a time…', assignmentType: 'entire-class',
    }),
  });
});

it('saves random mode as a setting without including previously entered text', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  render(<StartingPrompt />);
  await chooseLobby();
  fireEvent.change(screen.getByLabelText('Prompt Text'), { target: { value: 'Old custom text' } });
  fireEvent.change(screen.getByLabelText('Prompt Mode'), { target: { value: 'random' } });
  expect(screen.queryByLabelText('Prompt Text')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Assign to Classroom' }));

  expect(await screen.findByText('Starting prompt settings saved.')).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ promptType: 'random', promptText: '' });
});

it('requires sign-in before listing lobbies when no Supabase session exists', async () => {
  getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
  signInWithPassword.mockResolvedValueOnce({ data: { session: { access_token: 'new-token' } }, error: null });
  render(<StartingPrompt />);
  const signIn = await screen.findByRole('button', { name: 'Sign in to Supabase' });
  expect(screen.getByRole('button', { name: 'Assign to Classroom' })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teacher@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
  fireEvent.click(signIn);
  await screen.findByRole('option', { name: 'English Lobby (ABC123)' });
  expect(signInWithPassword).toHaveBeenCalledWith({ email: 'teacher@example.com', password: 'test-password' });
  expect(fetchMock).toHaveBeenCalledWith('/api/starting-prompts', {
    headers: { Authorization: 'Bearer new-token' },
  });
});

it('reports a rejected write as an error', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Teacher access required.' }) });
  render(<StartingPrompt />);
  await chooseLobby();
  fireEvent.change(screen.getByLabelText('Prompt Text'), { target: { value: 'A custom prompt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Assign to Classroom' }));

  expect(await screen.findByText('Error: Teacher access required.')).toBeInTheDocument();
  expect(screen.queryByText('Starting prompt settings saved.')).not.toBeInTheDocument();
});
