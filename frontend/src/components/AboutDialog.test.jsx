import { fireEvent, render, screen } from '@testing-library/react';
import AboutDialog from './AboutDialog';

const details = {
  version: '1.2.3-test',
  description: 'A tabletop GM companion.\n\nReference content is user-supplied.',
  dataDirectory: `/home/${'long_directory_'.repeat(40)}/data`,
};

test('shows every paragraph, the actual version, and an untruncated data directory', () => {
  render(<AboutDialog details={details} onClose={jest.fn()} />);
  expect(screen.getByRole('dialog', { name: "About Game Master's Workbench" })).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByText('Version 1.2.3-test')).toBeInTheDocument();
  expect(screen.getByText('A tabletop GM companion.')).toBeInTheDocument();
  expect(screen.getByText('Reference content is user-supplied.')).toBeInTheDocument();
  expect(screen.getByText(details.dataDirectory)).toBeInTheDocument();
});

test('formats the usage guide with section headings, short paragraphs, and semantic shortcuts', () => {
  const guide = {
    version: '1.2.3-test',
    sections: [
      { title: 'Campaigns', paragraphs: ['Create a campaign.', 'Save your scenes.'] },
      { title: 'Keyboard shortcuts', shortcuts: [{ keys: 'Ctrl+B', action: 'Bestiary' }] },
    ],
    dataDirectory: '/data',
  };
  render(<AboutDialog details={guide} title="How to Use" bodyLabel="Usage guide" onClose={jest.fn()} />);
  expect(screen.getByRole('heading', { level: 3, name: 'Campaigns' })).toBeInTheDocument();
  expect(screen.getByText('Create a campaign.').tagName).toBe('P');
  expect(screen.getByText('Save your scenes.').tagName).toBe('P');
  expect(screen.getByRole('heading', { level: 3, name: 'Keyboard shortcuts' })).toBeInTheDocument();
  expect(screen.getByText('Ctrl+B').tagName).toBe('KBD');
  expect(screen.getByText('Bestiary').tagName).toBe('DD');
  expect(screen.getByText('/data')).toBeInTheDocument();
});

test.each([
  {},
  { title: 'How to Use', bodyLabel: 'Usage guide' },
])('focus stays in the dialog and the scrollable details are keyboard reachable: %j', (props) => {
  render(<AboutDialog {...props} details={details} onClose={jest.fn()} />);
  const close = screen.getByRole('button', { name: 'Close' });
  const body = screen.getByRole('region', { name: props.bodyLabel || 'About details' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab' });
  expect(body).toHaveFocus();
  fireEvent.keyDown(body, { key: 'Tab', shiftKey: true });
  expect(close).toHaveFocus();
});

test.each([
  {},
  { title: 'How to Use', bodyLabel: 'Usage guide' },
])('Close, Escape, and the backdrop dismiss; content clicks do not: %j', (props) => {
  const onClose = jest.fn();
  render(<AboutDialog {...props} details={details} onClose={onClose} />);
  fireEvent.click(screen.getByText('A tabletop GM companion.'));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' });
  fireEvent.click(document.querySelector('.about-overlay'));
  expect(onClose).toHaveBeenCalledTimes(3);
});

test.each([
  {},
  { title: 'How to Use', bodyLabel: 'Usage guide' },
])('closing restores the previous keyboard focus: %j', (props) => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  const { unmount } = render(<AboutDialog {...props} details={details} onClose={jest.fn()} />);
  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
