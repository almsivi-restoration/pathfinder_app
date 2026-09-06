import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import '../styles/CampaignSelector.css';

function CampaignSelector({ onCampaignLoaded }) {
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignRuleset, setNewCampaignRuleset] = useState('');
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

  const handleDeleteCampaign = async (campaignName) => {
    if (window.confirm(`Delete ${campaignName} and all of its saved scenes? This cannot be undone.`)) {
      clearOperationError();
      await deleteCampaign(campaignName);
    }
  };

  return (
    <div className="campaign-selector">
      <h1>Game Master's Workbench</h1>
      {window.electron?.appVersion && (
        <div className="app-version">v{window.electron.appVersion}</div>
      )}

      <div className="selector-content">
        {operationError && <div className="operation-message error">{operationError}</div>}
        <div className="load-section">
          <h2>Load Campaign</h2>
          {campaigns.length > 0 ? (
            <div className="campaign-list">
              {campaigns.map((campaignName) => (
                <div key={campaignName} className="campaign-entry">
                  <button className="campaign-button" onClick={() => handleLoadCampaign(campaignName)}>
                    {campaignName}
                  </button>
                  <button className="campaign-delete-button" onClick={() => handleDeleteCampaign(campaignName)}>
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
    </div>
  );
}

export default CampaignSelector;
