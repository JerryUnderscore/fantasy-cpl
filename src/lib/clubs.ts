type ClubMeta = {
  badge: string;
  primaryColor: string;
  secondaryColor?: string;
};

const CLUB_META: Record<string, ClubMeta> = {
  "hfx-wanderers": {
    badge: "/clubs/wanderers.svg",
    primaryColor: "#00E2FE",
    secondaryColor: "#05204A",
  },
  supra: {
    badge: "/clubs/supra.png",
    primaryColor: "#E53431",
    secondaryColor: "#041747",
  },
  "atletico-ottawa": {
    badge: "/clubs/ottawa.svg",
    primaryColor: "#E41C2E",
    secondaryColor: "#FFFFFF",
  },
  forge: {
    badge: "/clubs/forge.svg",
    primaryColor: "#DC4505",
    secondaryColor: "#53565A",
  },
  cavalry: {
    badge: "/clubs/cavalry.svg",
    primaryColor: "#DA291C",
    secondaryColor: "#335526",
  },
  vancouver: {
    badge: "/clubs/vancouver.png",
    primaryColor: "#FA2B2B",
    secondaryColor: "#505256",
  },
  pacific: {
    badge: "/clubs/pacific.svg",
    primaryColor: "#582B83",
    secondaryColor: "#00B7BD",
  },
  "inter-toronto": {
    badge: "/clubs/toronto.png",
    primaryColor: "#c4b78d",
    secondaryColor: "#222222",
  },
};

const CLUB_DISPLAY_NAMES: Record<string, string> = {
  "atletico-ottawa": "Atlético Ottawa",
  cavalry: "Cavalry",
  forge: "Forge",
  "hfx-wanderers": "HFX Wanderers",
  pacific: "Pacific",
  vancouver: "Vancouver FC",
  "inter-toronto": "Inter Toronto",
  supra: "FC Supra du Québec",
};

const normalizeSlug = (value?: string | null) =>
  value ? value.toLowerCase() : "";

export const getClubMeta = (slug?: string | null) =>
  CLUB_META[normalizeSlug(slug)];

export const getClubAccentColor = (slug?: string | null) =>
  getClubMeta(slug)?.primaryColor ?? "var(--accent)";

export const getClubBadge = (slug?: string | null) =>
  getClubMeta(slug)?.badge ?? null;

export const getClubDisplayName = (
  slug?: string | null,
  fallback?: string | null,
) => {
  if (!slug) return fallback ?? "Unknown club";
  const normalized = normalizeSlug(slug);
  return CLUB_DISPLAY_NAMES[normalized] ?? fallback ?? "Unknown club";
};
