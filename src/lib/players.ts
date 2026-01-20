export const formatPlayerName = (
  name: string,
  jerseyNumber?: number | null,
) => (jerseyNumber != null ? `${name} (${jerseyNumber})` : name);
