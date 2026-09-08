import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import ActorList from './ActorList';
import InitiativeTracker from './InitiativeTracker';
import ActorForm from './ActorForm';
import ActorTemplateLibrary from './ActorTemplateLibrary';
import ActorEditModal from './ActorEditModal';
import ActorViewModal from './ActorViewModal';
import SceneLibrary from './SceneLibrary';
import '../styles/GMDashboard.css';

function GMDashboard() {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const currentScene = useStore((state) => state.currentScene);
  const createScene = useStore((state) => state.createScene);
  const saveScene = useStore((state) => state.saveScene);
  const saveCampaign = useStore((state) => state.saveCampaign);
  const closeScene = useStore((state) => state.closeScene);
  const fetchCampaignScenes = useStore((state) => state.fetchCampaignScenes);
  const isCampaignDirty = useStore((state) => state.isCampaignDirty);
  const isSceneDirty = useStore((state) => state.isSceneDirty);
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);
  const returnToCampaignSelector = useStore((state) => state.returnToCampaignSelector);
  const [newSceneName, setNewSceneName] = useState('');
  const [showActorForm, setShowActorForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (currentCampaign) fetchCampaignScenes();
  }, [currentCampaign, fetchCampaignScenes]);

  const handleCreateScene = async () => {
    if (!newSceneName.trim()) return;
    clearOperationError();
    const scene = await createScene(newSceneName);
    if (scene) setNewSceneName('');
  };

  const handleSaveAll = async () => {
    clearOperationError();
    const sceneSaved = currentScene ? await saveScene() : true;
    const campaignSaved = await saveCampaign();
    setSaveMessage(sceneSaved && campaignSaved
      ? currentScene ? 'Campaign and scene saved.' : 'Campaign saved.'
      : 'Save failed. Your unsaved changes remain open.');
  };

  const handleCloseScene = async () => {
    if (isSceneDirty && !window.confirm('Close this scene without saving its changes?')) return;
    clearOperationError();
    await closeScene();
  };

  const handleOpenPlayerView = () => {
    if (window.electron) {
      window.electron.openPlayerWindow();
    } else {
      window.open('/?view=player', 'playerView', 'width=800,height=600');
    }
  };

  const handleBackToCampaigns = () => {
    if ((!isCampaignDirty && !isSceneDirty) || window.confirm('Return to the campaign selector? Unsaved changes will be lost unless you Save All first.')) {
      returnToCampaignSelector();
    }
  };

  return (
    <div className="gm-dashboard">
      <header className="gm-header">
        <div className="header-left">
          <h1>{currentCampaign?.name || "Game Master's Workbench"}</h1>
          <div className="ruleset-selector">Ruleset: {currentCampaign?.ruleset}</div>
          {(isCampaignDirty || isSceneDirty) && <span className="dirty-indicator">Unsaved changes</span>}
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
          {currentScene && <button className="btn btn-secondary" onClick={handleCloseScene}>Close Scene</button>}
        </div>
      </header>

      <div className="dashboard-content">
        {(operationError || saveMessage) && <div className={`operation-message ${operationError ? 'error' : 'success'}`}>{operationError || saveMessage}</div>}
        {!currentScene ? (
          <div className="scene-creator">
            <h2>Campaign Actors</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowActorForm(true)}
            >
              Create Campaign Actor
            </button>
            <ActorTemplateLibrary />

            <h2>Create or Load Scene</h2>
            <SceneLibrary />
            <input
              type="text"
              placeholder="Scene name"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreateScene}
              disabled={!newSceneName.trim()}
            >
              Create Scene
            </button>

          </div>
        ) : (
          <div className="scene-active">
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
          allowSceneAdd={Boolean(currentScene)}
          onActorAdded={() => setShowActorForm(false)}
        />
      )}
      <ActorEditModal />
      <ActorViewModal />
    </div>
  );
}

export default GMDashboard;
