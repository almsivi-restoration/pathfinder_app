import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import GMDashboard from './components/GMDashboard';
import PlayerView from './components/PlayerView';
import NameGenerator from './components/NameGenerator';
import Chronicle from './components/Chronicle';
import QuickRoll from './components/QuickRoll';
import SheetImporter from './components/SheetImporter';
import CampaignSelector from './pages/CampaignSelector';
import Encyclopedia from './pages/Encyclopedia';
import Bestiary from './pages/Bestiary';
import './App.css';

function App() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const listCampaigns = useStore((state) => state.listCampaigns);
  const [view, setView] = useState('campaign-selector'); // 'campaign-selector', 'gm', 'player'
  const [showNameGenerator, setShowNameGenerator] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const [showQuickRoll, setShowQuickRoll] = useState(false);
  const [showSheetImporter, setShowSheetImporter] = useState(false);

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

  useEffect(() => {
    if (!window.electron?.onOpenBestiary) return undefined;
    return window.electron.onOpenBestiary(() => setView('bestiary'));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenChronicle) return undefined;
    return window.electron.onOpenChronicle(() => setShowChronicle(true));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenQuickRoll) return undefined;
    return window.electron.onOpenQuickRoll(() => setShowQuickRoll(true));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenSheetImporter) return undefined;
    return window.electron.onOpenSheetImporter(() => setShowSheetImporter(true));
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
      {view === 'bestiary' && <Bestiary onBack={() => setView('gm')} />}
      {view === 'player' && <PlayerView />}
      {showNameGenerator && <NameGenerator onClose={() => setShowNameGenerator(false)} />}
      {showChronicle && <Chronicle onClose={() => setShowChronicle(false)} />}
      {showQuickRoll && <QuickRoll onClose={() => setShowQuickRoll(false)} />}
      {showSheetImporter && <SheetImporter onClose={() => setShowSheetImporter(false)} />}
    </div>
  );
}

export default App;
