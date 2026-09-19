"use client";

import { useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FiltersBar } from "@/components/filters-bar";
import { ListingBoard } from "@/components/listing-board";
import { ListingFormSheet } from "@/components/listing-form";
import { ListingMap } from "@/components/listing-map";
import { PasteHelperDialog } from "@/components/paste-helper";
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

export function HuntApp() {
  const { listings, upsert, update, remove, replaceAll } = useListings();
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

  function openNew() {
    setEditing(null);
    setDraft(null);
    setFormOpen(true);
  }

  function openEdit(listing: Listing) {
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
      try {
        const incoming = parseImport(String(reader.result));
        replaceAll(mergeListings(listings, incoming));
        setImportMsg(`Imported ${incoming.length} listing(s). Same IDs were updated.`);
      } catch (err) {
        setImportMsg(err instanceof Error ? err.message : "Import failed.");
      }
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
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => setPasteOpen(true)}
            >
              Paste URL or notes
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
        {importMsg ? (
          <p className="text-sm text-muted-foreground">{importMsg}</p>
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

        <section className="grid min-h-[320px] flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="hh-map h-[42vh] min-h-[280px] overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:h-auto lg:min-h-[480px]">
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
              onStatus={(id, status) => update(id, { status })}
            />
          </div>
        </section>
      </main>

      <ListingFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        listing={editing}
        draft={draft}
        onSave={upsert}
        onDelete={remove}
      />
      <PasteHelperDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onConfirm={(nextDraft) => {
          setEditing(null);
          setDraft(nextDraft);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
