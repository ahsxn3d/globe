"use client";

import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GlobeScene } from "@/components/globe-scene";
import { PinDialog } from "@/components/pin-dialog";
import { PinPanel } from "@/components/pin-panel";
import { PricingDialog } from "@/components/pricing-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobeProvider, useGlobe } from "@/lib/store";

export function GlobeApp() {
  return (
    <GlobeProvider>
      <Shell />
    </GlobeProvider>
  );
}

function Shell() {
  const globe = useGlobe();

  return (
    <div className="relative h-dvh overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <header className="site-header pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 bg-[var(--bg)] px-4 md:px-7">
        <a
          href="https://anorix.dev"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto flex min-w-0 items-baseline gap-2"
        >
          <span className="eyebrow shrink-0">Anorix</span>
          <span className="wordmark truncate text-[18px] font-light tracking-[-0.04em] text-[var(--fg-0)] md:text-[22px]">Globe</span>
        </a>
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Button
            type="button"
            size="sm"
            onClick={globe.locateMe}
            disabled={globe.locating}
            aria-label="Locate me"
          >
            <LocateFixed aria-hidden />
            <span className="hidden min-[420px]:inline">{globe.locating ? "Locating" : "Locate me"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={globe.toggleLive}
            aria-pressed={globe.live}
          >
            <span className={`size-1.5 rounded-full ${globe.live ? "bg-[var(--accent)]" : "bg-[var(--fg-4)]"}`} aria-hidden />
            Live
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={globe.openPricing}>
            Plans
          </Button>
          <label className="flex h-8 items-center gap-2 rounded-full px-1">
            <span className="text-[13px] font-medium text-[var(--pill-soft-ink)]">Pro</span>
            <Switch
              checked={globe.pro}
              onCheckedChange={globe.setPro}
              aria-label="Pro tier"
              size="sm"
            />
          </label>
        </div>
      </header>
      <div className="absolute inset-x-0 top-16 bottom-0">
        <GlobeScene />
      </div>
      <PinPanel />
      <PinDialog />
      <PricingDialog />
      {globe.toast ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-[calc(42dvh+1.25rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--bg)] px-4 py-2 text-[13px] text-[var(--fg-1)] md:bottom-6 md:left-[calc(50%-180px)]"
        >
          {globe.toast.text}
        </div>
      ) : null}
    </div>
  );
}
