import { HuntApp } from "@/components/hunt-app";
import { ListingsProvider } from "@/lib/listings-context";
import { listPending } from "@/lib/scrape/scrape-repo";
import type { ScrapedListing } from "@/lib/scrape/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialPending: ScrapedListing[] = [];
  try {
    initialPending = await listPending();
  } catch {
    // Database down: the board still renders and reports its own error.
    // An empty tray is the right fallback here, not a 500.
  }

  return (
    <ListingsProvider>
      <HuntApp initialPending={initialPending} />
    </ListingsProvider>
  );
}
