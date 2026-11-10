import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import VenueEditor from '../components/VenueEditor';
import VenueLibrary from '../components/VenueLibrary';
import '../styles/Venues.css';

const confirmDiscard = () => (
  !useStore.getState().venueEditorDirty || window.confirm('Discard unsaved changes to this venue?')
);

function Venues({ onBack }) {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const venues = useStore((state) => state.venues);
  const shownVenueId = useStore((state) => state.shownVenueId);
  const operationError = useStore((state) => state.operationError);
  const fetchVenues = useStore((state) => state.fetchVenues);
  const fetchVenue = useStore((state) => state.fetchVenue);
  const createVenue = useStore((state) => state.createVenue);
  const saveVenue = useStore((state) => state.saveVenue);
  const deleteVenue = useStore((state) => state.deleteVenue);
  const showVenue = useStore((state) => state.showVenue);
  const hideVenue = useStore((state) => state.hideVenue);
  const setVenueEditorDirty = useStore((state) => state.setVenueEditorDirty);
  const [openVenue, setOpenVenue] = useState(null);

  useEffect(() => {
    if (currentCampaign) fetchVenues();
  }, [currentCampaign, fetchVenues]);

  useEffect(() => () => setVenueEditorDirty(false), [setVenueEditorDirty]);

  const openEditor = (venue) => {
    setVenueEditorDirty(false);
    setOpenVenue(venue);
  };

  const handleSelect = async (venueId) => {
    if (venueId === openVenue?.id || !confirmDiscard()) return;
    const venue = await fetchVenue(venueId);
    if (venue) openEditor(venue);
  };

  const handleCreate = async (spec) => {
    if (!confirmDiscard()) return null;
    const venue = await createVenue(spec);
    if (venue) openEditor(venue);
    return venue;
  };

  const handleDelete = async (venueId) => {
    const entry = venues.find((venue) => venue.id === venueId);
    if (!window.confirm(`Delete the venue "${entry?.name || venueId}"? This cannot be undone.`)) return;
    const deleted = await deleteVenue(venueId);
    if (deleted && openVenue?.id === venueId) {
      setVenueEditorDirty(false);
      setOpenVenue(null);
    }
  };

  const handleBack = () => {
    if (confirmDiscard()) onBack();
  };

  const handleDirtyChange = useCallback((dirty) => setVenueEditorDirty(dirty), [setVenueEditorDirty]);
  const canOpenScreen = Boolean(window.electron?.openVenueWindow);

  if (!currentCampaign) {
    return (
      <main className="venues-page">
        <header className="venues-header">
          <h1>Venues</h1>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
        </header>
        <p className="venues-empty">Load a campaign to build its venues.</p>
      </main>
    );
  }

  return (
    <main className="venues-page">
      <header className="venues-header">
        <div>
          <h1>Venues</h1>
          <p>{currentCampaign.name} · battle maps saved with this campaign</p>
        </div>
        <div className="venues-header-actions">
          {canOpenScreen && (
            <button
              className="btn btn-secondary"
              onClick={() => window.electron.openVenueWindow()}
              title="Open the players' map window, for a second monitor"
            >
              Open Venue Screen
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleBack}>Back to GM Dashboard</button>
        </div>
      </header>

      {operationError && <div className="operation-message error">{operationError}</div>}

      <div className="venues-body">
        <VenueLibrary
          venues={venues}
          selectedId={openVenue?.id || null}
          shownVenueId={shownVenueId}
          onSelect={handleSelect}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
        {openVenue ? (
          <VenueEditor
            key={openVenue.id}
            venue={openVenue}
            onSave={saveVenue}
            onDirtyChange={handleDirtyChange}
            shown={shownVenueId === openVenue.id}
            onShow={() => showVenue(openVenue.id)}
            onHide={hideVenue}
          />
        ) : (
          <div className="venues-placeholder">
            <p>Create a venue or pick one from the list.</p>
            <p>
              Drag out rooms with the <strong>Room</strong> tool — walls draw themselves — then add doors and
              stamps. Sizes are in one-inch squares, matching the table mat.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default Venues;
