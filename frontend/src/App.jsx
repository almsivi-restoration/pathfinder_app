import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import GMDashboard from './components/GMDashboard';
import PlayerView from './components/PlayerView';
import NameGenerator from './components/NameGenerator';
import CampaignSelector from './pages/CampaignSelector';
import Encyclopedia from './pages/Encyclopedia';
import './App.css';

function App() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const listCampaigns = useStore((state) => state.listCampaigns);
  const [view, setView] = useState('campaign-selector'); // 'campaign-selector', 'gm', 'player'
  const [showNameGenerator, setShowNameGenerator] = useState(false);

  useEffect(() => {
    listCampaigns();
  }, [listCampaigns]);

  useEffect(() => {
    if (!window.electron?.onOpenEncyclopedia) return undefined;
    return window.electron.onOpenEncyclopedia(() => setView('encyclopedia'));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenNameGenerator) return undefined;
    return window.electron.onOpenNameGenerator(() => setShowNameGenerator(true));
  }, []);

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
      {view === 'encyclopedia' && <Encyclopedia onBack={() => setView('gm')} />}
      {view === 'player' && <PlayerView />}
      {showNameGenerator && <NameGenerator onClose={() => setShowNameGenerator(false)} />}
    </div>
  );
}

export default App;
