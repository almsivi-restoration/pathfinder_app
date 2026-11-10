import React, { useEffect } from 'react';
import { useStore } from '../store';
import VenueMap from './VenueMap';
import '../styles/VenueScreen.css';

const POLL_INTERVAL_MS = 2000;

// The players' second-monitor map. Like the Player View, this window has its own store, so it
// polls the backend, which only ever sends the player-safe copy of the venue the GM is showing.
export default function VenueScreen() {
  const venue = useStore((state) => state.shownVenue);
  const fetchShownVenue = useStore((state) => state.fetchShownVenue);

  useEffect(() => {
    document.title = 'Venue Screen';
    fetchShownVenue();
    const intervalId = setInterval(fetchShownVenue, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchShownVenue]);

  // The header bar stays up while waiting, so the window reads as the Venue Screen
  // (and matches the Player View) before the GM has shown anything.
  return (
    <div className="venue-screen">
      <header className="venue-screen-header">
        <h1 title={venue?.name}>{venue ? venue.name : 'Venue Screen'}</h1>
      </header>
      {venue ? (
        <div className="venue-screen-map">
          <VenueMap venue={venue} mode="player" />
        </div>
      ) : (
        <div className="venue-screen-waiting">Waiting for the GM to show a venue…</div>
      )}
    </div>
  );
}
