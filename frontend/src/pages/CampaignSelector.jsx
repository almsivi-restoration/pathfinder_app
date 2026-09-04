import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import '../styles/CampaignSelector.css';

function CampaignSelector({ onCampaignLoaded }) {
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignRuleset, setNewCampaignRuleset] = useState('1e');
  const campaigns = useStore((state) => state.campaigns);
  const createCampaign = useStore((state) => state.createCampaign);
  const loadCampaign = useStore((state) => state.loadCampaign);
  const listCampaigns = useStore((state) => state.listCampaigns);

  useEffect(() => {
    listCampaigns();
  }, [listCampaigns]);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    await createCampaign(newCampaignName, newCampaignRuleset);
    setNewCampaignName('');
    await listCampaigns();
    onCampaignLoaded();
  };

  const handleLoadCampaign = async (campaignName) => {
    await loadCampaign(campaignName);
    onCampaignLoaded();
  };

  return (
    <div className="campaign-selector">
      <h1>Pathfinder Encounter Manager</h1>

      <div className="selector-content">
        <div className="load-section">
          <h2>Load Campaign</h2>
          {campaigns.length > 0 ? (
            <div className="campaign-list">
              {campaigns.map((campaignName) => (
                <button
                  key={campaignName}
                  className="campaign-button"
                  onClick={() => handleLoadCampaign(campaignName)}
                >
                  {campaignName}
                </button>
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
          <select
            value={newCampaignRuleset}
            onChange={(e) => setNewCampaignRuleset(e.target.value)}
          >
            <option value="1e">Pathfinder 1e</option>
            <option value="2e">Pathfinder 2e</option>
          </select>
          <button
            className="create-button"
            onClick={handleCreateCampaign}
            disabled={!newCampaignName.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default CampaignSelector;
