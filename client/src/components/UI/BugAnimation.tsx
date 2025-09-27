import Lottie from "react-lottie-player";
import Bugs from "../../constants/bug.json";
import { type FC } from "react";

type BugProps = {
  width?: number;
  height?: number;
  speed?: number;
};

export const Bug: FC<BugProps> = ({ width = 26, height = 26, speed = 2 }) => {
  return (
    <Lottie
      loop
      animationData={Bugs}
      play
      speed={speed}
      style={{ width: width, height: height }}
    />
  );
};
