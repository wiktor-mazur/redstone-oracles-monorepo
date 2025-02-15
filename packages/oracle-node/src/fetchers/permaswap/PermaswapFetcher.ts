import axios from "axios";
import { getLastPriceOrFail } from "../../db/local-db";
import {
  MultiRequestFetcher,
  RequestIdToResponse,
} from "../MultiRequestFetcher";
import { pools } from "./permaswap-pools-config";

type PermaswapResponse = {
  currentPriceUp: string;
  currentPriceDown: string;
};

export type PermaswapPoolsConfig = {
  [symbol: string]:
    | {
        poolAddress: string;
        pairedToken: string;
        direction: "currentPriceDown" | "currentPriceUp";
      }
    | undefined;
};

const PERMASWAP_ROUTER_URL = "https://router.permaswap.network/pool";

export class PermaswapFetcher extends MultiRequestFetcher {
  protected override retryForInvalidResponse: boolean = true;

  constructor() {
    super("permaswap");
  }

  override async makeRequest(requestId: string): Promise<PermaswapResponse> {
    const { poolAddress } = this.getPool(requestId);
    const res = await axios.get<PermaswapResponse>(
      `${PERMASWAP_ROUTER_URL}/${poolAddress}`
    );
    return res.data;
  }

  override extractPrice(
    dataFeedId: string,
    responses: RequestIdToResponse<PermaswapResponse>
  ): number | undefined {
    const response = responses[dataFeedId];
    if (response) {
      const { direction } = this.getPool(dataFeedId);
      const ratio = parseFloat(response[direction]);
      const pairedTokenPrice = this.getPairedTokenPrice(dataFeedId);
      return ratio * pairedTokenPrice;
    }
    return undefined;
  }

  getPool(requestId: string) {
    const pool = pools[requestId];
    if (!pool) {
      throw new Error(`${requestId} not found in ${this.name} fetcher`);
    }
    return pool;
  }

  protected getPairedTokenPrice(assetId: string): number {
    const { pairedToken } = this.getPool(assetId);

    return getLastPriceOrFail(pairedToken).value;
  }
}
