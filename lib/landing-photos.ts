/** Local fleet photos for the marketing landing. */

export type LandingPhoto = {
  src: string;
  alt: string;
};

/** Blue Peterbilt with covered flatbed — hero */
export const LANDING_HERO_PHOTO: LandingPhoto = {
  src: "/landing/hero-peterbilt-flatbed.png",
  alt: "Dark blue Peterbilt semi-truck with a covered flatbed trailer in a parking lot"
};

/** Green Peterbilt with oversize flatbed load — mid-page band after plans */
export const LANDING_BAND_PHOTO: LandingPhoto = {
  src: "/landing/band-peterbilt-oversize.png",
  alt: "Green Peterbilt hauling an oversize industrial load on a drop-deck flatbed trailer"
};

/** Yellow Kenworth tractor — band after Premium */
export const LANDING_BAND_KENWORTH_PHOTO: LandingPhoto = {
  src: "/landing/band-kenworth-yellow.png",
  alt: "Bright yellow Kenworth semi-truck tractor parked outdoors"
};

/** Red Kenworth with heavy-haul lowboy — band after Premium + Trucking */
export const LANDING_BAND_KENWORTH_HEAVY_HAUL_PHOTO: LandingPhoto = {
  src: "/landing/band-kenworth-heavy-haul.png",
  alt: "Red Kenworth semi-truck pulling a multi-axle heavy-haul lowboy with a tarped oversize load"
};

/** Warehouse heavy-haul loading — bottom CTA */
export const LANDING_CTA_PHOTO: LandingPhoto = {
  src: "/landing/cta-heavy-haul-loading.png",
  alt: "Industrial crane lowering a large wrapped component onto a red heavy-haul trailer"
};
