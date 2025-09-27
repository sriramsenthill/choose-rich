import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ENTROPY_CONTRACT_ADDRESS = "0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440";
const PROVIDER_ADDRESS = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";

const GenerateNumberModule = buildModule("GenerateNumberModule", (m) => {
  const entropyContract = m.getParameter("entropyContract", ENTROPY_CONTRACT_ADDRESS);
  const provider = m.getParameter("provider", PROVIDER_ADDRESS);

  const generateNumber = m.contract("GenerateNumber", [entropyContract, provider]);

  return { generateNumber };
});

export default GenerateNumberModule;
