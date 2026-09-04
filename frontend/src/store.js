import create from 'zustand';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const useStore = create((set, get) => ({
  // Campaign state
  campaigns: [],
  currentCampaign: null,
  ruleset: null,

  // Encounter state
  currentEncounter: null,
  actors: [],
  initiativeOrder: [],
  currentRound: 0,
  currentTurnIndex: 0,

  // Actor template state
  actorTemplates: [],

  // Ruleset config (skills/saves/abilities for the active ruleset)
  rulesetConfig: null,

  // UI state
  selectedActorId: null,
  selectedTemplateId: null,
  isEncounterActive: false,

  // Campaign actions
  listCampaigns: async () => {
    try {
      const res = await axios.get(`${API_URL}/campaign/list`);
      set({ campaigns: res.data.campaigns });
    } catch (error) {
      console.error('Failed to list campaigns:', error);
    }
  },

  createCampaign: async (name, ruleset) => {
    try {
      const res = await axios.post(`${API_URL}/campaign/new`, null, {
        params: { name, ruleset },
      });
      set({ currentCampaign: res.data, ruleset });
      return res.data;
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  },

  loadCampaign: async (name) => {
    try {
      const res = await axios.post(`${API_URL}/campaign/load`, null, {
        params: { name },
      });
      set({ currentCampaign: res.data, ruleset: res.data.ruleset });
      return res.data;
    } catch (error) {
      console.error('Failed to load campaign:', error);
    }
  },

  saveCampaign: async () => {
    try {
      await axios.post(`${API_URL}/campaign/save`);
    } catch (error) {
      console.error('Failed to save campaign:', error);
    }
  },

  fetchRulesetConfig: async (ruleset) => {
    try {
      const res = await axios.get(`${API_URL}/rules/${ruleset}`);
      set({ rulesetConfig: res.data });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch ruleset config:', error);
    }
  },

  // Encounter actions
  createEncounter: async (name, ruleset) => {
    try {
      const res = await axios.post(`${API_URL}/encounter/new`, null, {
        params: { name, ruleset },
      });
      set({
        currentEncounter: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to create encounter:', error);
    }
  },

  loadEncounter: async (encounterId) => {
    try {
      const res = await axios.post(`${API_URL}/encounter/load`, null, {
        params: { encounter_id: encounterId },
      });
      set({
        currentEncounter: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to load encounter:', error);
    }
  },

  saveEncounter: async () => {
    try {
      await axios.post(`${API_URL}/encounter/save`);
    } catch (error) {
      console.error('Failed to save encounter:', error);
    }
  },

  // Fetches the live encounter snapshot from the backend (source of truth shared by all windows).
  fetchCurrentEncounter: async () => {
    try {
      const res = await axios.get(`${API_URL}/encounter/current`);
      set({
        currentEncounter: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
        isEncounterActive: (res.data.initiative_order || []).length > 0,
      });
      return res.data;
    } catch (error) {
      // 404 simply means no encounter is loaded yet; not an error worth logging on every poll.
      if (error.response?.status !== 404) {
        console.error('Failed to fetch current encounter:', error);
      }
      return null;
    }
  },

  // Actor actions
  addActor: async (actor) => {
    try {
      const res = await axios.post(`${API_URL}/actor/add`, actor);
      const state = get();
      set({ actors: [...state.actors, res.data] });
      return res.data;
    } catch (error) {
      console.error('Failed to add actor:', error);
    }
  },

  updateActor: async (actorId, updatedActor) => {
    try {
      const res = await axios.put(`${API_URL}/actor/${actorId}`, updatedActor);
      const state = get();
      const updatedActors = state.actors.map((a) =>
        a.id === actorId ? res.data : a
      );
      set({ actors: updatedActors });
      return res.data;
    } catch (error) {
      console.error('Failed to update actor:', error);
    }
  },

  removeActor: async (actorId) => {
    try {
      await axios.delete(`${API_URL}/actor/${actorId}`);
      const state = get();
      set({ actors: state.actors.filter((a) => a.id !== actorId) });
    } catch (error) {
      console.error('Failed to remove actor:', error);
    }
  },

  // Actor template actions
  listActorTemplates: async () => {
    try {
      const res = await axios.get(`${API_URL}/campaign/actor-templates`);
      set({ actorTemplates: res.data.templates });
    } catch (error) {
      console.error('Failed to list actor templates:', error);
    }
  },

  saveActorTemplate: async (actor) => {
    try {
      const res = await axios.post(`${API_URL}/campaign/actor-template/add`, actor);
      const state = get();
      set({ actorTemplates: [...state.actorTemplates, res.data] });
      return res.data;
    } catch (error) {
      console.error('Failed to save actor template:', error);
    }
  },

  removeActorTemplate: async (templateId) => {
    try {
      await axios.delete(`${API_URL}/campaign/actor-template/${templateId}`);
      const state = get();
      set({ actorTemplates: state.actorTemplates.filter((t) => t.id !== templateId) });
    } catch (error) {
      console.error('Failed to remove actor template:', error);
    }
  },

  updateActorTemplate: async (templateId, updatedActor) => {
    try {
      const res = await axios.put(`${API_URL}/campaign/actor-template/${templateId}`, updatedActor);
      const state = get();
      set({
        actorTemplates: state.actorTemplates.map((t) => (t.id === templateId ? res.data : t)),
      });
      return res.data;
    } catch (error) {
      console.error('Failed to update actor template:', error);
    }
  },

  addActorFromTemplate: async (templateId) => {
    try {
      const res = await axios.post(`${API_URL}/encounter/actor/from-template/${templateId}`);
      const state = get();
      set({ actors: [...state.actors, res.data] });
      return res.data;
    } catch (error) {
      console.error('Failed to add actor from template:', error);
    }
  },

  // Initiative actions
  rollInitiative: async () => {
    try {
      const res = await axios.post(`${API_URL}/initiative/roll`);
      set({
        initiativeOrder: res.data.initiative_order,
        currentRound: res.data.round,
        currentTurnIndex: res.data.current_turn_index,
        isEncounterActive: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to roll initiative:', error);
    }
  },

  nextTurn: async () => {
    try {
      const res = await axios.post(`${API_URL}/initiative/next`);
      set({
        currentTurnIndex: res.data.turn_index,
        currentRound: res.data.round,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to advance turn:', error);
    }
  },

  // GM-controlled explicit ordering (e.g. entered from a physical die roll).
  setInitiativeOrder: async (actorIds) => {
    try {
      const res = await axios.post(`${API_URL}/initiative/set`, { actor_ids: actorIds });
      set({
        initiativeOrder: res.data.initiative_order,
        currentRound: res.data.round,
        currentTurnIndex: res.data.current_turn_index,
        isEncounterActive: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to set initiative order:', error);
    }
  },

  getInitiativeState: async () => {
    try {
      const res = await axios.get(`${API_URL}/initiative/state`);
      set({
        initiativeOrder: res.data.initiative_order,
        currentRound: res.data.round,
        currentTurnIndex: res.data.current_turn_index,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to get initiative state:', error);
    }
  },

  // Utility
  setSelectedActorId: (actorId) => set({ selectedActorId: actorId }),
  setSelectedTemplateId: (templateId) => set({ selectedTemplateId: templateId }),
}));
