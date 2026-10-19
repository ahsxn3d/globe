export const CATEGORIES = [
  "Landmark",
  "Food",
  "Nature",
  "City",
  "Heritage",
  "Work",
  "Coast",
  "Transit",
] as const;

export type PinCategory = (typeof CATEGORIES)[number];

export type PinVisibility = "public" | "private";

export type PinSource = "seed" | "user";

export type Pin = {
  id: string;
  title: string;
  note: string;
  place: string;
  category: PinCategory;
  lat: number;
  lng: number;
  visibility: PinVisibility;
  source: PinSource;
  createdAt: number;
};

export type Criterion = {
  id: string;
  name: string;
  max: number;
};

export type UserRating = {
  pinId: string;
  criterionId: string;
  value: number;
};

export type CommunityScore = {
  pinId: string;
  criterionId: string;
  sum: number;
  count: number;
};

export type LiveFix = {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
};

export type PinDraft =
  | { mode: "create"; lat: number; lng: number }
  | { mode: "edit"; pinId: string };

export type StoredState = {
  userPins: Pin[];
  deletedSeedIds: string[];
  criteria: Criterion[];
  removedCriterionIds: string[];
  ratings: UserRating[];
  pro: boolean;
};

export const DEVICE_PIN_ID = "device-location";

export const STORAGE_KEY = "anorix-globe.v1";
