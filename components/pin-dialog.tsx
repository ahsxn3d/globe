"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCoord } from "@/lib/geo";
import { useGlobe } from "@/lib/store";
import { CATEGORIES, type Pin, type PinCategory, type PinVisibility } from "@/lib/types";

export function PinDialog() {
  const { draft, pins, closeDraft } = useGlobe();
  const editing = draft?.mode === "edit" ? pins.find((pin) => pin.id === draft.pinId) : undefined;
  const open = draft != null && (draft.mode === "create" || editing != null);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeDraft(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[440px]">
        {draft?.mode === "create" ? (
          <PinForm
            key={`${draft.lat.toFixed(4)}-${draft.lng.toFixed(4)}`}
            lat={draft.lat}
            lng={draft.lng}
          />
        ) : null}
        {editing ? <PinForm key={editing.id} pin={editing} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PinForm({ pin, lat, lng }: { pin?: Pin; lat?: number; lng?: number }) {
  const { pro, savePin, openPricing, closeDraft } = useGlobe();
  const point = pin ?? { lat: lat ?? 0, lng: lng ?? 0 };
  const [title, setTitle] = useState(pin?.title ?? "");
  const [note, setNote] = useState(pin?.note ?? "");
  const [category, setCategory] = useState<PinCategory>(pin?.category ?? "Landmark");
  const [visibility, setVisibility] = useState<PinVisibility>(pin?.visibility ?? "public");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const nextTitle = title.trim();
        if (!nextTitle) {
          setError("Title is required.");
          return;
        }
        if (visibility === "private" && !pro) {
          openPricing();
          return;
        }
        savePin({
          id: pin?.id ?? crypto.randomUUID(),
          title: nextTitle.slice(0, 80),
          note: note.trim().slice(0, 400),
          place: pin?.place ?? "Dropped pin",
          category,
          lat: point.lat,
          lng: point.lng,
          visibility,
          source: "user",
          createdAt: pin?.createdAt ?? Date.now(),
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{pin ? "Edit pin" : "New pin"}</DialogTitle>
        <DialogDescription className="coord">
          {formatCoord(point.lat, point.lng, 4)}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pin-title">Title</Label>
          <Input
            id="pin-title"
            value={title}
            maxLength={80}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
            placeholder="Badshahi Mosque"
          />
          {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin-note">Note</Label>
          <Textarea
            id="pin-note"
            value={note}
            maxLength={400}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What you want to remember here"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 ${
                  category === item
                    ? "bg-[var(--pill)] text-[var(--pill-ink)]"
                    : "text-[var(--fg-3)] hover:text-[var(--fg-1)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Visibility</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={visibility === "public"}
              onClick={() => setVisibility("public")}
              className={`rounded-2xl px-3 py-3 text-left text-[13px] ${
                visibility === "public"
                  ? "bg-[var(--row)] text-[var(--fg-0)]"
                  : "text-[var(--fg-3)]"
              }`}
            >
              Public
              <span className="mt-1 block text-[12px] leading-relaxed text-[var(--fg-3)]">Listed for you. Share rounds to ~1 km on Free.</span>
            </button>
            <button
              type="button"
              aria-pressed={visibility === "private"}
              onClick={() => {
                if (!pro) {
                  openPricing();
                  return;
                }
                setVisibility("private");
              }}
              className={`rounded-2xl px-3 py-3 text-left text-[13px] ${
                visibility === "private"
                  ? "bg-[var(--row)] text-[var(--fg-0)]"
                  : "text-[var(--fg-3)]"
              }`}
            >
              Private
              <span className="mt-1 block text-[12px] leading-relaxed text-[var(--fg-3)]">Lock icon. Visible only while Pro is on.</span>
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={closeDraft}>
          Cancel
        </Button>
        <Button type="submit">Save pin</Button>
      </div>
    </form>
  );
}
