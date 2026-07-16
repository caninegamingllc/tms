/** Local fleet photos for the marketing landing (faded backgrounds only). */

export type LandingPhoto = {
  src: string;
  alt: string;
};

/** Blue Peterbilt with covered flatbed — hero */
export const LANDING_HERO_PHOTO: LandingPhoto = {
  src: "/landing/hero-peterbilt-flatbed.png",
  alt: "Dark blue Peterbilt semi-truck with a covered flatbed trailer in a parking lot"
};

/** Yellow Kenworth tractor — faded mid-section behind Premium */
export const LANDING_MID_PHOTO: LandingPhoto = {
  src: "/landing/band-kenworth-yellow.png",
  alt: "Bright yellow Kenworth semi-truck tractor parked outdoors"
};

/** Red Kenworth with heavy-haul lowboy — bottom CTA */
export const LANDING_CTA_PHOTO: LandingPhoto = {
  src: "/landing/band-kenworth-heavy-haul.png",
  alt: "Red Kenworth semi-truck pulling a multi-axle heavy-haul lowboy with a tarped oversize load"
};
