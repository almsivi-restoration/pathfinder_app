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
