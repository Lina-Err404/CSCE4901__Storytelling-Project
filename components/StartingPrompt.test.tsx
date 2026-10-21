import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StartingPrompt from './StartingPrompt';

// Mock the global fetch so our test doesn't try to hit Fikayo's backend, cast as jest.Mock to fix TS compilation
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ error: "Starting prompt saved when it gets connected." }),
    status: 501,
    ok: false
  })
) as jest.Mock;

describe('StartingPrompt Component', () => {
  it('renders the component with default custom prompt view', () => {
    render(<StartingPrompt />);
    // Check that our new presentation slide text is loading properly
    expect(screen.getByText('Assign Starting Prompt')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a story starter or prompt for your students...')).toBeInTheDocument();
  });

  it('hides the text area when Pull a Random Prompt is selected', () => {
    render(<StartingPrompt />);
    const modeSelect = screen.getByLabelText('Prompt Mode');
    
    // Simulate the teacher picking "random" from the dropdown
    fireEvent.change(modeSelect, { target: { value: 'random' } });
    
    // The custom text area should disappear
    expect(screen.queryByPlaceholderText('Enter a story starter or prompt for your students...')).not.toBeInTheDocument();
  });

  it('updates the text area value when typing', () => {
    render(<StartingPrompt />);
    const textarea = screen.getByPlaceholderText('Enter a story starter or prompt for your students...');
    
    // Simulate typing in the custom prompt box
    fireEvent.change(textarea, { target: { value: 'Once upon a time...' } });
    
    expect(textarea).toHaveValue('Once upon a time...');
  });

  it('calls the submit function and displays a success message when clicked', async () => {
    render(<StartingPrompt />);
    const submitButton = screen.getByText('Assign to Classroom');
    
    fireEvent.click(submitButton);
    
    // Expect our fake fetch to have been called
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Check that the UI updated to show our updated success message
    expect(await screen.findByText('Prompt successfully assigned!')).toBeInTheDocument();
  });
});