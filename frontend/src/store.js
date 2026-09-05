import create from 'zustand';
import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const getErrorMessage = (error) => error.response?.data?.detail || error.message || 'The request failed.';

export const useStore = create((set, get) => ({
  // Campaign state
  campaigns: [],
  currentCampaign: null,
  ruleset: null,
  availableRulesets: [],
  referenceSources: [],
  referenceDocuments: [],
  referenceResults: [],
  campaignEncounters: [],

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
  isCampaignDirty: false,
  isEncounterDirty: false,
  operationError: null,

  clearOperationError: () => set({ operationError: null }),

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
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  fetchRulesets: async () => {
    try {
      const res = await axios.get(`${API_URL}/rulesets`);
      set({ availableRulesets: res.data.rulesets });
      return res.data.rulesets;
    } catch (error) {
      console.error('Failed to fetch available rulesets:', error);
      return [];
    }
  },

  loadCampaign: async (name) => {
    try {
      const res = await axios.post(`${API_URL}/campaign/load`, null, {
        params: { name },
      });
      set({
        currentCampaign: res.data,
        ruleset: res.data.ruleset,
        currentEncounter: null,
        actors: [],
        initiativeOrder: [],
        campaignEncounters: [],
        isCampaignDirty: false,
        isEncounterDirty: false,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to load campaign:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  deleteCampaign: async (name) => {
    try {
      await axios.delete(`${API_URL}/campaign/${encodeURIComponent(name)}`);
      const state = get();
      set({ campaigns: state.campaigns.filter((campaignName) => campaignName !== name) });
      return true;
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  saveCampaign: async () => {
    try {
      await axios.post(`${API_URL}/campaign/save`);
      set({ isCampaignDirty: false });
      return true;
    } catch (error) {
      console.error('Failed to save campaign:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  fetchRulesetConfig: async () => {
    try {
      const res = await axios.get(`${API_URL}/rules/current`);
      set({ rulesetConfig: res.data });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch ruleset config:', error);
    }
  },

  fetchCurrentReferences: async () => {
    try {
      const res = await axios.get(`${API_URL}/references/current`);
      set({
        referenceSources: res.data.source_files,
        referenceDocuments: res.data.documents,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch local references:', error);
    }
  },

  importCurrentReference: async (filename) => {
    try {
      const res = await axios.post(`${API_URL}/references/current/import`, { filename });
      await get().fetchCurrentReferences();
      return res.data;
    } catch (error) {
      console.error('Failed to index local reference:', error);
    }
  },

  searchCurrentReferences: async (query) => {
    if (!query.trim()) {
      set({ referenceResults: [] });
      return [];
    }
    try {
      const res = await axios.get(`${API_URL}/references/current/search`, { params: { query } });
      set({ referenceResults: res.data.results });
      return res.data.results;
    } catch (error) {
      console.error('Failed to search local references:', error);
      return [];
    }
  },

  // Encounter actions
  fetchCampaignEncounters: async () => {
    try {
      const res = await axios.get(`${API_URL}/encounters`);
      set({ campaignEncounters: res.data.encounters });
      return res.data.encounters;
    } catch (error) {
      console.error('Failed to fetch campaign encounters:', error);
      set({ operationError: getErrorMessage(error) });
      return [];
    }
  },

  createEncounter: async (name) => {
    try {
      const res = await axios.post(`${API_URL}/encounter/new`, null, {
        params: { name },
      });
      set({
        currentEncounter: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
        campaignEncounters: [...get().campaignEncounters, res.data],
        isCampaignDirty: true,
        isEncounterDirty: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to create encounter:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
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
        isEncounterDirty: false,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to load encounter:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  closeEncounter: async () => {
    try {
      await axios.post(`${API_URL}/encounter/close`);
      set({ currentEncounter: null, actors: [], initiativeOrder: [], currentRound: 0, currentTurnIndex: 0, isEncounterActive: false, isEncounterDirty: false });
      return true;
    } catch (error) {
      console.error('Failed to close encounter:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  deleteEncounter: async (encounterId) => {
    try {
      await axios.delete(`${API_URL}/encounter/${encounterId}`);
      const state = get();
      const isCurrent = state.currentEncounter?.id === encounterId;
      set({
        campaignEncounters: state.campaignEncounters.filter((encounter) => encounter.id !== encounterId),
        isCampaignDirty: false,
        ...(isCurrent ? { currentEncounter: null, actors: [], initiativeOrder: [], currentRound: 0, currentTurnIndex: 0, isEncounterActive: false, isEncounterDirty: false } : {}),
      });
      return true;
    } catch (error) {
      console.error('Failed to delete encounter:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  saveEncounter: async () => {
    try {
      await axios.post(`${API_URL}/encounter/save`);
      set({ isEncounterDirty: false });
      return true;
    } catch (error) {
      console.error('Failed to save encounter:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
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
      set({ isEncounterDirty: true });
      return res.data;
    } catch (error) {
      console.error('Failed to add actor:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
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
      set({ isEncounterDirty: true });
      return res.data;
    } catch (error) {
      console.error('Failed to update actor:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  removeActor: async (actorId) => {
    try {
      await axios.delete(`${API_URL}/actor/${actorId}`);
      const state = get();
      set({ actors: state.actors.filter((a) => a.id !== actorId) });
      set({ isEncounterDirty: true });
      return true;
    } catch (error) {
      console.error('Failed to remove actor:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
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
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  removeActorTemplate: async (templateId) => {
    try {
      await axios.delete(`${API_URL}/campaign/actor-template/${templateId}`);
      const state = get();
      set({ actorTemplates: state.actorTemplates.filter((t) => t.id !== templateId) });
      return true;
    } catch (error) {
      console.error('Failed to remove actor template:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
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
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  addActorFromTemplate: async (templateId) => {
    try {
      const res = await axios.post(`${API_URL}/encounter/actor/from-template/${templateId}`);
      const state = get();
      set({ actors: [...state.actors, res.data] });
      set({ isEncounterDirty: true });
      return res.data;
    } catch (error) {
      console.error('Failed to add actor from template:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
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
        isEncounterDirty: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to roll initiative:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  nextTurn: async () => {
    try {
      const res = await axios.post(`${API_URL}/initiative/next`);
      set({
        currentTurnIndex: res.data.turn_index,
        currentRound: res.data.round,
        isEncounterDirty: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to advance turn:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
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
        isEncounterDirty: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to set initiative order:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
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

  // Clears all campaign/encounter session state so the app falls back to the campaign selector.
  returnToCampaignSelector: () => set({
    currentCampaign: null,
    ruleset: null,
    availableRulesets: [],
    referenceSources: [],
    referenceDocuments: [],
    referenceResults: [],
    campaignEncounters: [],
    currentEncounter: null,
    actors: [],
    initiativeOrder: [],
    currentRound: 0,
    currentTurnIndex: 0,
    actorTemplates: [],
    rulesetConfig: null,
    selectedActorId: null,
    selectedTemplateId: null,
    isEncounterActive: false,
    isCampaignDirty: false,
    isEncounterDirty: false,
    operationError: null,
  }),
}));
