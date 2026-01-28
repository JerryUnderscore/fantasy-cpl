export type PositionKey = "GK" | "DEF" | "MID" | "FWD";

export const POSITION_KEYS: PositionKey[] = ["FWD", "MID", "DEF", "GK"];

export const POSITION_LABELS: Record<PositionKey, string> = {
  GK: "Goalkeeper",
  DEF: "Defense",
  MID: "Midfield",
  FWD: "Attack",
};
