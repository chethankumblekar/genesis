"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadListings, saveListings } from "./storage";
import type { Listing, ListingDraft } from "./types";

type ListingsContextValue = {
  listings: Listing[];
  ready: boolean;
  upsert: (listing: Listing) => void;
  update: (id: string, patch: ListingDraft) => void;
  remove: (id: string) => void;
  replaceAll: (listings: Listing[]) => void;
};

const ListingsContext = createContext<ListingsContextValue | null>(null);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage is browser-only; load after mount to avoid hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage
    setListings(loadListings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveListings(listings);
  }, [listings, ready]);

  const upsert = useCallback((listing: Listing) => {
    setListings((prev) => {
      const nextListing = { ...listing, updatedAt: new Date().toISOString() };
      const idx = prev.findIndex((l) => l.id === listing.id);
      if (idx === -1) return [nextListing, ...prev];
      const next = [...prev];
      next[idx] = nextListing;
      return next;
    });
  }, []);

  const update = useCallback((id: string, patch: ListingDraft) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, ...patch, updatedAt: new Date().toISOString() }
          : l
      )
    );
  }, []);

  const remove = useCallback((id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const replaceAll = useCallback((next: Listing[]) => {
    setListings(next);
  }, []);

  const value = useMemo(
    () => ({ listings, ready, upsert, update, remove, replaceAll }),
    [listings, ready, upsert, update, remove, replaceAll]
  );

  return (
    <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>
  );
}

export function useListings() {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error("useListings must be used within ListingsProvider");
  return ctx;
}
