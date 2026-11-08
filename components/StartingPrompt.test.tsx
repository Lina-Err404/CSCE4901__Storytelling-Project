import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StartingPrompt from './StartingPrompt';

jest.mock('@/app/supabase-client', () => ({
  getAccessToken: async () => 'teacher-token',
}));

const lobbyId = '11111111-1111-4111-8111-111111111111';
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
});

it('sends the custom prompt to the current lobby with the teacher session', async () => {
  render(<StartingPrompt lobbyId={lobbyId} />);
  fireEvent.change(screen.getByLabelText('Prompt Text'), { target: { value: '  Once upon a time...  ' } });
  fireEvent.click(screen.getByText('Assign to Classroom'));

  expect(await screen.findByText('Starting prompt settings saved.')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/starting-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-token' },
    body: JSON.stringify({ lobbyId, promptType: 'custom', promptText: 'Once upon a time...', assignmentType: 'entire-class' }),
  });
});

it('saves random mode as a setting without sending custom text', async () => {
  render(<StartingPrompt lobbyId={lobbyId} />);
  fireEvent.change(screen.getByLabelText('Prompt Text'), { target: { value: 'Custom text' } });
  fireEvent.change(screen.getByLabelText('Prompt Mode'), { target: { value: 'random' } });
  expect(screen.queryByLabelText('Prompt Text')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Assign to Classroom'));

  expect(await screen.findByText('Starting prompt settings saved.')).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    lobbyId, promptType: 'random', promptText: '', assignmentType: 'entire-class',
  });
});
