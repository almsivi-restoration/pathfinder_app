import React from 'react';
import { useStore } from '../store';
import ActorRow from './ActorRow';
import '../styles/ActorList.css';

function ActorList() {
  const actors = useStore((state) => state.actors);
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const summaryFields = rulesetConfig?.actor_sheet?.summary || [];

  if (actors.length === 0) {
    return <div className="actor-list empty">No actors in scene</div>;
  }

  return (
    <div className="actor-list">
      <div className="actor-header">
        <span className="col-name">Name</span>
        <span className="col-type">Type</span>
        {summaryFields.map((field) => (
          <span key={field.value_key} className="col-stat">{field.label}</span>
        ))}
        <span className="col-actions">Actions</span>
      </div>
      {actors.map((actor) => (
        <ActorRow key={actor.id} actor={actor} summaryFields={summaryFields} />
      ))}
    </div>
  );
}

export default ActorList;
