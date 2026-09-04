import React from 'react';
import { useStore } from '../store';
import ActorRow from './ActorRow';
import '../styles/ActorList.css';

function ActorList() {
  const actors = useStore((state) => state.actors);

  if (actors.length === 0) {
    return <div className="actor-list empty">No actors in encounter</div>;
  }

  return (
    <div className="actor-list">
      <div className="actor-header">
        <span className="col-name">Name</span>
        <span className="col-type">Type</span>
        <span className="col-hp">HP</span>
        <span className="col-ac">AC</span>
        <span className="col-init">Init</span>
        <span className="col-actions">Actions</span>
      </div>
      {actors.map((actor) => (
        <ActorRow key={actor.id} actor={actor} />
      ))}
    </div>
  );
}

export default ActorList;
