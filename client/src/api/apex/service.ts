import { AUTH_TOKEN } from "../../constants/constants";
import { apiClient } from "../client";
import type {
  StartGameRequest,
  StartGameResponse,
  ChooseRequest,
  ChooseResponse,
} from "./types";
//TODO: PUT /apex when updated
const APEX_BASE_URL = "/apex";
const headers = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

export const apexApi = {
  /**
   * Start a new Apex game
   */
  async startGame(request: StartGameRequest): Promise<StartGameResponse> {
    const response = await apiClient.post<StartGameResponse>(
      `${APEX_BASE_URL}/start`,
      request,
      headers
    );

    return response;
  },

  /**
   * Make a choice in a non-blinder game
   */
  async makeChoice(request: ChooseRequest): Promise<ChooseResponse> {
    const response = await apiClient.post<ChooseResponse>(
      `${APEX_BASE_URL}/choose`,
      request,
      headers
    );

    return response;
  },
};
