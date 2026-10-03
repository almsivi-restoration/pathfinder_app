import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import '../styles/CampaignSelector.css';

function CampaignSelector({ onCampaignLoaded }) {
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignRuleset, setNewCampaignRuleset] = useState('');
  const [hoveredCampaign, setHoveredCampaign] = useState(null);
  const [renamingCampaign, setRenamingCampaign] = useState(null);
  const [renamedCampaignName, setRenamedCampaignName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const campaigns = useStore((state) => state.campaigns);
  const availableRulesets = useStore((state) => state.availableRulesets);
  const createCampaign = useStore((state) => state.createCampaign);
  const loadCampaign = useStore((state) => state.loadCampaign);
  const deleteCampaign = useStore((state) => state.deleteCampaign);
  const renameCampaign = useStore((state) => state.renameCampaign);
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

  const handleRenameCampaign = async (event) => {
    event.preventDefault();
    if (isRenaming || !renamedCampaignName.trim()) return;
    clearOperationError();
    setIsRenaming(true);
    const campaign = await renameCampaign(renamingCampaign, renamedCampaignName.trim());
    setIsRenaming(false);
    if (campaign) {
      setRenamingCampaign(null);
      setHoveredCampaign(null);
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

      {operationError && <div className="operation-message error">{operationError}</div>}
      <div className="selector-content">
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
                  {renamingCampaign === campaignName ? (
                    <form className="campaign-rename-form" onSubmit={handleRenameCampaign}>
                      <input
                        type="text"
                        aria-label="New campaign name"
                        value={renamedCampaignName}
                        onChange={(event) => setRenamedCampaignName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape' && !isRenaming) {
                            setRenamingCampaign(null);
                            clearOperationError();
                          }
                        }}
                        autoFocus
                        disabled={isRenaming}
                      />
                      <button className="btn-small" type="submit" disabled={isRenaming || !renamedCampaignName.trim() || renamedCampaignName.trim() === campaignName}>
                        Save
                      </button>
                      <button className="btn-small" type="button" disabled={isRenaming} onClick={() => {
                        setRenamingCampaign(null);
                        clearOperationError();
                      }}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button className="campaign-button" title={campaignName} disabled={isRenaming} onClick={() => handleLoadCampaign(campaignName)}>
                        <span className="campaign-button-marker" aria-hidden="true">&#9656;</span>
                        <span className="campaign-button-label">{campaignName}</span>
                      </button>
                      <button
                        className="btn-small campaign-rename-button"
                        aria-label={`Rename ${campaignName}`}
                        disabled={isRenaming}
                        onClick={() => {
                          clearOperationError();
                          setRenamingCampaign(campaignName);
                          setRenamedCampaignName(campaignName);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="campaign-delete-button"
                        disabled={isRenaming}
                        onClick={(event) => handleDeleteCampaign(campaignName, event)}
                      >
                        Delete
                      </button>
                    </>
                  )}
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
