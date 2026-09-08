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
  ocrAvailable: false,
  bestiaryStatus: null,
  bestiaryResults: [],
  chronicleEntries: [],
  campaignScenes: [],

  // Scene state
  currentScene: null,
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
  viewingActorId: null,
  viewingTemplateId: null,
  isSceneActive: false,
  isCampaignDirty: false,
  isSceneDirty: false,
  operationError: null,

  clearOperationError: () => set({ operationError: null }),

  // Name generator
  fetchNameCategories: async () => {
    try {
      const res = await axios.get(`${API_URL}/names/categories`);
      return res.data;
    } catch (error) {
      console.error('Failed to fetch name categories:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  generateNames: async ({ category, count, race, placeLevel }) => {
    try {
      const res = await axios.get(`${API_URL}/names/generate`, {
        params: {
          category,
          count,
          ...(race ? { race } : {}),
          ...(placeLevel ? { place_level: placeLevel } : {}),
        },
      });
      return res.data.names;
    } catch (error) {
      console.error('Failed to generate names:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

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
        currentScene: null,
        actors: [],
        initiativeOrder: [],
        campaignScenes: [],
        chronicleEntries: [],
        isCampaignDirty: false,
        isSceneDirty: false,
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
        ocrAvailable: !!res.data.ocr_available,
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

  // Bestiary actions
  fetchBestiaryStatus: async () => {
    try {
      const res = await axios.get(`${API_URL}/bestiary/current/status`);
      set({ bestiaryStatus: res.data });
      return res.data;
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch bestiary status:', error);
        set({ operationError: getErrorMessage(error) });
      }
      set({ bestiaryStatus: null });
      return null;
    }
  },

  importBestiary: async () => {
    try {
      const res = await axios.post(`${API_URL}/bestiary/current/import`);
      await get().fetchBestiaryStatus();
      return res.data;
    } catch (error) {
      console.error('Failed to import bestiary:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  searchBestiary: async ({ query, crMin, crMax, monsterType }) => {
    try {
      const res = await axios.get(`${API_URL}/bestiary/current/search`, {
        params: {
          query: query || '',
          ...(crMin !== '' && crMin != null ? { cr_min: crMin } : {}),
          ...(crMax !== '' && crMax != null ? { cr_max: crMax } : {}),
          ...(monsterType ? { monster_type: monsterType } : {}),
        },
      });
      set({ bestiaryResults: res.data.results });
      return res.data.results;
    } catch (error) {
      console.error('Failed to search bestiary:', error);
      set({ operationError: getErrorMessage(error) });
      return [];
    }
  },

  fetchBestiaryEntry: async (entryId) => {
    try {
      const res = await axios.get(`${API_URL}/bestiary/current/entry/${entryId}`);
      return res.data;
    } catch (error) {
      console.error('Failed to fetch bestiary entry:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  fetchBestiaryEntryActor: async (entryId) => {
    try {
      const res = await axios.get(`${API_URL}/bestiary/current/entry/${entryId}/actor`);
      return res.data;
    } catch (error) {
      console.error('Failed to map bestiary entry:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  // Chronicle actions
  fetchChronicle: async () => {
    try {
      const res = await axios.get(`${API_URL}/campaign/chronicle`);
      set({ chronicleEntries: res.data.entries });
      return res.data.entries;
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch chronicle:', error);
        set({ operationError: getErrorMessage(error) });
      }
      return [];
    }
  },

  addChronicleEntry: async ({ title, body }) => {
    try {
      const res = await axios.post(`${API_URL}/campaign/chronicle/add`, { title, body });
      set({ chronicleEntries: [...get().chronicleEntries, res.data] });
      return res.data;
    } catch (error) {
      console.error('Failed to add chronicle entry:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  updateChronicleEntry: async (entryId, { title, body }) => {
    try {
      const res = await axios.put(`${API_URL}/campaign/chronicle/${entryId}`, { title, body });
      set({
        chronicleEntries: get().chronicleEntries.map((entry) => (entry.id === entryId ? res.data : entry)),
      });
      return res.data;
    } catch (error) {
      console.error('Failed to update chronicle entry:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  deleteChronicleEntry: async (entryId) => {
    try {
      await axios.delete(`${API_URL}/campaign/chronicle/${entryId}`);
      set({ chronicleEntries: get().chronicleEntries.filter((entry) => entry.id !== entryId) });
      return true;
    } catch (error) {
      console.error('Failed to delete chronicle entry:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  // Scene actions
  fetchCampaignScenes: async () => {
    try {
      const res = await axios.get(`${API_URL}/scenes`);
      set({ campaignScenes: res.data.scenes });
      return res.data.scenes;
    } catch (error) {
      console.error('Failed to fetch campaign scenes:', error);
      set({ operationError: getErrorMessage(error) });
      return [];
    }
  },

  createScene: async (name) => {
    try {
      const res = await axios.post(`${API_URL}/scene/new`, null, {
        params: { name },
      });
      set({
        currentScene: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
        campaignScenes: [...get().campaignScenes, res.data],
        isCampaignDirty: true,
        isSceneDirty: true,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to create scene:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  loadScene: async (sceneId) => {
    try {
      const res = await axios.post(`${API_URL}/scene/load`, null, {
        params: { scene_id: sceneId },
      });
      set({
        currentScene: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
        isSceneDirty: false,
      });
      return res.data;
    } catch (error) {
      console.error('Failed to load scene:', error);
      set({ operationError: getErrorMessage(error) });
      return null;
    }
  },

  closeScene: async () => {
    try {
      await axios.post(`${API_URL}/scene/close`);
      set({ currentScene: null, actors: [], initiativeOrder: [], currentRound: 0, currentTurnIndex: 0, isSceneActive: false, isSceneDirty: false });
      return true;
    } catch (error) {
      console.error('Failed to close scene:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  deleteScene: async (sceneId) => {
    try {
      await axios.delete(`${API_URL}/scene/${sceneId}`);
      const state = get();
      const isCurrent = state.currentScene?.id === sceneId;
      set({
        campaignScenes: state.campaignScenes.filter((scene) => scene.id !== sceneId),
        isCampaignDirty: false,
        ...(isCurrent ? { currentScene: null, actors: [], initiativeOrder: [], currentRound: 0, currentTurnIndex: 0, isSceneActive: false, isSceneDirty: false } : {}),
      });
      return true;
    } catch (error) {
      console.error('Failed to delete scene:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  saveScene: async () => {
    try {
      await axios.post(`${API_URL}/scene/save`);
      set({ isSceneDirty: false });
      return true;
    } catch (error) {
      console.error('Failed to save scene:', error);
      set({ operationError: getErrorMessage(error) });
      return false;
    }
  },

  // Fetches the live scene snapshot from the backend (source of truth shared by all windows).
  fetchCurrentScene: async () => {
    try {
      const res = await axios.get(`${API_URL}/scene/current`);
      set({
        currentScene: res.data,
        actors: res.data.actors || [],
        initiativeOrder: res.data.initiative_order || [],
        currentRound: res.data.current_round || 0,
        currentTurnIndex: res.data.current_turn_index || 0,
        isSceneActive: (res.data.initiative_order || []).length > 0,
      });
      return res.data;
    } catch (error) {
      // 404 simply means no scene is loaded yet; not an error worth logging on every poll.
      if (error.response?.status !== 404) {
        console.error('Failed to fetch current scene:', error);
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
      set({ isSceneDirty: true });
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
      set({ isSceneDirty: true });
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
      set({ isSceneDirty: true });
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
      const res = await axios.post(`${API_URL}/scene/actor/from-template/${templateId}`);
      const state = get();
      set({ actors: [...state.actors, res.data] });
      set({ isSceneDirty: true });
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
        isSceneActive: true,
        isSceneDirty: true,
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
        isSceneDirty: true,
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
        isSceneActive: true,
        isSceneDirty: true,
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
  setViewingActorId: (actorId) => set({ viewingActorId: actorId, viewingTemplateId: null }),
  setViewingTemplateId: (templateId) => set({ viewingTemplateId: templateId, viewingActorId: null }),

  // Clears all campaign/scene session state so the app falls back to the campaign selector.
  returnToCampaignSelector: () => set({
    currentCampaign: null,
    ruleset: null,
    availableRulesets: [],
    referenceSources: [],
    referenceDocuments: [],
    referenceResults: [],
    campaignScenes: [],
    currentScene: null,
    actors: [],
    initiativeOrder: [],
    currentRound: 0,
    currentTurnIndex: 0,
    actorTemplates: [],
    rulesetConfig: null,
    selectedActorId: null,
    selectedTemplateId: null,
    isSceneActive: false,
    isCampaignDirty: false,
    isSceneDirty: false,
    operationError: null,
  }),
}));
