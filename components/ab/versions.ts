// A/B design versions of the dashboard. "orig" is the current design, kept for comparison.
export type DesignId = "orig" | "paper" | "night" | "brutal" | "soft" | "swiss";

export const VERSIONS: { id: DesignId; key: string; label: string }[] = [
  { id: "orig", key: "0", label: "מקור" },
  { id: "paper", key: "A", label: "עיתון" },
  { id: "night", key: "B", label: "לילה" },
  { id: "brutal", key: "C", label: "ברוטלי" },
  { id: "soft", key: "D", label: "רך" },
  { id: "swiss", key: "E", label: "סוויסי" },
];

export const LS_VERSION = "missions-ab-version";
export const LS_VOTES = "missions-ab-votes";

export function isDesignId(v: unknown): v is DesignId {
  return VERSIONS.some((x) => x.id === v);
}
