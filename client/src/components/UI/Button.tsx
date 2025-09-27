import { cn } from "../../utils/utils";
import { useRef } from "react";

type ButtonProps = {
  children: React.ReactNode;
  size: "lg" | "md" | "sm";
  variant: "primary" | "secondary" | "tertiary";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export const Button = ({
  children,
  size,
  variant,
  onClick,
  disabled,
  className,
}: ButtonProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = () => {
    // Play button click sound
    if (!audioRef.current) {
      audioRef.current = new Audio("/buttonClick.mp3");
      audioRef.current.volume = 0.7;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Ignore audio play errors (browser restrictions)
    });

    // Call the original onClick
    onClick();
  };

  return (
    <button
      className={cn(
        className,
        "rounded-xl font-ethnocentric min-w-full font-semibold relative overflow-hidden cursor-pointer group transition-all duration-300 ease-in-out",
        {
          "bg-primary text-white shadow-lg shadow-primary/10 hover:shadow-primary/30 border border-white/50":
            variant === "primary",
          "bg-secondary text-white border !border-white/15":
            variant === "secondary",
          "bg-tertiary text-white": variant === "tertiary",
          "bg-gray-200 text-gray-700": variant === "tertiary",
        },
        disabled && "opacity-50 cursor-not-allowed",
        size === "lg" && "py-3 px-6 text-lg",
        size === "md" && "py-2.5 px-5 text-base",
        size === "sm" && "py-1 px-2 text-sm"
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      <span
        className={`${
          variant === "secondary" ? "bg-primary" : "bg-white"
        } min-h-44 min-w-44 -scale-y-20 absolute -top-10 left-1/2 transform -translate-x-1/2 rounded-full blur-3xl opacity-80 group-hover:opacity-100 transition-all duration-300 ease-in-out`}
      />
      {children}
    </button>
  );
};
