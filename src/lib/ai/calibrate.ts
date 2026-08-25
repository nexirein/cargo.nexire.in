import "server-only";

export interface CalibrationData {
  predictedConfidence: number;
  isCorrect: boolean;
}

export interface CalibrationResult {
  calibratedConfidence: number;
  calibrationFactor: number;
}

const DEFAULT_CALIBRATION_HISTORY: CalibrationData[] = [];

let calibrationHistory: CalibrationData[] = [...DEFAULT_CALIBRATION_HISTORY];
const MAX_HISTORY = 1000;

export function recordCalibration(data: CalibrationData): void {
  calibrationHistory.push(data);
  if (calibrationHistory.length > MAX_HISTORY) {
    calibrationHistory = calibrationHistory.slice(-MAX_HISTORY);
  }
}

export function calibrateConfidence(rawConfidence: number, source: "rule" | "ml" | "llm" | "ensemble"): CalibrationResult {
  const relevant = calibrationHistory.filter((c) => {
    const bin = Math.round(c.predictedConfidence * 10) / 10;
    const targetBin = Math.round(rawConfidence * 10) / 10;
    return bin === targetBin;
  });

  if (relevant.length < 10) {
    return { calibratedConfidence: rawConfidence, calibrationFactor: 1 };
  }

  const accuracy = relevant.filter((c) => c.isCorrect).length / relevant.length;
  const calibrationFactor = rawConfidence > 0 ? accuracy / rawConfidence : 1;
  const calibrated = rawConfidence * calibrationFactor;

  return {
    calibratedConfidence: Math.round(Math.min(Math.max(calibrated, 0), 1) * 10000) / 10000,
    calibrationFactor: Math.round(calibrationFactor * 10000) / 10000,
  };
}

export function temperatureScale(logits: number[], temperature: number): number[] {
  const scaled = logits.map((l) => l / temperature);
  const maxLogit = Math.max(...scaled);
  const expSum = scaled.reduce((sum, l) => sum + Math.exp(l - maxLogit), 0);
  return scaled.map((l) => Math.exp(l - maxLogit) / expSum);
}

export function resetCalibration(): void {
  calibrationHistory = [];
}
