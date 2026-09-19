"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Overlay } from "@/components/overlay";
import { Textarea } from "@/components/ui/textarea";
import {
  CANDIDATE_ORIGIN_LABELS,
  candidateToDraft,
  fragileHostMessage,
  type ExtractResponse,
  type ListingCandidate,
} from "@/lib/extract-listings";
import type { ListingDraft } from "@/lib/types";
import { formatInr } from "@/lib/format";

const SAMPLE_ONE = `2 BHK in SNN Raj Serenity, Harlur, ₹28,000, deposit 80k, parking, semi-furnished
Near Kudlu Gate. Owner 9876543210`;

const SAMPLE_TWO = `2 BHK in SNN Raj Serenity, Harlur, ₹28,000, parking
---
2 BHK Prestige Park View, HSR Layout, rent 26,000, deposit 1 lakh, no parking`;

function confidenceMeta(score: number) {
  if (score >= 70) {
    return { label: "High match", className: "bg-emerald-600/15 text-emerald-800" };
  }
  if (score >= 45) {
    return { label: "Medium match", className: "bg-amber-500/15 text-amber-800" };
  }
  return { label: "Low match", className: "bg-muted text-muted-foreground" };
}

function fieldBits(candidate: ListingCandidate) {
  const h = candidate.hints;
  return [
    h.bhk ? `${h.bhk} BHK` : null,
    h.area,
    h.rent != null ? formatInr(h.rent) : null,
    h.parking && h.parking !== "unknown"
      ? h.parking === "yes"
        ? "Parking"
        : "No parking"
      : null,
    h.furnished && h.furnished !== "unknown" ? h.furnished : null,
  ].filter(Boolean) as string[];
}

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
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fragile = useMemo(() => (url.trim() ? fragileHostMessage(url.trim()) : null), [url]);
  const selected = result?.candidates.find((c) => c.id === selectedId) ?? null;

  function close() {
    onOpenChange(false);
    setResult(null);
    setError(null);
    setSelectedId(null);
  }

  async function findListings() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedId(null);
    try {
      const res = await fetch("/api/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notes }),
      });
      const data = (await res.json()) as ExtractResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not read that listing.");
        return;
      }
      setResult(data);
      setSelectedId(data.candidates[0]?.id ?? null);
    } catch {
      setError("Network error while reading the page. Paste the listing text instead.");
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!selected) return;
    const draft = candidateToDraft(selected);
    if (url.trim() && !draft.url) draft.url = url.trim();
    if (notes.trim() && !draft.notes) draft.notes = notes.trim();
    onConfirm(draft);
    setResult(null);
    setUrl("");
    setNotes("");
    setSelectedId(null);
    onOpenChange(false);
  }

  return (
    <Overlay
      open={open}
      onClose={close}
      variant="modal"
      size="lg"
      title="Find listings"
      description="Paste a public URL and/or listing text. We list what we can read — you pick one, then confirm in the form before anything is saved."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={findListings}
            disabled={loading || (!url.trim() && !notes.trim())}
          >
            {loading ? "Reading…" : result ? "Search again" : "Find listings"}
          </Button>
          <Button type="button" onClick={confirm} disabled={!selected}>
            Review in form
          </Button>
        </>
      }
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void findListings();
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="paste-url">Listing URL</Label>
            <Input
              id="paste-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://housing.com/…  ·  Facebook links need notes"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="paste-notes">Listing text</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setNotes(SAMPLE_ONE)}
                >
                  Sample
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setNotes(SAMPLE_TWO)}
                >
                  Two listings
                </Button>
              </div>
            </div>
            <Textarea
              id="paste-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="2 BHK in Harlur, ₹28,000, parking, SNN Raj…&#10;---&#10;Separate multiple listings with a line of dashes"
              className="min-h-24"
            />
          </div>

          {fragile ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {fragile.message}
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? (
            <Results
              result={result}
              selectedId={selectedId}
              onSelect={setSelectedId}
              usedNotes={Boolean(notes.trim())}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Public pages only: JSON-LD, Open Graph, and visible text. Facebook and Instagram
              are blocked — paste rent, area, and society from the app. Nothing is saved until
              you review and hit Save.
            </p>
          )}
        </div>
      </form>
    </Overlay>
  );
}

function Results({
  result,
  selectedId,
  onSelect,
  usedNotes,
}: {
  result: ExtractResponse;
  selectedId: string | null;
  onSelect: (id: string) => void;
  usedNotes: boolean;
}) {
  const selected = result.candidates.find((c) => c.id === selectedId) ?? null;
  const fetchLine = result.fetch.skipped
    ? null
    : result.fetch.ok
      ? "Read the public HTML from that URL."
      : result.fetch.attempted
        ? null
        : usedNotes
          ? "Using the text you pasted."
          : null;

  return (
    <div className="space-y-3">
      {fetchLine ? <p className="text-xs text-muted-foreground">{fetchLine}</p> : null}
      {result.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {w}
        </p>
      ))}

      {result.candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No listing we could trust. Add rent, area, and a society name in the text box, then
          search again.
        </div>
      ) : (
        <div className="space-y-2" role="listbox" aria-label="Guessed listings">
          <p className="text-xs font-medium text-muted-foreground">
            {result.candidates.length} option{result.candidates.length === 1 ? "" : "s"} — pick
            one
          </p>
          {result.candidates.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              selected={candidate.id === selectedId}
              onSelect={() => onSelect(candidate.id)}
            />
          ))}
        </div>
      )}

      {selected ? <FieldPreview candidate={selected} /> : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: ListingCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = confidenceMeta(candidate.confidence);
  const bits = fieldBits(candidate);
  const photo = candidate.hints.photoUrls?.[0];

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
          {candidate.hints.bhk ? `${candidate.hints.bhk} BHK` : "Listing"}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium leading-snug">{candidate.label}</p>
          <Badge variant="secondary" className={tone.className}>
            {tone.label} · {candidate.confidence}%
          </Badge>
        </div>
        {bits.length ? (
          <p className="text-xs text-muted-foreground">{bits.join(" · ")}</p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{CANDIDATE_ORIGIN_LABELS[candidate.origin]}</Badge>
          {candidate.missing.length ? (
            <span className="text-[11px] text-muted-foreground">
              Missing {candidate.missing.join(", ")}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Core fields filled</span>
          )}
        </div>
      </div>
    </button>
  );
}

function FieldPreview({ candidate }: { candidate: ListingCandidate }) {
  const h = candidate.hints;
  const rows: [string, string][] = [
    ["Society", h.society || "—"],
    ["Area", h.area || "—"],
    ["Rent", formatInr(h.rent ?? null)],
    ["Deposit", formatInr(h.deposit ?? null)],
    ["BHK", h.bhk != null ? String(h.bhk) : "—"],
    ["Parking", h.parking ?? "—"],
    ["Address", h.address || "—"],
    ["Contact", h.contact || "—"],
  ];

  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Will open in the form — edit anything before Save
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
