/** Curated Unsplash trucking / logistics photos for the marketing landing. */

export type LandingPhoto = {
  src: string;
  alt: string;
};

const unsplash = (id: string, params = "w=1920&q=80&auto=format&fit=crop") =>
  `https://images.unsplash.com/${id}?${params}`;

/** Oversize / heavy-haul equipment load — hero atmosphere */
export const LANDING_HERO_PHOTO: LandingPhoto = {
  src: unsplash("photo-1709735133497-bbead76953a9"),
  alt: "Heavy-haul truck transporting an oversize backhoe on a multi-axle flatbed trailer"
};

/** Warehouse dock / inventory — mid-page visual band */
export const LANDING_BAND_PHOTO: LandingPhoto = {
  src: unsplash("photo-1586528116311-ad8dd3c8310d"),
  alt: "Warehouse aisle lined with pallet racking and freight inventory"
};

/** Port containers / logistics yard — bottom CTA */
export const LANDING_CTA_PHOTO: LandingPhoto = {
  src: unsplash("photo-1494412574643-ff11b0a5c1c3"),
  alt: "Shipping containers stacked at a logistics port"
};
