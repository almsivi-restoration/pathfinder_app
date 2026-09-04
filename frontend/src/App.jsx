import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import GMDashboard from './components/GMDashboard';
import PlayerView from './components/PlayerView';
import CampaignSelector from './pages/CampaignSelector';
import './App.css';

function App() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const listCampaigns = useStore((state) => state.listCampaigns);
  const [view, setView] = useState('campaign-selector'); // 'campaign-selector', 'gm', 'player'

  useEffect(() => {
    listCampaigns();
  }, [listCampaigns]);

  // Determine view based on URL or state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'player') {
      setView('player');
    } else if (currentCampaign) {
      setView('gm');
    } else {
      setView('campaign-selector');
    }
  }, [currentCampaign]);

  return (
    <div className="App">
      {view === 'campaign-selector' && (
        <CampaignSelector onCampaignLoaded={() => setView('gm')} />
      )}
      {view === 'gm' && <GMDashboard />}
      {view === 'player' && <PlayerView />}
    </div>
  );
}

export default App;
