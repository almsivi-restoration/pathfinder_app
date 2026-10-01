import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import '../styles/CampaignSelector.css';

function CampaignSelector({ onCampaignLoaded }) {
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignRuleset, setNewCampaignRuleset] = useState('');
  const [hoveredCampaign, setHoveredCampaign] = useState(null);
  const campaigns = useStore((state) => state.campaigns);
  const availableRulesets = useStore((state) => state.availableRulesets);
  const createCampaign = useStore((state) => state.createCampaign);
  const loadCampaign = useStore((state) => state.loadCampaign);
  const deleteCampaign = useStore((state) => state.deleteCampaign);
  const listCampaigns = useStore((state) => state.listCampaigns);
  const fetchRulesets = useStore((state) => state.fetchRulesets);
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);

  useEffect(() => {
    listCampaigns();
    fetchRulesets().then((rulesets) => {
      if (rulesets.length > 0) setNewCampaignRuleset(rulesets[0].id);
    });
  }, [fetchRulesets, listCampaigns]);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    clearOperationError();
    const campaign = await createCampaign(newCampaignName, newCampaignRuleset);
    if (!campaign) return;
    setNewCampaignName('');
    await listCampaigns();
    onCampaignLoaded();
  };

  const handleLoadCampaign = async (campaignName) => {
    clearOperationError();
    const campaign = await loadCampaign(campaignName);
    if (campaign) onCampaignLoaded();
  };

  const handleDeleteCampaign = async (campaignName, event) => {
    event.stopPropagation();
    if (window.confirm(`Delete ${campaignName} and all of its saved scenes? This cannot be undone.`)) {
      clearOperationError();
      await deleteCampaign(campaignName);
    }
  };

  const footerHint = hoveredCampaign
    ? `Resume "${hoveredCampaign}" where you left off.`
    : 'Load a saved campaign, or forge a new one to begin the session.';

  return (
    <div className="campaign-selector">
      <div className="campaign-selector-titlebar">
        <div className="mw-banner">Game Master's Workbench</div>
        {window.electron?.appVersion && (
          <div className="app-version">v{window.electron.appVersion}</div>
        )}
      </div>

      <div className="selector-content">
        {operationError && <div className="operation-message error">{operationError}</div>}
        <div className="load-section">
          <h2>Load Campaign</h2>
          {campaigns.length > 0 ? (
            <div className="campaign-list">
              {campaigns.map((campaignName) => (
                <div
                  key={campaignName}
                  className="campaign-entry"
                  onMouseEnter={() => setHoveredCampaign(campaignName)}
                  onMouseLeave={() => setHoveredCampaign((current) => (current === campaignName ? null : current))}
                >
                  <button className="campaign-button" onClick={() => handleLoadCampaign(campaignName)}>
                    <span className="campaign-button-marker" aria-hidden="true">&#9656;</span>
                    <span className="campaign-button-label">{campaignName}</span>
                  </button>
                  <button
                    className="campaign-delete-button"
                    onClick={(event) => handleDeleteCampaign(campaignName, event)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>No campaigns found. Create a new one!</p>
          )}
        </div>

        <div className="divider">OR</div>

        <div className="new-section">
          <h2>New Campaign</h2>
          <input
            type="text"
            placeholder="Campaign name"
            value={newCampaignName}
            onChange={(e) => setNewCampaignName(e.target.value)}
          />
          <select value={newCampaignRuleset} onChange={(e) => setNewCampaignRuleset(e.target.value)}>
            {availableRulesets.map((ruleset) => (
              <option key={ruleset.id} value={ruleset.id}>{ruleset.name}</option>
            ))}
          </select>
          <button
            className="create-button"
            onClick={handleCreateCampaign}
            disabled={!newCampaignName.trim() || !newCampaignRuleset}
          >
            Create
          </button>
        </div>
      </div>

      <div className="campaign-selector-footer">
        <span className="campaign-selector-footer-hint">{footerHint}</span>
        <span className="campaign-selector-footer-count">
          {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'} saved
        </span>
      </div>
    </div>
  );
}

export default CampaignSelector;
