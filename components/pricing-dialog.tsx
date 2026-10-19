"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGlobe } from "@/lib/store";

const FREE = [
  "Public pins on this device",
  "Share rounded to about 1 km",
  "Search and category filters",
  "Locate me with an exact local pin",
];

const PRO = [
  "Live precise location, updated every few seconds",
  "Private pins, hidden on Free",
  "Your own rating criteria and averages",
  "Rating filters in the pin list",
];

export function PricingDialog() {
  const { pricingOpen, pro, closePricing, setPro } = useGlobe();

  return (
    <Dialog open={pricingOpen} onOpenChange={(open) => { if (!open) closePricing(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Anorix Globe Pro</DialogTitle>
          <DialogDescription>
            Precise location, private pins, and a rating system you define. This prototype does not charge a card.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <section>
            <h3 className="eyebrow">Free</h3>
            <p className="mt-3 text-[28px] font-light tracking-[-0.04em] text-[var(--fg-0)]">$0</p>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--fg-3)]">
              {FREE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="sm:border-l sm:border-[var(--line)] sm:pl-8">
            <h3 className="eyebrow">Pro</h3>
            <p className="mt-3 text-[28px] font-light tracking-[-0.04em] text-[var(--fg-0)]">
              $12<span className="text-[14px] tracking-normal text-[var(--fg-3)]">/mo</span>
            </p>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--fg-3)]">
              {PRO.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--fg-3)]">
          Enabling Pro writes a flag in localStorage on this browser. Stripe is not connected.
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPro(false);
              closePricing();
            }}
          >
            Stay on Free
          </Button>
          <Button
            type="button"
            onClick={() => {
              setPro(true);
              closePricing();
            }}
          >
            {pro ? "Pro is on" : "Enable Pro"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
