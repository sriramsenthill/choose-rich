import { create } from "zustand";
import { BREAKPOINTS } from "../constants/constants";

type ViewPortStore = {
  width: number;
  height: number;
  isMobile: boolean;
  isSmallTab: boolean;
  isTab: boolean;
  updateViewport: () => void;
};

export const viewPortStore = create<ViewPortStore>()((set) => ({
  width: typeof window !== "undefined" ? window.innerWidth : 0,
  height: typeof window !== "undefined" ? window.innerHeight : 0,
  isMobile:
    typeof window !== "undefined"
      ? /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        window.innerWidth < BREAKPOINTS.sm
      : false,
  isSmallTab:
    typeof window !== "undefined"
      ? window.innerWidth >= BREAKPOINTS.sm &&
        window.innerWidth < BREAKPOINTS.md
      : false,
  isTab:
    typeof window !== "undefined" ? window.innerWidth >= BREAKPOINTS.md : false,
  updateViewport: () => {
    if (typeof window !== "undefined") {
      set({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile:
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
          window.innerWidth < BREAKPOINTS.sm,
        isSmallTab:
          window.innerWidth >= BREAKPOINTS.sm &&
          window.innerWidth < BREAKPOINTS.md,
        isTab: window.innerWidth >= BREAKPOINTS.md,
      });
    }
  },
}));
