import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { useStore } from './store';

jest.mock('./pages/CampaignSelector', () => () => <div>Campaign selector</div>);

test('the About menu event opens the dialog, Close dismisses it, and unmount unsubscribes', () => {
  let openAbout;
  const unsubscribe = jest.fn();
  window.electron = {
    onOpenAbout: jest.fn((callback) => {
      openAbout = callback;
      return unsubscribe;
    }),
  };
  useStore.setState({ currentCampaign: null, listCampaigns: jest.fn() });
  try {
    const { unmount } = render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => openAbout({ version: '2.0.0', description: 'About the app', dataDirectory: '/data' }));
    expect(screen.getByRole('dialog', { name: "About Game Master's Workbench" })).toBeInTheDocument();
    expect(screen.getByText('Version 2.0.0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  } finally {
    delete window.electron;
  }
});

test('How to Use opens without a campaign, repeated events do not stack, and About remains distinct', () => {
  let openHelp;
  let openAbout;
  const unsubscribeHelp = jest.fn();
  const unsubscribeAbout = jest.fn();
  window.electron = {
    onOpenHelp: (callback) => {
      openHelp = callback;
      return unsubscribeHelp;
    },
    onOpenAbout: (callback) => {
      openAbout = callback;
      return unsubscribeAbout;
    },
  };
  useStore.setState({ currentCampaign: null, listCampaigns: jest.fn() });
  const details = {
    version: '2.0.0',
    sections: [
      { title: 'Campaigns', paragraphs: ['Save your campaign.'] },
      { title: 'Keyboard shortcuts', shortcuts: [{ keys: 'F1', action: 'How to Use' }] },
    ],
    dataDirectory: '/data',
  };
  try {
    const { unmount } = render(<App />);
    act(() => openHelp(details));
    expect(screen.getByRole('dialog', { name: 'How to Use' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Usage guide' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('heading', { name: 'Campaigns' })).toBeInTheDocument();
    expect(screen.getByText('Save your campaign.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('F1')).toBeInTheDocument();
    expect(screen.getByText('/data')).toBeInTheDocument();
    act(() => openHelp(details));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    act(() => openAbout({ version: details.version, description: 'About the app', dataDirectory: '/data' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: "About Game Master's Workbench" })).toBeInTheDocument();
    act(() => openHelp(details));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    expect(unsubscribeHelp).toHaveBeenCalledTimes(1);
    expect(unsubscribeAbout).toHaveBeenCalledTimes(1);
  } finally {
    delete window.electron;
  }
});
