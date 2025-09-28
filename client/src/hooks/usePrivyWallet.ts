import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { walletService } from "../api";
import type { ConnectWalletResponse } from "../api/wallet/types";

const GAME_WALLET_STORAGE_KEY = "choose-rich:game-wallet";

export const usePrivyWallet = () => {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    sendTransaction,
    signMessage,
  } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [gameWalletAddress, setGameWalletAddress] = useState<string | null>(
    () => {
      if (typeof window === "undefined") {
        return null;
      }
      return window.localStorage.getItem(GAME_WALLET_STORAGE_KEY);
    }
  );

  // Get the embedded wallet (Privy's default wallet)
  const embeddedWallet = useMemo(
    () => wallets.find((item: any) => item.walletClientType === "privy"),
    [wallets]
  );

  const walletAddress = useMemo(() => {
    if (embeddedWallet?.address) return embeddedWallet.address;
    const connectedWallet = wallets.find((item: any) => item.address);
    return connectedWallet?.address ?? "";
  }, [embeddedWallet, wallets]);

  const registerGameWallet = useCallback(
    async (address: string = walletAddress) => {
      if (!address) {
        console.warn(
          "No wallet address available for game wallet registration"
        );
        return null;
      }

      try {
        const response = await walletService.connectWallet({
          wallet_address: address,
        });
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            GAME_WALLET_STORAGE_KEY,
            response.game_evm_address
          );
        }
        setGameWalletAddress(response.game_evm_address);
        return response;
      } catch (error) {
        console.error("Failed to register game wallet:", error);
        throw error;
      }
    },
    [walletAddress]
  );

  // Handle Privy login
  const handleLogin = useCallback(async () => {
    if (!ready) return;

    try {
      await login();
      await registerGameWallet();
    } catch (error) {
      console.error("Failed to login with Privy:", error);
    }
  }, [ready, login, registerGameWallet]);

  // Handle Privy logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(GAME_WALLET_STORAGE_KEY);
      }
      setGameWalletAddress(null);
    } catch (error) {
      console.error("Failed to logout from Privy:", error);
    }
  }, [logout]);

  useEffect(() => {
    if (!authenticated || !walletAddress || gameWalletAddress) {
      return;
    }

    registerGameWallet(walletAddress).catch((error) => {
      console.error("Failed to register game wallet on mount:", error);
    });
  }, [authenticated, walletAddress, gameWalletAddress, registerGameWallet]);

  const getWalletAddress = useCallback(() => walletAddress, [walletAddress]);

  // Check if user has a wallet
  const hasWallet = useCallback(() => {
    return embeddedWallet || wallets.some((wallet: any) => wallet.address);
  }, [embeddedWallet, wallets]);

  // Get wallet for signing transactions
  const getWalletForSigning = useCallback(() => {
    if (embeddedWallet) return embeddedWallet;
    // Return the first connected wallet for signing
    return wallets.find((wallet: any) => wallet.address);
  }, [embeddedWallet, wallets]);

  // Switch wallet to chain 84532 (Base Sepolia)
  const switchToChain84532 = useCallback(async () => {
    try {
      const walletForSwitching = wallet;
      if (walletForSwitching) {
        await walletForSwitching.switchChain(84532);
      }
    } catch (error) {
      console.error("Failed to switch to chain 84532:", error);
    }
  }, [wallet]);

  // Get wallet balance
  const getWalletBalance = useCallback(async () => {
    try {
      if (wallet) {
        const provider = await wallet.getEthereumProvider();
        const balance = provider.request({
          method: "eth_getBalance",
          params: [wallet.address, "latest"],
        });
        return balance;
      }
      return null;
    } catch (error) {
      console.error("Failed to get wallet balance:", error);
      return null;
    }
  }, [wallet]);

  // Get current chain ID
  const getCurrentChainId = useCallback(() => {
    return wallet?.chainId || null;
  }, [wallet]);

  return {
    // Privy state
    ready,
    authenticated,
    user,
    wallets,
    connectedWallet: wallet,
    embeddedWallet,

    // Wallet info
    walletAddress,
    isConnected: authenticated || !!embeddedWallet,
    hasWallet: hasWallet(),
    walletClient: getWalletForSigning(),
    currentChainId: getCurrentChainId(),
    gameWalletAddress,

    // Transaction methods
    sendTransaction,

    // Auth state
    isLoading: !ready,

    // Actions
    login: handleLogin,
    logout: handleLogout,
    switchToChain84532,
    registerGameWallet,

    // Utility functions
    getWalletAddress,
    getWalletForSigning,
    getWalletBalance,
    signMessage,
    getCurrentChainId,
  };
};
