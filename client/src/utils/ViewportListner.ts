import { useEffect } from "react";
import { viewPortStore } from "../store/viewPortStore";

export const ViewPortListener = () => {
  const { updateViewport } = viewPortStore();

  useEffect(() => {
    updateViewport();

    const handleResize = () => updateViewport();
    window.addEventListener("resize", handleResize);

    // Cleanup listener
    return () => window.removeEventListener("resize", handleResize);
  }, [updateViewport]);

  return null;
};
