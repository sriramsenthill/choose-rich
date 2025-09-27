import { useNavigate } from "react-router-dom";
import { Games } from "../constants/constants";

interface SidebarWrapperProps {
  children: React.ReactNode;
}

export const SidebarWrapper = ({ children }: SidebarWrapperProps) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100vh-76px)] flex flex-col">
      {/* Mobile Top Bar */}
      <div className="lg:hidden p-4">
        <div
          className="bg-[#211745] rounded-2xl p-4"
          style={{
            border: "2px solid",
            borderImageSource:
              "linear-gradient(205.26deg, rgba(255, 255, 255, 0.5) -6.2%, rgba(255, 255, 255, 0.25) 100%)",
          }}
        >
          {/* Game Type Selection - Horizontal */}
          <nav className="flex gap-4 justify-center">
            {Object.values(Games).map((game) => (
              <div
                key={game.title}
                className="w-16 h-16 rounded-xl bg-red-500 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                onClick={() => navigate(game.link)}
              >
                <img src={game.image} alt={game.title} />
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid min-h-[calc(100vh-76px)] grid-cols-[96px_11fr] gap-4">
        {/* Desktop Sidebar */}
        <div className="p-4">
          <div
            className="bg-[#211745] h-full rounded-2xl w-[96px]"
            style={{
              border: "2px solid",
              borderImageSource:
                "linear-gradient(205.26deg, rgba(255, 255, 255, 0.5) -6.2%, rgba(255, 255, 255, 0.25) 100%)",
            }}
          >
            <div className="space-y-4">
              {/* Game Type Selection */}
              <nav className="flex gap-2 flex-col items-center py-4">
                {Object.values(Games).map((game) => (
                  <div
                    key={game.title}
                    className="w-16 h-16 rounded-xl bg-red-500 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => navigate(game.link)}
                  >
                    <img src={game.image} alt={game.title} />
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Desktop Main Content Area */}
        <div className="p-6 overflow-hidden w-full">{children}</div>
      </div>

      {/* Mobile Main Content Area */}
      <div className="lg:hidden flex-1 overflow-hidden w-full">{children}</div>
    </div>
  );
};
