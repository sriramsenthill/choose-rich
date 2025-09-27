import { useNavigate } from "react-router-dom";
import { useState } from "react";

type CardsProps = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  linearGradient: string;
  borderGradient: string;
  link: string;
};

export const Cards = ({
  title,
  description,
  image,
  imageAlt,
  linearGradient,
  borderGradient,
  link,
}: CardsProps) => {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleMouseEnter = () => {
    if (!isAnimating) {
      setIsAnimating(true);
      // Reset animation after it completes
      setTimeout(() => {
        setIsAnimating(false);
      }, 1000); // Match the animation duration
    }
  };

  return (
    <div
      style={{
        background: linearGradient,
        border: "2px solid",
        borderImageSource: borderGradient,
      }}
      onClick={() => navigate(link)}
      onMouseEnter={handleMouseEnter}
      className={`rounded-3xl p-3 pb-8 flex flex-col cursor-pointer relative ${
        isAnimating ? "shine-animating" : ""
      }`}
    >
      <img src={image} alt={imageAlt} className="object-cover w-full" />
      <div className="w-full items-center justify-center mt-4">
        <h4 className="text-2xl font-ethnocentric text-center">{title}</h4>
        <p className="text-sm font-audiowide text-center">{description}</p>
      </div>
    </div>
  );
};
