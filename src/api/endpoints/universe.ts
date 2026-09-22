import { apiClient, RequestOptions } from "../client";
import { UniverseCharacterProfile } from "../../types";

export const universeApi = {
  /**
   * Fetch all characters from the global universe roster.
   */
  getCharacters(options?: RequestOptions) {
    return apiClient.get<{ characters: Record<string, UniverseCharacterProfile> }>("/api/universe/characters", options);
  },

  /**
   * Save or update a character in the global universe roster.
   */
  saveCharacter(profile: Partial<UniverseCharacterProfile> & { name: string }, options?: RequestOptions) {
    return apiClient.post<{ character: UniverseCharacterProfile }>("/api/universe/characters", profile, options);
  },

  /**
   * Delete a character from the global universe roster.
   */
  deleteCharacter(name: string, options?: RequestOptions) {
    return apiClient.delete<{ deleted: boolean }>(`/api/universe/characters/${encodeURIComponent(name)}`, options);
  },

  /**
   * Fetch all media reference assets belonging to the Universe media pool.
   */
  getAssets(options?: RequestOptions) {
    return apiClient.get<{ assets: any[] }>("/api/universe/assets", options);
  },

  /**
   * Promote an asset to the global universe media pool.
   */
  promoteAsset(filename: string, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; filename: string; error?: string }>(
      "/api/universe/characters/promote-asset",
      { filename },
      options
    );
  },
};
