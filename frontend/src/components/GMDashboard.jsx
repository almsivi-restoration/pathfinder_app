import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import ActorList from './ActorList';
import InitiativeTracker from './InitiativeTracker';
import ActorForm from './ActorForm';
import ActorTemplateLibrary from './ActorTemplateLibrary';
import ActorEditModal from './ActorEditModal';
import EncounterLibrary from './EncounterLibrary';
import '../styles/GMDashboard.css';

function GMDashboard() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const currentEncounter = useStore((state) => state.currentEncounter);
  const createEncounter = useStore((state) => state.createEncounter);
  const saveEncounter = useStore((state) => state.saveEncounter);
  const saveCampaign = useStore((state) => state.saveCampaign);
  const closeEncounter = useStore((state) => state.closeEncounter);
  const fetchCampaignEncounters = useStore((state) => state.fetchCampaignEncounters);
  const isCampaignDirty = useStore((state) => state.isCampaignDirty);
  const isEncounterDirty = useStore((state) => state.isEncounterDirty);
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);
  const returnToCampaignSelector = useStore((state) => state.returnToCampaignSelector);
  const [newEncounterName, setNewEncounterName] = useState('');
  const [showActorForm, setShowActorForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (currentCampaign) fetchCampaignEncounters();
  }, [currentCampaign, fetchCampaignEncounters]);

  const handleCreateEncounter = async () => {
    if (!newEncounterName.trim()) return;
    clearOperationError();
    const encounter = await createEncounter(newEncounterName);
    if (encounter) setNewEncounterName('');
  };

  const handleSaveAll = async () => {
    clearOperationError();
    const encounterSaved = currentEncounter ? await saveEncounter() : true;
    const campaignSaved = await saveCampaign();
    setSaveMessage(encounterSaved && campaignSaved
      ? currentEncounter ? 'Campaign and encounter saved.' : 'Campaign saved.'
      : 'Save failed. Your unsaved changes remain open.');
  };

  const handleCloseEncounter = async () => {
    if (isEncounterDirty && !window.confirm('Close this encounter without saving its changes?')) return;
    clearOperationError();
    await closeEncounter();
  };

  const handleOpenPlayerView = () => {
    if (window.electron) {
      window.electron.openPlayerWindow();
    } else {
      window.open('/?view=player', 'playerView', 'width=800,height=600');
    }
  };

  const handleBackToCampaigns = () => {
    if ((!isCampaignDirty && !isEncounterDirty) || window.confirm('Return to the campaign selector? Unsaved changes will be lost unless you Save All first.')) {
      returnToCampaignSelector();
    }
  };

  return (
    <div className="gm-dashboard">
      <header className="gm-header">
        <div className="header-left">
          <h1>{currentCampaign?.name || "Game Master's Workbench"}</h1>
          <div className="ruleset-selector">Ruleset: {currentCampaign?.ruleset}</div>
          {(isCampaignDirty || isEncounterDirty) && <span className="dirty-indicator">Unsaved changes</span>}
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={handleBackToCampaigns}>
            Back to Campaigns
          </button>
          <button className="btn btn-primary" onClick={handleOpenPlayerView}>
            Open Player View
          </button>
          <button className="btn btn-secondary" onClick={handleSaveAll}>
            Save All
          </button>
          {currentEncounter && <button className="btn btn-secondary" onClick={handleCloseEncounter}>Close Encounter</button>}
        </div>
      </header>

      <div className="dashboard-content">
        {(operationError || saveMessage) && <div className={`operation-message ${operationError ? 'error' : 'success'}`}>{operationError || saveMessage}</div>}
        {!currentEncounter ? (
          <div className="encounter-creator">
            <h2>Campaign Actors</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowActorForm(true)}
            >
              Create Campaign Actor
            </button>
            <ActorTemplateLibrary />

            <h2>Create or Load Encounter</h2>
            <EncounterLibrary />
            <input
              type="text"
              placeholder="Encounter name"
              value={newEncounterName}
              onChange={(e) => setNewEncounterName(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreateEncounter}
              disabled={!newEncounterName.trim()}
            >
              Create Encounter
            </button>

          </div>
        ) : (
          <div className="encounter-active">
            <div className="left-panel">
              <h2>Actors</h2>
              <button
                className="btn btn-primary"
                onClick={() => setShowActorForm(!showActorForm)}
              >
                {showActorForm ? 'Hide Form' : 'Add Actor'}
              </button>
              <h3>Campaign Templates</h3>
              <ActorTemplateLibrary />
              <ActorList />
            </div>

            <div className="right-panel">
              <InitiativeTracker />
            </div>
          </div>
        )}
      </div>

      {showActorForm && (
        <ActorForm
          allowEncounterAdd={Boolean(currentEncounter)}
          onActorAdded={() => setShowActorForm(false)}
        />
      )}
      <ActorEditModal />
    </div>
  );
}

export default GMDashboard;
