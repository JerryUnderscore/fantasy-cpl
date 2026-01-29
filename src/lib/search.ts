export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getNameSearchRank = (name: string, query: string) => {
  if (!query) return 0;
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 3;
  const wordBoundary = new RegExp(`\\b${escapeRegExp(normalizedQuery)}`);
  if (wordBoundary.test(normalizedName)) return 2;
  if (normalizedName.includes(normalizedQuery)) return 1;
  return 0;
};

export const getLastNameKey = (name: string) => {
  const normalized = normalizeSearchText(name);
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
};
