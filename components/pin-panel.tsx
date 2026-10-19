"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceSearch } from "@/components/place-search";
import { RatingEditor } from "@/components/rating-editor";
import { approximateKm, distanceKm, formatCoord } from "@/lib/geo";
import { formatScore } from "@/lib/ratings";
import { useGlobe } from "@/lib/store";
import { CATEGORIES, type PinCategory } from "@/lib/types";

export function PinPanel() {
  const globe = useGlobe();
  const listRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const activeCriterion = globe.criteria.find((criterion) => criterion.id === globe.ratingCriterionId);

  useEffect(() => {
    if (!globe.selectedId || !listRef.current) return;
    listRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [globe.selectedId]);

  const selected = globe.selected;
  const shareCoords = selected
    ? globe.pro
      ? { lat: selected.lat, lng: selected.lng }
      : approximateKm(selected.lat, selected.lng)
    : null;
  const drift =
    selected && shareCoords
      ? distanceKm(selected.lat, selected.lng, shareCoords.lat, shareCoords.lng)
      : 0;

  return (
    <aside data-sidebar className="absolute inset-x-0 bottom-0 z-20 flex h-[42dvh] min-h-0 flex-col overflow-hidden bg-[var(--bg)] px-5 pt-6 md:top-20 md:right-5 md:bottom-auto md:left-auto md:h-[calc(100%-6.25rem)] md:w-[340px] md:rounded-[28px] md:px-6 md:pt-7">
      <div className="shrink-0 space-y-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Places</p>
            <h2 className="mt-2 text-[32px] font-light tracking-[-0.045em] text-[var(--fg-0)]">Pins</h2>
          </div>
          <p className="mb-1 font-mono text-[11px] tracking-[0.08em] text-[var(--fg-3)] uppercase">
            {globe.filteredPins.length} shown
          </p>
        </div>
        <PlaceSearch />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
          <FilterChip
            active={globe.category === "All"}
            onClick={() => globe.setCategory("All")}
            label="All"
          />
          {CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              active={globe.category === category}
              onClick={() => globe.setCategory(category as PinCategory)}
              label={category}
            />
          ))}
        </div>
        {globe.pro ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="eyebrow" htmlFor="rating-criterion">
              Rating
            </label>
            <select
              id="rating-criterion"
              value={globe.ratingCriterionId}
              onChange={(event) => globe.setRatingFilter(event.target.value, globe.ratingMin)}
              className="h-8 rounded-full bg-transparent px-1 text-[13px] text-[var(--fg-1)]"
            >
              <option value="">Any criterion</option>
              {globe.criteria.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Minimum rating"
              value={globe.ratingMin}
              disabled={!globe.ratingCriterionId}
              onChange={(event) =>
                globe.setRatingFilter(globe.ratingCriterionId, Number(event.target.value))
              }
              className="h-8 rounded-full bg-transparent px-1 font-mono text-[12px] text-[var(--fg-1)] disabled:opacity-40"
            >
              <option value={0}>Any score</option>
              {Array.from({ length: activeCriterion?.max ?? 5 }, (_, index) => index + 1).map(
                (step) => (
                  <option key={step} value={step}>
                    {step}+
                  </option>
                ),
              )}
            </select>
          </div>
        ) : (
          <button
            type="button"
            onClick={globe.openPricing}
            className="flex w-full items-center gap-2 py-1 text-left text-[13px] text-[var(--fg-3)] hover:text-[var(--fg-1)]"
          >
            <Lock className="size-3.5" aria-hidden />
            Rating filters are part of Pro
          </button>
        )}
        {globe.live && globe.livePos ? (
          <div className="pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[13px] text-[var(--fg-1)]">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
                Live location
              </p>
              <button
                type="button"
                className="text-[12px] font-medium text-[var(--accent)]"
                onClick={() => void globe.shareLive()}
              >
                Share precise
              </button>
            </div>
            <p className="coord mt-1.5">
              {formatCoord(globe.livePos.lat, globe.livePos.lng, 5)} · ±
              {Math.round(globe.livePos.accuracy)} m
            </p>
          </div>
        ) : null}
        {globe.geoError ? (
          <p role="alert" className="text-[13px] text-[var(--fg-3)]">
            {globe.geoError}
          </p>
        ) : null}
        {!globe.pro && globe.hiddenPrivateCount > 0 ? (
          <button
            type="button"
            onClick={globe.openPricing}
            className="flex w-full items-center gap-2 text-left text-[13px] text-[var(--fg-3)] hover:text-[var(--fg-1)]"
          >
            <Lock className="size-3.5" aria-hidden />
            {globe.hiddenPrivateCount} private pins hidden
          </button>
        ) : null}
      </div>

      <div ref={listRef} className="pin-scroll min-h-0 flex-1">
        {selected ? (
          <article className="pb-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[28px] font-light tracking-[-0.045em] text-[var(--fg-0)]">{selected.title}</h3>
                <p className="mt-1 text-[13px] text-[var(--fg-3)]">
                  {selected.category} · {selected.place}
                </p>
              </div>
              {selected.visibility === "private" ? (
                <Lock className="mt-1 size-3.5 text-[var(--fg-3)]" aria-label="Private pin" />
              ) : null}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--fg-1)]">{selected.note}</p>
            <p className="coord mt-3">
              Exact {formatCoord(selected.lat, selected.lng, 5)}
            </p>
            {shareCoords ? (
              <p className="coord mt-1.5">
                {globe.pro
                  ? `Share ${formatCoord(shareCoords.lat, shareCoords.lng, 5)} · precise`
                  : `Share ${formatCoord(shareCoords.lat, shareCoords.lng, 4)} · ${drift < 0.05 ? "under 0.1" : drift.toFixed(1)} km off`}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void globe.sharePin(selected)}>
                {globe.pro ? "Share precise" : "Share ~1 km"}
              </Button>
              {selected.source === "user" ? (
                <Button type="button" size="sm" variant="outline" onClick={() => globe.openEdit(selected.id)}>
                  Edit
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(selected.id)}
              >
                {confirmDelete === selected.id ? "Confirm delete" : "Delete"}
              </Button>
              {confirmDelete === selected.id ? (
                <Button type="button" size="sm" variant="outline" onClick={() => globe.deletePin(selected.id)}>
                  Remove pin
                </Button>
              ) : null}
            </div>
            <RatingEditor pinId={selected.id} />
          </article>
        ) : (
          <p className="pb-6 text-[14px] leading-relaxed text-[var(--fg-3)]">
            Select a pin, or click the globe to drop one. Free shares round public pins to about 1 km.
          </p>
        )}

        {globe.filteredPins.length === 0 ? (
          <p className="py-8 text-[14px] text-[var(--fg-3)]">No saved pins match. Pick a place above to fly there.</p>
        ) : (
          <ul>
            {globe.filteredPins.map((pin) => {
              const average = globe.pro
                ? globe.ratingCriterionId
                  ? globe.pinScore(pin.id, globe.ratingCriterionId).average
                  : globe.pinAverage(pin.id)
                : null;
              const active = pin.id === globe.selectedId;
              return (
                <li key={pin.id} data-pin={pin.id}>
                  <button
                    type="button"
                    onClick={() => globe.selectPin(pin.id, true)}
                    className={`row-hover flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left ${
                      active ? "bg-[var(--row)]" : ""
                    }`}
                  >
                    <span>
                      <span className="flex items-center gap-1.5 text-[14px] text-[var(--fg-1)]">
                        {pin.visibility === "private" ? (
                          <Lock className="size-3 text-[var(--fg-3)]" aria-hidden />
                        ) : null}
                        {pin.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-[var(--fg-3)]">
                        {pin.category} · {pin.place}
                      </span>
                    </span>
                    {globe.pro ? (
                      <span className="font-mono text-[12px] text-[var(--fg-1)]">{formatScore(average)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="shrink-0 py-4 text-[12px] text-[var(--fg-3)]">
        <a href="https://anorix.dev" target="_blank" rel="noreferrer" className="text-[var(--fg-1)]">
          anorix.dev
        </a>
        <span> · stored on this device</span>
      </footer>
    </aside>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-7 rounded-full px-3 text-[12px] font-medium transition-colors duration-150 ${
        active
          ? "bg-[var(--pill)] text-[var(--pill-ink)]"
          : "text-[var(--fg-3)] hover:text-[var(--fg-1)]"
      }`}
    >
      {label}
    </button>
  );
}
