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
import {
  apiDeleteListing,
  apiListListings,
  apiPatchListing,
  apiReplaceListings,
  apiUpsertListing,
} from "./listings-api";
import { loadListings } from "./storage";
import type { Listing, ListingDraft } from "./types";

type ListingsContextValue = {
  listings: Listing[];
  ready: boolean;
  error: string | null;
  upsert: (listing: Listing) => Promise<Listing>;
  update: (id: string, patch: ListingDraft) => Promise<Listing>;
  remove: (id: string) => Promise<void>;
  replaceAll: (listings: Listing[]) => Promise<void>;
};

const ListingsContext = createContext<ListingsContextValue | null>(null);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let remote = await apiListListings();
        if (remote.length === 0) {
          const local = loadListings();
          if (local.length > 0) {
            remote = await apiReplaceListings(local, true);
          }
        }
        if (cancelled) return;
        setListings(remote);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load listings");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsert = useCallback(async (listing: Listing) => {
    const saved = await apiUpsertListing(listing);
    setListings((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setError(null);
    return saved;
  }, []);

  const update = useCallback(async (id: string, patch: ListingDraft) => {
    const saved = await apiPatchListing(id, patch);
    setListings((prev) => prev.map((l) => (l.id === id ? saved : l)));
    setError(null);
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDeleteListing(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
    setError(null);
  }, []);

  const replaceAll = useCallback(async (next: Listing[]) => {
    const saved = await apiReplaceListings(next);
    setListings(saved);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ listings, ready, error, upsert, update, remove, replaceAll }),
    [listings, ready, error, upsert, update, remove, replaceAll]
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
