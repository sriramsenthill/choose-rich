import Lottie from "react-lottie-player";
import Flowers from "./../../constants/flowers.json";
import { type FC } from "react";

type Flowerprops = {
  width?: number;
  height?: number;
  speed?: number;
};

export const Flower: FC<Flowerprops> = ({
  width = 200,
  height = 200,
  speed = 2,
}) => {
  return (
    <Lottie
      loop={false}
      animationData={Flowers}
      play
      speed={speed}
      style={{ width: width, height: height }}
    />
  );
};
