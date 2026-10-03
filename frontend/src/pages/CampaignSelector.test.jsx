import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CampaignSelector from './CampaignSelector';
import { useStore } from '../store';

const initialState = useStore.getState();
let renameCampaign;
let onCampaignLoaded;

beforeEach(() => {
  renameCampaign = jest.fn();
  onCampaignLoaded = jest.fn();
  useStore.setState({
    ...initialState,
    campaigns: ['Before', 'Keep'],
    availableRulesets: [{ id: '1e', name: 'Pathfinder 1e' }],
    listCampaigns: jest.fn(),
    fetchRulesets: jest.fn().mockResolvedValue([]),
    renameCampaign,
  }, true);
});

afterEach(() => {
  useStore.setState(initialState, true);
});

test('rename saves a trimmed name without loading the campaign', async () => {
  renameCampaign.mockImplementation(async (name, newName) => {
    useStore.setState({ campaigns: [newName, 'Keep'] });
    return { name: newName };
  });
  render(<CampaignSelector onCampaignLoaded={onCampaignLoaded} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rename Before' }));
  const input = screen.getByRole('textbox', { name: 'New campaign name' });
  expect(input).toHaveValue('Before');
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: ' After ' } });
  fireEvent.submit(input.closest('form'));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Rename After' })).toBeInTheDocument());
  expect(renameCampaign).toHaveBeenCalledWith('Before', 'After');
  expect(onCampaignLoaded).not.toHaveBeenCalled();
});

test.each(['Cancel', 'Escape'])('rename can be cancelled with %s', (method) => {
  render(<CampaignSelector onCampaignLoaded={onCampaignLoaded} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rename Before' }));
  if (method === 'Escape') {
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New campaign name' }), { key: 'Escape' });
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  }
  expect(screen.queryByRole('textbox', { name: 'New campaign name' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rename Before' })).toBeInTheDocument();
  expect(renameCampaign).not.toHaveBeenCalled();
});

test('rename rejects empty and unchanged names before submission', () => {
  render(<CampaignSelector onCampaignLoaded={onCampaignLoaded} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rename Before' }));
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'New campaign name' }), { target: { value: ' ' } });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('rename keeps the editor open after failure so the name can be corrected', async () => {
  renameCampaign.mockImplementation(async () => {
    useStore.setState({ operationError: 'A campaign with that name already exists' });
    return null;
  });
  render(<CampaignSelector onCampaignLoaded={onCampaignLoaded} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rename Before' }));
  const input = screen.getByRole('textbox', { name: 'New campaign name' });
  fireEvent.change(input, { target: { value: 'Keep' } });
  fireEvent.submit(input.closest('form'));

  await waitFor(() => expect(screen.getByText('A campaign with that name already exists')).toBeInTheDocument());
  expect(screen.getByText('A campaign with that name already exists').parentElement).toHaveClass('campaign-selector');
  expect(input).toHaveValue('Keep');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});