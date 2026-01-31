export const formatPlayerName = (
  name: string,
  jerseyNumber?: number | null,
) => (jerseyNumber != null ? `${name} (${jerseyNumber})` : name);

export const formatShortName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstInitial = parts[0].charAt(0);
  const lastName = parts[parts.length - 1];
  return `${firstInitial}. ${lastName}`;
};
