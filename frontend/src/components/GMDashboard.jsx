import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import ActorList from './ActorList';
import InitiativeTracker from './InitiativeTracker';
import ActorForm from './ActorForm';
import ActorTemplateLibrary from './ActorTemplateLibrary';
import ActorEditModal from './ActorEditModal';
import '../styles/GMDashboard.css';

function GMDashboard() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const currentEncounter = useStore((state) => state.currentEncounter);
  const ruleset = useStore((state) => state.ruleset);
  const createEncounter = useStore((state) => state.createEncounter);
  const saveEncounter = useStore((state) => state.saveEncounter);
  const saveCampaign = useStore((state) => state.saveCampaign);
  const returnToCampaignSelector = useStore((state) => state.returnToCampaignSelector);
  const [newEncounterName, setNewEncounterName] = useState('');
  const [showActorForm, setShowActorForm] = useState(false);
  const [rulesetDropdown, setRulesetDropdown] = useState(ruleset);

  useEffect(() => {
    setRulesetDropdown(ruleset);
  }, [ruleset]);

  const handleCreateEncounter = async () => {
    if (!newEncounterName.trim()) return;
    await createEncounter(newEncounterName, rulesetDropdown);
    setNewEncounterName('');
  };

  const handleSaveAll = async () => {
    await saveEncounter();
    await saveCampaign();
    alert('Campaign and encounter saved!');
  };

  const handleOpenPlayerView = () => {
    if (window.electron) {
      window.electron.openPlayerWindow();
    } else {
      window.open('/?view=player', 'playerView', 'width=800,height=600');
    }
  };

  const handleBackToCampaigns = () => {
    if (window.confirm('Return to the campaign selector? Unsaved changes will be lost unless you Save All first.')) {
      returnToCampaignSelector();
    }
  };

  return (
    <div className="gm-dashboard">
      <header className="gm-header">
        <div className="header-left">
          <h1>{currentCampaign?.name || 'Pathfinder Encounter Manager'}</h1>
          <div className="ruleset-selector">
            <label>Ruleset: </label>
            <select
              value={rulesetDropdown}
              onChange={(e) => setRulesetDropdown(e.target.value)}
            >
              <option value="1e">Pathfinder 1e</option>
              <option value="2e">Pathfinder 2e</option>
            </select>
          </div>
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
        </div>
      </header>

      <div className="dashboard-content">
        {!currentEncounter ? (
          <div className="encounter-creator">
            <h2>Create or Load Encounter</h2>
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

            <h3>Campaign Actor Templates</h3>
            <ActorTemplateLibrary />
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
              {showActorForm && <ActorForm onActorAdded={() => setShowActorForm(false)} />}
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

      <ActorEditModal />
    </div>
  );
}

export default GMDashboard;
