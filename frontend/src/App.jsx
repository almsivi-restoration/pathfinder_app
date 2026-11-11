import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import GMDashboard from './components/GMDashboard';
import PlayerView from './components/PlayerView';
import VenueScreen from './components/VenueScreen';
import NameGenerator from './components/NameGenerator';
import Chronicle from './components/Chronicle';
import QuickRoll from './components/QuickRoll';
import SheetImporter from './components/SheetImporter';
import Harrowing from './components/Harrowing';
import AboutDialog from './components/AboutDialog';
import CampaignSelector from './pages/CampaignSelector';
import Encyclopedia from './pages/Encyclopedia';
import Bestiary from './pages/Bestiary';
import Venues from './pages/Venues';
import './App.css';

// Menu shortcuts switch views directly, so they check for unsaved venue edits first.
const canLeaveView = (view) => (
  view !== 'venues'
  || !useStore.getState().venueEditorDirty
  || window.confirm('Discard unsaved changes to this venue?')
);

function App() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const listCampaigns = useStore((state) => state.listCampaigns);
  const [view, setView] = useState('campaign-selector'); // 'campaign-selector', 'gm', 'player', 'venue-screen', ...
  const [showNameGenerator, setShowNameGenerator] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const [showQuickRoll, setShowQuickRoll] = useState(false);
  const [showSheetImporter, setShowSheetImporter] = useState(false);
  const [showHarrowing, setShowHarrowing] = useState(false);
  const [infoDialog, setInfoDialog] = useState(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    listCampaigns();
  }, [listCampaigns]);

  useEffect(() => {
    if (!window.electron?.onOpenEncyclopedia) return undefined;
    return window.electron.onOpenEncyclopedia(() => {
      if (canLeaveView(viewRef.current)) setView('encyclopedia');
    });
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenNameGenerator) return undefined;
    return window.electron.onOpenNameGenerator(() => setShowNameGenerator(true));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenBestiary) return undefined;
    return window.electron.onOpenBestiary(() => {
      if (canLeaveView(viewRef.current)) setView('bestiary');
    });
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenVenues) return undefined;
    return window.electron.onOpenVenues(() => setView('venues'));
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

  useEffect(() => {
    if (!window.electron?.onOpenHarrowing) return undefined;
    return window.electron.onOpenHarrowing(() => setShowHarrowing(true));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenAbout) return undefined;
    return window.electron.onOpenAbout((details) => setInfoDialog({ details }));
  }, []);

  useEffect(() => {
    if (!window.electron?.onOpenHelp) return undefined;
    return window.electron.onOpenHelp((details) => setInfoDialog({
      details,
      title: 'How to Use',
      bodyLabel: 'Usage guide',
    }));
  }, []);

  // Determine view based on URL or state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'player') {
      setView('player');
    } else if (params.get('view') === 'venue') {
      setView('venue-screen');
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
      {view === 'venues' && <Venues onBack={() => setView('gm')} />}
      {view === 'player' && <PlayerView />}
      {view === 'venue-screen' && <VenueScreen />}
      {showNameGenerator && <NameGenerator onClose={() => setShowNameGenerator(false)} />}
      {showChronicle && <Chronicle onClose={() => setShowChronicle(false)} />}
      {showQuickRoll && <QuickRoll onClose={() => setShowQuickRoll(false)} />}
      {showSheetImporter && <SheetImporter onClose={() => setShowSheetImporter(false)} />}
      {showHarrowing && <Harrowing onClose={() => setShowHarrowing(false)} />}
      {infoDialog && <AboutDialog {...infoDialog} onClose={() => setInfoDialog(null)} />}
    </div>
  );
}

export default App;
