"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/overlay";
import { formatInr } from "@/lib/format";
import { SCRAPE_SOURCE_LABELS, type ScrapedListing } from "@/lib/scrape/types";
import type { ListingDraft } from "@/lib/types";

const CONFIDENCE_META = {
  high: { label: "High", className: "bg-emerald-600/15 text-emerald-800" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-800" },
  low: { label: "Filtered", className: "bg-muted text-muted-foreground" },
} as const;

function summary(draft: ListingDraft): string[] {
  return [
    draft.bhk ? `${draft.bhk} BHK` : null,
    draft.rent != null ? formatInr(draft.rent) : null,
    draft.deposit != null ? `${formatInr(draft.deposit)} dep` : null,
    draft.area,
    draft.furnished && draft.furnished !== "unknown" ? draft.furnished : null,
  ].filter(Boolean) as string[];
}

function CaptureRow({
  row,
  busy,
  onImport,
  onReject,
  onEdit,
}: {
  row: ScrapedListing;
  busy: boolean;
  onImport: () => void;
  onReject: () => void;
  onEdit: () => void;
}) {
  const meta = CONFIDENCE_META[row.confidence];
  const draft = row.draft as ListingDraft;
  const title =
    draft.society?.trim() ||
    draft.address?.trim() ||
    `${SCRAPE_SOURCE_LABELS[row.source]} listing`;

  return (
    <li className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          {draft.address && draft.address !== title ? (
            <p className="truncate text-sm text-muted-foreground">{draft.address}</p>
          ) : null}
        </div>
        <Badge className={meta.className}>{meta.label}</Badge>
      </div>

      <p className="mt-2 text-sm">{summary(draft).join(" · ") || "Nothing read"}</p>

      {row.missing.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Missing: {row.missing.join(", ")}
        </p>
      ) : null}
      {row.reasons.length ? (
        <p className="mt-1 text-xs text-muted-foreground">{row.reasons.join(" · ")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onImport}>
          Import
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onEdit}
        >
          Edit in form
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </Button>
        {row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto text-xs text-muted-foreground underline"
          >
            Open original
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function ScrapeTray({
  open,
  onOpenChange,
  pending,
  error,
  onImport,
  onReject,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: ScrapedListing[];
  error: string | null;
  onImport: (row: ScrapedListing) => Promise<void>;
  onReject: (row: ScrapedListing) => Promise<void>;
  onEdit: (row: ScrapedListing) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);

  const { kept, filtered } = useMemo(
    () => ({
      kept: pending.filter((r) => r.confidence !== "low"),
      filtered: pending.filter((r) => r.confidence === "low"),
    }),
    [pending]
  );

  const run = async (row: ScrapedListing, fn: () => Promise<void>) => {
    setBusyId(row.id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  const rowProps = (row: ScrapedListing) => ({
    row,
    busy: busyId === row.id,
    onImport: () => void run(row, () => onImport(row)),
    onReject: () => void run(row, () => onReject(row)),
    onEdit: () => onEdit(row),
  });

  return (
    <Overlay
      open={open}
      onClose={() => onOpenChange(false)}
      title="Captured listings"
      description="Harvested from your browser. Nothing reaches the board until you import it."
      variant="drawer"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Open a NoBroker or Facebook Marketplace search and
            click the import pill.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {kept.map((row) => (
            <CaptureRow key={row.id} {...rowProps(row)} />
          ))}
        </ul>

        {filtered.length ? (
          <div className="mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowFiltered((v) => !v)}
            >
              {showFiltered
                ? "Hide filtered"
                : `Show ${filtered.length} filtered`}
            </Button>
            {showFiltered ? (
              <ul className="mt-3 flex flex-col gap-3">
                {filtered.map((row) => (
                  <CaptureRow key={row.id} {...rowProps(row)} />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
