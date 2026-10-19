import type { CommunityScore, Criterion, UserRating } from "@/lib/types";

export function scoreFor(
  pinId: string,
  criterionId: string,
  community: CommunityScore[],
  ratings: UserRating[],
) {
  const base = community.find(
    (score) => score.pinId === pinId && score.criterionId === criterionId,
  );
  const mine = ratings.find(
    (rating) => rating.pinId === pinId && rating.criterionId === criterionId,
  );
  let sum = base?.sum ?? 0;
  let count = base?.count ?? 0;
  if (mine) {
    sum += mine.value;
    count += 1;
  }
  return {
    average: count > 0 ? sum / count : null,
    count,
    mine: mine?.value ?? null,
  };
}

export function overallAverage(
  pinId: string,
  criteria: Criterion[],
  community: CommunityScore[],
  ratings: UserRating[],
) {
  const values = criteria
    .map((criterion) => scoreFor(pinId, criterion.id, community, ratings).average)
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function formatScore(value: number | null) {
  if (value == null) return "—";
  return value.toFixed(1);
}
