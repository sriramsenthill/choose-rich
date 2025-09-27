import { http } from "wagmi";
import {
  mainnet,
  polygon,
  avalanche,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
} from "wagmi/chains";
import { createConfig } from "@privy-io/wagmi";

// Create Privy wagmi config
export const config = createConfig({
  chains: [mainnet, polygon, avalanche, sepolia, baseSepolia, arbitrumSepolia],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
  // Optional: configure default chain for new users
  // defaultChain: baseSepolia,
});
