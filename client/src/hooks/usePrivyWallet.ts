import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback } from "react";

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

  // Get the embedded wallet (Privy's default wallet)
  const embeddedWallet = wallets.find(
    (wallet: any) => wallet.walletClientType === "privy"
  );

  // Handle Privy login
  const handleLogin = useCallback(async () => {
    if (!ready) return;

    try {
      await login();
    } catch (error) {
      console.error("Failed to login with Privy:", error);
    }
  }, [ready, login]);

  // Handle Privy logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to logout from Privy:", error);
    }
  }, [logout]);

  // Get wallet address - prioritize embedded wallet, fallback to connected wallet
  const getWalletAddress = useCallback(() => {
    if (embeddedWallet?.address) return embeddedWallet.address;
    // Check for any connected wallet address
    const connectedWallet = wallets.find((wallet: any) => wallet.address);
    if (connectedWallet?.address) return connectedWallet.address;
    return "";
  }, [embeddedWallet, wallets]);

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
    walletAddress: getWalletAddress(),
    isConnected: authenticated || !!embeddedWallet,
    hasWallet: hasWallet(),
    walletClient: getWalletForSigning(),
    currentChainId: getCurrentChainId(),

    // Transaction methods
    sendTransaction,

    // Auth state
    isLoading: !ready,

    // Actions
    login: handleLogin,
    logout: handleLogout,
    switchToChain84532,

    // Utility functions
    getWalletAddress,
    getWalletForSigning,
    getWalletBalance,
    signMessage,
    getCurrentChainId,
  };
};
