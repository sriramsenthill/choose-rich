import { Routes, Route } from "react-router-dom";
import { Mines } from "./pages/Mines";
import { Apex } from "./pages/Apex";
import { Cards } from "./components/UI/Cards";
import { Games } from "./constants/constants";

const HomePage = () => {
  return (
    <div className="flex flex-col gap-8 w-full overflow-hidden">
      <div className="border flex flex-col gap-1.5 border-grad-primary items-start pl-[68px] pb-[68px] justify-end bg-gradient-background-primary rounded-3xl h-[240px]">
        <h2 className="font-ethnocentric text-5xl">Vaults</h2>
        <p className="font-audiowide text-sm max-w-[539px]">
          Strategise and raid rival farms to claim a share of their rewards.
          Raiding for this epoch ends in 03d_08h_04m_47s.
        </p>
      </div>

      {/* Games */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {Object.values(Games).map((game) => (
          <Cards
            key={game.title}
            title={game.title}
            description={game.description}
            image={game.image}
            imageAlt={game.title}
            linearGradient={game.linearGradient}
            borderGradient={game.borderGradient}
            link={game.link}
          />
        ))}
      </div>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/mines" element={<Mines />} />
      <Route path="/apex" element={<Apex />} />
    </Routes>
  );
}

export default App;
