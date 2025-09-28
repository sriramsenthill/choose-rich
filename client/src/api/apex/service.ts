import { apiClient } from "../client";
import { getGameAddress } from "../../utils/utils";
import type {
  StartGameRequest,
  StartGameResponse,
  ChooseRequest,
  ChooseResponse,
} from "./types";
//TODO: PUT /apex when updated
const APEX_BASE_URL = "/apex";

export const apexApi = {
  /**
   * Start a new Apex game
   */
  async startGame(request: Omit<StartGameRequest, 'game_address'>): Promise<StartGameResponse> {
    const gameAddress = getGameAddress();
    if (!gameAddress) {
      throw new Error("Game address not found in localStorage");
    }

    const fullRequest: StartGameRequest = {
      ...request,
      game_address: gameAddress,
    };

    const response = await apiClient.post<StartGameResponse>(
      `${APEX_BASE_URL}/start`,
      fullRequest
    );

    return response;
  },

  /**
   * Make a choice in a non-blinder game
   */
  async makeChoice(request: Omit<ChooseRequest, 'game_address'>): Promise<ChooseResponse> {
    const gameAddress = getGameAddress();
    if (!gameAddress) {
      throw new Error("Game address not found in localStorage");
    }

    const fullRequest: ChooseRequest = {
      ...request,
      game_address: gameAddress,
    };

    const response = await apiClient.post<ChooseResponse>(
      `${APEX_BASE_URL}/choose`,
      fullRequest
    );

    return response;
  },
};
