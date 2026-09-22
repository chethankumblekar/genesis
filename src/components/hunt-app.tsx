"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FiltersBar } from "@/components/filters-bar";
import { ListingBoard } from "@/components/listing-board";
import { ListingFormSheet } from "@/components/listing-form";
import { ListingMap } from "@/components/listing-map";
import { PasteHelperDialog } from "@/components/paste-helper";
import { ScrapeTray } from "@/components/scrape-tray";
import {
  apiListCaptures,
  apiPromoteScraped,
  apiRejectScraped,
  apiRestoreScraped,
} from "@/lib/scrape/scrape-api";
import type { ScrapedListing } from "@/lib/scrape/types";
import { useListings } from "@/lib/listings-context";
import { mergeListings, parseImport, toExportFile } from "@/lib/storage";
import { isOverBudget } from "@/lib/format";
import {
  DEFAULT_MAX_RENT,
  type Area,
  type Filters,
  type Listing,
  type ListingDraft,
} from "@/lib/types";

export function HuntApp({
  initialPending = [],
}: {
  initialPending?: ScrapedListing[];
}) {
  const { listings, ready, error, upsert, addLocal, update, remove, replaceAll } =
    useListings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<Filters>({
    maxRent: DEFAULT_MAX_RENT,
    parkingPreferred: true,
    areas: [],
    status: "all",
    source: "all",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<Area | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<ScrapedListing[]>(initialPending);
  const [rejected, setRejected] = useState<ScrapedListing[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  /** Set when a capture is being edited in the form, so saving promotes it. */
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const data = await apiListCaptures();
      setPending(data.pending);
      setRejected(data.rejected);
      setScrapeError(null);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Could not load captures");
    }
  }, []);

  // Captures usually arrive while this tab is in the background, so re-check
  // when it comes back into view rather than polling.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshPending();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshPending]);

  const visible = useMemo(() => {
    return listings.filter((l) => {
      if (filters.areas.length && !filters.areas.includes(l.area)) return false;
      if (filters.status !== "all" && l.status !== filters.status) return false;
      if (filters.source !== "all" && l.source !== filters.source) return false;
      if (filters.parkingPreferred && l.parking === "no") return false;
      return true;
    });
  }, [listings, filters]);

  const overCount = visible.filter((l) => isOverBudget(l, filters.maxRent)).length;

  async function saveListing(listing: Listing) {
    if (!promotingId) return upsert(listing);
    // Came from a capture: promote so the row is marked imported server-side.
    const saved = await apiPromoteScraped(promotingId, listing);
    addLocal(saved);
    setPromotingId(null);
    await refreshPending();
    return saved;
  }

  function openNew() {
    setPromotingId(null);
    setEditing(null);
    setDraft(null);
    setFormOpen(true);
  }

  function openEdit(listing: Listing) {
    setPromotingId(null);
    setDraft(null);
    setEditing(listing);
    setFormOpen(true);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(toExportFile(listings), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `househunting-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const incoming = parseImport(String(reader.result));
          await replaceAll(mergeListings(listings, incoming));
          setImportMsg(`Imported ${incoming.length} listing(s). Same IDs were updated.`);
        } catch (err) {
          setImportMsg(err instanceof Error ? err.message : "Import failed.");
        }
      })();
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary p-2 text-primary-foreground">
              <MapPin className="size-4" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-semibold tracking-tight">
                HouseHunting
              </h1>
              <p className="text-sm text-muted-foreground">
                2 BHK · gated / apartment · under ₹30k · HSR, Harlur, Kudlu,
                Koramangala, BTM
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.length ? (
              <button
                type="button"
                className={buttonVariants()}
                onClick={() => {
                  setTrayOpen(true);
                  void refreshPending();
                }}
              >
                {pending.length} captured
              </button>
            ) : null}
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => setPasteOpen(true)}
            >
              Find listings
            </button>
            <button
              type="button"
              className={buttonVariants()}
              onClick={openNew}
            >
              + Add listing
            </button>
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={exportJson}
            >
              Export JSON
            </button>
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => fileRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 md:p-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {importMsg ? (
          <p className="text-sm text-muted-foreground">{importMsg}</p>
        ) : null}
        {!ready ? (
          <p className="text-sm text-muted-foreground">Loading listings from the database…</p>
        ) : null}

        <FiltersBar
          filters={filters}
          onChange={setFilters}
          onAreaFocus={setFocusArea}
        />

        <p className="text-xs text-muted-foreground">
          Showing {visible.length} of {listings.length} listings
          {overCount ? ` · ${overCount} over ₹${filters.maxRent.toLocaleString("en-IN")}` : ""}
          {filters.parkingPreferred ? " · hiding no-parking" : ""}
        </p>

        {/* Map first, full width; the board reads underneath it. */}
        <section className="flex min-h-[320px] flex-1 flex-col gap-4">
          <div className="hh-map h-[55vh] min-h-[320px] w-full overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <ListingMap
              listings={visible}
              focusId={focusId}
              focusArea={focusArea}
              onEdit={openEdit}
            />
          </div>
          <div className="min-w-0">
            <ListingBoard
              listings={visible}
              maxRent={filters.maxRent}
              selectedId={focusId}
              onSelect={setFocusId}
              onEdit={openEdit}
              onStatus={(id, status) => {
                void update(id, { status });
              }}
            />
          </div>
        </section>
      </main>

      <ListingFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        listing={editing}
        draft={draft}
        onSave={saveListing}
        onDelete={remove}
      />
      <ScrapeTray
        open={trayOpen}
        onOpenChange={setTrayOpen}
        pending={pending}
        rejected={rejected}
        error={scrapeError}
        onImport={async (row) => {
          try {
            addLocal(await apiPromoteScraped(row.id));
            await refreshPending();
          } catch (err) {
            setScrapeError(err instanceof Error ? err.message : "Import failed");
          }
        }}
        onReject={async (row) => {
          try {
            await apiRejectScraped(row.id);
            await refreshPending();
          } catch (err) {
            setScrapeError(err instanceof Error ? err.message : "Could not reject");
          }
        }}
        onRestore={async (row) => {
          try {
            await apiRestoreScraped(row.id);
            await refreshPending();
          } catch (err) {
            setScrapeError(err instanceof Error ? err.message : "Could not restore");
          }
        }}
        onEdit={(row) => {
          setTrayOpen(false);
          setEditing(null);
          setDraft(row.draft as ListingDraft);
          setPromotingId(row.id);
          setFormOpen(true);
        }}
      />
      <PasteHelperDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onConfirm={(nextDraft) => {
          setPasteOpen(false);
          setEditing(null);
          setPromotingId(null);
          setDraft(nextDraft);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
