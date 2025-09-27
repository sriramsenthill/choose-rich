import { useState, useEffect, useRef } from "react";
import SlotCounter, { type SlotCounterRef } from "react-slot-counter";
import { viewPortStore } from "../store/viewPortStore";

interface ReelProps {
  value: number | null;
  isRolling: boolean;
  label: string;
  isUser?: boolean;
}

export const Reel = ({
  value,
  isRolling,
  label,
  isUser = false,
}: ReelProps) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const counterRef = useRef<SlotCounterRef>(null);

  const { isMobile } = viewPortStore();

  useEffect(() => {
    // Only animate when we have a value to animate to
    if (value !== null) {
      setDisplayValue(value);
    }
  }, [value, label, isRolling]);

  return (
    <div className="flex flex-col items-center space-y-2 sm:space-y-4">
      <div className="text-xs sm:text-sm font-medium text-white/80">
        {label}
      </div>

      {/* Slot Machine with SlotCounter - Responsive Size */}
      <div className="relative w-24 h-48 sm:w-40 sm:h-96 bg-gradient-to-b from-gray-600 to-gray-700 rounded-xl sm:rounded-2xl border-2 sm:border-4 border-gray-500 shadow-xl sm:shadow-2xl">
        {/* Inner Frame */}
        <div className="absolute inset-2 sm:inset-3 bg-gradient-to-b from-gray-500 to-gray-600 rounded-lg sm:rounded-xl border sm:border-2 border-gray-400"></div>

        {/* SlotCounter Component with Peek Effect */}
        <div className="h-full flex items-center justify-center">
          <SlotCounter
            ref={counterRef}
            speed={10}
            startValue={0}
            startValueOnce
            autoAnimationStart={false}
            value={displayValue.toString()}
            duration={3}
            animateUnchanged={false}
            slotPeek={isMobile ? 64 : 126}
            useMonospaceWidth
            numberSlotClassName={`text-4xl sm:text-8xl text-center ${
              isUser ? "text-green-400" : "text-red-400"
            }`}
          />
        </div>

        {/* Selection Lines - Top and bottom of the visible slot */}
        <div className="absolute top-1/2 -translate-y-5 sm:-translate-y-12 left-0 right-0 h-0.5 sm:h-1 bg-yellow-400 z-10 rounded-full"></div>
        <div className="absolute bottom-1/2 translate-y-5 sm:translate-y-12 left-0 right-0 h-0.5 sm:h-1 bg-yellow-400 z-10 rounded-full"></div>
      </div>
    </div>
  );
};
