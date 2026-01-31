export const getKitSrc = (slug?: string | null) => {
  if (!slug) return null;
  if (slug === "atletico-ottawa") return "/kits/atletico-ottawa.png";
  if (slug === "forge") return "/kits/forge.png";
  if (slug === "vancouver") return "/kits/vancouver.png";
  if (slug === "supra") return "/kits/supra.png";
  return `/kits/${slug}.svg`;
};
