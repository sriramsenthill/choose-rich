import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "./UI/Button";
import { FaCopy } from "react-icons/fa";
import { useBalanceStore } from "../store/balanceStore";
import { useBalances } from "../hooks/useBalances";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { usePrivyWallet } from "../hooks/usePrivyWallet";

export const Navbar = () => {
  const navigate = useNavigate();
  const { walletAddress, isConnected, logout } = usePrivyWallet();
  const [copied, setCopied] = useState(false);
  const [ethCopy, setEthCopy] = useState(false);

  // Privy hooks
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();

  // Debug logging
  useEffect(() => {
    console.log("Wallet State:", {
      ready,
      authenticated,
      address: walletAddress,
      isConnected: isConnected,
    });
  }, [ready, authenticated, walletAddress, isConnected]);

  // Get balances from store
  const { getBalance } = useBalanceStore();
  // Start polling for balances
  useBalances(5000); // Poll every 5 seconds

  // Send transaction hook

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDepositeModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleConnectWallet = () => {
    if (ready && !authenticated) {
      login({
        loginMethods: ["wallet", "email"],
        walletChainType: "ethereum-only",
        disableSignup: false,
      });
    }
  };

  useEffect(() => {
    if (copied) {
      setTimeout(() => setCopied(false), 1000);
    }
    if (ethCopy) {
      setTimeout(() => setEthCopy(false), 1000);
    }
  }, [copied, setCopied, ethCopy, setEthCopy]);

  return (
    <div className="grid grid-cols-[1fr_6fr] bg-background">
      <span
        onClick={() => navigate("/")}
        className="text-xl font-bold p-4 flex items-center justify-start"
      >
        <img src="/LogoMark.svg" alt="" className="scale-140 pl-8" />
      </span>
      <div className="flex items-center gap-4 p-4 w-full justify-between">
        <div className="flex items-center justify-end gap-8 w-full">
          {/* { Deposit Modal } */}
          <div className="relative">
            <Button size="md" variant="secondary" onClick={handleDepositeModal}>
              Deposit
            </Button>
            {isModalOpen && (
              <div className="absolute bg-black/40 w-96 backdrop-blur-2xl rounded-lg p-4">
                <div className="flex flex-col gap-2">
                  <h2>Deposit ETH</h2>
                  <p>Deposit your funds to the platform</p>
                  <span
                    onClick={() => {
                      if (walletAddress) {
                        setEthCopy(true);
                        navigator.clipboard.writeText(walletAddress);
                      }
                    }}
                    className="bg-primary/50 p-4 flex gap-2 items-center justify-between rounded-lg"
                  >
                    {ethCopy
                      ? "Copied"
                      : walletAddress
                      ? walletAddress.slice(0, 6) +
                        "..." +
                        walletAddress.slice(-6)
                      : "Loading..."}
                    <FaCopy />
                  </span>
                </div>
              </div>
            )}
          </div>
          {/* Balance Display */}
          <div className="flex items-center gap-4">

            {/* ETH Balance */}
            <div className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg">
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">Ξ</span>
              </div>
              <span className="text-sm font-semibold text-white">
                ${Number(getBalance("ETH") / 10 ** 18).toFixed(8)}
              </span>
            </div>
          </div>
          {authenticated && isConnected && walletAddress ? (
            <div className="flex items-center gap-2 w-fit">
              <span
                className="w-32"
                onClick={() => {
                  if (walletAddress) {
                    setCopied(true);
                    navigator.clipboard.writeText(walletAddress);
                  }
                }}
                style={{ cursor: "pointer" }}
                title="Copy address to clipboard"
              >
                {copied
                  ? "Copied"
                  : walletAddress.slice(0, 6) + "..." + walletAddress.slice(-6)}
              </span>
              <button
                className="w-fit bg-primary/20 px-10 py-2 rounded-xl hover:bg-primary/60 transition-all duration-300 ease-in-out"
                onClick={() => logout()}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className={authenticated ? "w-96" : `max-w-56 w-56`}>
              <Button
                size="md"
                variant="primary"
                className="!max-w-32"
                onClick={handleConnectWallet}
                disabled={!ready || authenticated}
              >
                {!ready
                  ? "Loading..."
                  : authenticated
                  ? "Connected"
                  : "Connect"}
              </Button>
            </div>
          )}
          {/* <button className="border px-4 py-1.5 rounded-lg">Signup</button>
          <button className="border px-4 py-1.5 rounded-lg">Login</button> */}
        </div>
      </div>
    </div>
  );
};
