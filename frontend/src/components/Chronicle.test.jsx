import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chronicle from './Chronicle';
import { useStore } from '../store';

const ENTRY = {
  id: 'e1',
  title: 'First Session',
  body: 'The party **met** at the inn.',
  created_at: '2026-09-01T12:00:00',
  updated_at: '2026-09-01T12:00:00',
};

function seedStore(entries = [ENTRY]) {
  useStore.setState({
    chronicleEntries: entries,
    fetchChronicle: jest.fn(),
    addChronicleEntry: jest.fn(),
    updateChronicleEntry: jest.fn(),
    deleteChronicleEntry: jest.fn(),
  });
}

beforeEach(() => {
  seedStore();
});

test('renders the current entry with markdown formatting', () => {
  render(<Chronicle onClose={() => {}} />);

  expect(screen.getByText('First Session')).toBeInTheDocument();
  const bold = screen.getByText('met');
  expect(bold.tagName).toBe('STRONG');
});

test('shows the markdown formatting guide on the right page', () => {
  render(<Chronicle onClose={() => {}} />);

  expect(screen.getByText('Formatting Guide')).toBeInTheDocument();
  expect(screen.getByText('**bold**')).toBeInTheDocument();
});

test('shows an empty state when the chronicle has no entries', () => {
  seedStore([]);
  render(<Chronicle onClose={() => {}} />);

  expect(screen.getByText('The chronicle is empty.')).toBeInTheDocument();
  expect(screen.getByText('0 / 0')).toBeInTheDocument();
});

test('New Entry opens the editor and saves through the store', async () => {
  const addChronicleEntry = jest.fn().mockResolvedValue(ENTRY);
  useStore.setState({ addChronicleEntry });

  render(<Chronicle onClose={() => {}} />);
  fireEvent.click(screen.getByText('New Entry'));

  expect(screen.getByPlaceholderText('Entry title')).toBeInTheDocument();
  expect(screen.getByText('Save')).toBeDisabled();

  fireEvent.change(screen.getByPlaceholderText('Entry title'), { target: { value: 'Second Session' } });
  fireEvent.change(screen.getByPlaceholderText('Write the entry in markdown…'), {
    target: { value: '# Recap\nThey fought a dragon.' },
  });
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => {
    expect(addChronicleEntry).toHaveBeenCalledWith({
      title: 'Second Session',
      body: '# Recap\nThey fought a dragon.',
    });
  });
});

test('Edit pre-fills the draft and updates through the store', async () => {
  const updateChronicleEntry = jest.fn().mockResolvedValue(ENTRY);
  useStore.setState({ updateChronicleEntry });

  render(<Chronicle onClose={() => {}} />);
  fireEvent.click(screen.getByText('Edit'));

  expect(screen.getByPlaceholderText('Entry title')).toHaveValue('First Session');
  fireEvent.change(screen.getByPlaceholderText('Entry title'), { target: { value: 'First Session (Revised)' } });
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateChronicleEntry).toHaveBeenCalledWith('e1', {
      title: 'First Session (Revised)',
      body: 'The party **met** at the inn.',
    });
  });
});

test('Delete asks for confirmation before calling the store', () => {
  const deleteChronicleEntry = jest.fn();
  useStore.setState({ deleteChronicleEntry });
  window.confirm = jest.fn().mockReturnValue(false);

  render(<Chronicle onClose={() => {}} />);
  fireEvent.click(screen.getByText('Delete'));

  expect(window.confirm).toHaveBeenCalled();
  expect(deleteChronicleEntry).not.toHaveBeenCalled();
});

test('Prev and Next are disabled with a single entry', () => {
  render(<Chronicle onClose={() => {}} />);

  expect(screen.getByText('Prev')).toBeDisabled();
  expect(screen.getByText('Next')).toBeDisabled();
  expect(screen.getByText('1 / 1')).toBeInTheDocument();
});
