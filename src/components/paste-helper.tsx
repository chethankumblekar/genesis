"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Overlay } from "@/components/overlay";
import { Textarea } from "@/components/ui/textarea";
import type { ExtractedHints } from "@/lib/heuristics";
import type { ListingDraft } from "@/lib/types";
import { formatInr } from "@/lib/format";

type PasteResult = {
  og: { title?: string; description?: string; image?: string };
  hints: ExtractedHints;
  warnings: string[];
};

export function PasteHelperDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (draft: ListingDraft) => void;
}) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PasteResult | null>(null);

  function close() {
    onOpenChange(false);
    setResult(null);
    setError(null);
  }

  async function extract() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notes }),
      });
      const data = (await res.json()) as PasteResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not extract metadata.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error while fetching public metadata.");
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!result) return;
    const h = result.hints;
    const draft: ListingDraft = {
      society: h.society || result.og.title || "",
      notes: [h.notes, result.og.description].filter(Boolean).join("\n\n"),
      rent: h.rent ?? null,
      deposit: h.deposit ?? null,
      bhk: h.bhk ?? 2,
      area: h.area,
      parking: h.parking,
      furnished: h.furnished,
      source: h.source,
      url: h.url || url,
      photoUrls: h.photoUrls,
      status: "new",
    };
    onConfirm(draft);
    setResult(null);
    setUrl("");
    setNotes("");
    onOpenChange(false);
  }

  return (
    <Overlay
      open={open}
      onClose={close}
      variant="modal"
      title="Paste a listing"
      description="We only read public Open Graph title, description, and image — no NoBroker or Facebook scrape. Confirm the guess before it is saved."
      footer={
        <>
          <Button type="button" variant="outline" onClick={extract} disabled={loading}>
            {loading ? "Reading…" : "Extract metadata"}
          </Button>
          <Button type="button" onClick={confirm} disabled={!result}>
            Review in form
          </Button>
        </>
      }
    >
      <div className="grid gap-3 p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="paste-url">URL</Label>
          <Input
            id="paste-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://housing.com/… or any public page"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paste-notes">Notes from the listing</Label>
          <Textarea
            id="paste-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="2 BHK in Harlur, ₹28,000, parking, SNN Raj…"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {result ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            {result.og.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.og.image}
                alt=""
                className="h-28 w-full rounded-md object-cover"
              />
            ) : null}
            <p className="font-medium">
              {result.og.title || result.hints.society || "No title found"}
            </p>
            {result.og.description ? (
              <p className="line-clamp-3 text-muted-foreground">
                {result.og.description}
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <li>Rent: {formatInr(result.hints.rent ?? null)}</li>
              <li>BHK: {result.hints.bhk ?? "—"}</li>
              <li>Area: {result.hints.area ?? "—"}</li>
              <li>Parking: {result.hints.parking ?? "—"}</li>
              <li>Source: {result.hints.source ?? "—"}</li>
              <li>Deposit: {formatInr(result.hints.deposit ?? null)}</li>
            </ul>
            {result.warnings.map((w) => (
              <p key={w} className="text-xs text-amber-700">
                {w}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
