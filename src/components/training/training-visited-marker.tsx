"use client";

import { useEffect } from "react";

export function TrainingVisitedMarker() {
  useEffect(() => {
    localStorage.setItem("cargopaf_training_visited", "true");
  }, []);
  return null;
}
