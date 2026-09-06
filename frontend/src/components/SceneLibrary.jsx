import React from 'react';
import { useStore } from '../store';
import '../styles/SceneLibrary.css';

function SceneLibrary() {
  const scenes = useStore((state) => state.campaignScenes);
  const loadScene = useStore((state) => state.loadScene);
  const deleteScene = useStore((state) => state.deleteScene);
  const clearOperationError = useStore((state) => state.clearOperationError);

  const handleLoad = async (sceneId) => {
    clearOperationError();
    await loadScene(sceneId);
  };

  const handleDelete = async (scene) => {
    if (window.confirm(`Delete ${scene.name}? This cannot be undone.`)) {
      clearOperationError();
      await deleteScene(scene.id);
    }
  };

  if (scenes.length === 0) {
    return <div className="scene-library empty">No saved scenes yet.</div>;
  }

  return (
    <div className="scene-library">
      {scenes.map((scene) => (
        <div className="scene-library-row" key={scene.id}>
          <div>
            <strong>{scene.name}</strong>
            <span>{scene.actors.length} actors · Round {scene.current_round || 0}</span>
          </div>
          <div className="scene-library-actions">
            <button className="btn-small btn-add" onClick={() => handleLoad(scene.id)}>Load</button>
            <button className="btn-small" onClick={() => handleDelete(scene)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SceneLibrary;