export const getKitSrc = (slug?: string | null) => {
  if (!slug) return null;
  if (slug === "supra") return "/kits/supra.png";
  return `/kits/${slug}.svg`;
};
