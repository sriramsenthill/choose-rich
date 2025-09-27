import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { Mines } from "./pages/Mines.tsx";
import { Layout } from "./Layout.tsx";
import { Apex } from "./pages/Apex.tsx";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "wagmi";
import { config } from "./api/wagmi";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PrivyProvider
        appId={import.meta.env.VITE_PRIVY_APP_ID || "cmfgyvxgn005pjv0b6dcae4ha"}
        config={{
          appearance: {
            accentColor: "#6A6FF5",
            theme: "#FFFFFF",
            showWalletLoginFirst: false,
            logo: "https://auth.privy.io/logos/privy-logo.png",
            walletChainType: "ethereum-and-solana",
            walletList: [
              "detected_wallets",
              "metamask",
              "phantom",
              "coinbase_wallet",
              "base_account",
              "rainbow",
              "solflare",
              "backpack",
              "okx_wallet",
              "wallet_connect",
            ],
          },
          loginMethods: ["email", "wallet"],
          fundingMethodConfig: {
            moonpay: {
              useSandbox: true,
            },
          },
          embeddedWallets: {
            requireUserPasswordOnCreate: false,
            showWalletUIs: true,
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
            solana: {
              createOnLogin: "off",
            },
          },
          mfa: {
            noPromptOnMfaRequired: false,
          },
        }}
      >
        <WagmiProvider config={config}>
          <Layout>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/mines" element={<Mines />} />
              <Route path="/apex" element={<Apex />} />
            </Routes>
          </Layout>
        </WagmiProvider>
      </PrivyProvider>
    </BrowserRouter>
  </StrictMode>
);
