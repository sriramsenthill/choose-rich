import { WagmiProvider } from "wagmi";
import { Navbar } from "./components/Navbar";
import { SidebarWrapper } from "./components/SidebarWrapper";
import { config } from "./api/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
}

const queryClient = new QueryClient();

export const Layout = ({ children }: LayoutProps) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Navbar />
        <SidebarWrapper>{children}</SidebarWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
