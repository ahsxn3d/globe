import { DEFAULT_CRITERIA } from "@/lib/seed";
import { STORAGE_KEY, type Criterion, type Pin, type StoredState, type UserRating } from "@/lib/types";

const EMPTY: StoredState = {
  userPins: [],
  deletedSeedIds: [],
  criteria: DEFAULT_CRITERIA,
  removedCriterionIds: [],
  ratings: [],
  pro: false,
};

function isPin(value: unknown): value is Pin {
  if (!value || typeof value !== "object") return false;
  const pin = value as Pin;
  return (
    typeof pin.id === "string" &&
    typeof pin.title === "string" &&
    typeof pin.lat === "number" &&
    typeof pin.lng === "number"
  );
}

function isCriterion(value: unknown): value is Criterion {
  if (!value || typeof value !== "object") return false;
  const criterion = value as Criterion;
  return (
    typeof criterion.id === "string" &&
    typeof criterion.name === "string" &&
    typeof criterion.max === "number"
  );
}

function isRating(value: unknown): value is UserRating {
  if (!value || typeof value !== "object") return false;
  const rating = value as UserRating;
  return (
    typeof rating.pinId === "string" &&
    typeof rating.criterionId === "string" &&
    typeof rating.value === "number"
  );
}

export function loadState(): StoredState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      userPins: Array.isArray(parsed.userPins) ? parsed.userPins.filter(isPin) : [],
      deletedSeedIds: Array.isArray(parsed.deletedSeedIds)
        ? parsed.deletedSeedIds.filter((id): id is string => typeof id === "string")
        : [],
      criteria: Array.isArray(parsed.criteria) && parsed.criteria.length > 0
        ? parsed.criteria.filter(isCriterion)
        : DEFAULT_CRITERIA,
      removedCriterionIds: Array.isArray(parsed.removedCriterionIds)
        ? parsed.removedCriterionIds.filter((id): id is string => typeof id === "string")
        : [],
      ratings: Array.isArray(parsed.ratings) ? parsed.ratings.filter(isRating) : [],
      pro: Boolean(parsed.pro),
    };
  } catch {
    return EMPTY;
  }
}

export function saveState(state: StoredState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
