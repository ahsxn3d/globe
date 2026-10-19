"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatScore } from "@/lib/ratings";
import { useGlobe } from "@/lib/store";

export function RatingEditor({ pinId }: { pinId: string }) {
  const { pro, criteria, openPricing, pinScore, ratePin, addCriterion, removeCriterion } = useGlobe();
  const [name, setName] = useState("");
  const [max, setMax] = useState(5);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (!pro) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-2 text-[14px] text-[var(--fg-1)]">
          <Lock className="size-3.5 text-[var(--fg-3)]" aria-hidden />
          Ratings
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--fg-3)]">
          Custom criteria and averages are part of Pro. Food, safety, signal, or your own scale.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openPricing}>
          View Pro
        </Button>
      </div>
    );
  }

  return (
    <section id="ratings" className="mt-8">
      <div className="pb-2">
        <h3 className="eyebrow">Ratings</h3>
        <p className="mt-2 text-[13px] text-[var(--fg-3)]">Your score is included in the average.</p>
      </div>
      <ul>
        {criteria.map((criterion) => {
          const score = pinScore(pinId, criterion.id);
          const steps = Array.from({ length: criterion.max }, (_, index) => index + 1);
          return (
            <li key={criterion.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px]">{criterion.name}</span>
                <span className="font-mono text-[11px] tracking-[0.06em] text-[var(--fg-3)] uppercase">
                  avg {formatScore(score.average)} · {score.count}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {steps.map((step) => {
                  const active = score.mine != null && step <= score.mine;
                  return (
                    <button
                      key={step}
                      type="button"
                      aria-label={`Rate ${criterion.name} ${step} of ${criterion.max}`}
                      aria-pressed={score.mine === step}
                      onClick={() => ratePin(pinId, criterion.id, step)}
                      className={`grid h-8 min-w-8 place-items-center rounded-full px-1.5 font-mono text-[11px] transition-colors duration-150 ${
                        active
                          ? "bg-[var(--pill)] text-[var(--pill-ink)]"
                          : "text-[var(--fg-3)] hover:text-[var(--fg-1)]"
                      }`}
                    >
                      {step}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="ml-auto text-[12px] text-[var(--fg-3)] hover:text-[var(--fg-1)]"
                  onClick={() =>
                    setPendingDelete((current) => (current === criterion.id ? null : criterion.id))
                  }
                >
                  {pendingDelete === criterion.id ? "Confirm remove" : "Remove"}
                </button>
                {pendingDelete === criterion.id ? (
                  <button
                    type="button"
                    className="text-[12px] text-[var(--fg-0)]"
                    onClick={() => {
                      removeCriterion(criterion.id);
                      setPendingDelete(null);
                    }}
                  >
                    Yes
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <form
        className="flex flex-col gap-2 p-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          addCriterion(name, max);
          setName("");
          setMax(5);
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Food"
          aria-label="Criterion name"
          maxLength={32}
          className="sm:flex-1"
        />
        <label className="flex items-center gap-2 text-[13px] text-[var(--fg-3)]">
          1–
          <select
            aria-label="Score maximum"
            value={max}
            onChange={(event) => setMax(Number(event.target.value))}
            className="h-8 bg-transparent px-1 font-mono text-[12px] text-[var(--fg-1)]"
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </label>
        <Button type="submit" size="sm" variant="outline">
          Add criterion
        </Button>
      </form>
    </section>
  );
}
