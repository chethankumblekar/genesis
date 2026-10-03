"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatInr, isOverBudget, listingTitle } from "@/lib/format";
import { isNearKcdc, mapPositions } from "@/lib/map-position";
import { VisitChecklist } from "@/components/visit-checklist";
import {
  checkScore,
  formatSpan,
  groupVisits,
  rankListings,
  type VisitGroup,
} from "@/lib/visit-plan";
import {
  STATUSES,
  defaultVisitChecks,
  type Listing,
  type Status,
  type VisitCheck,
} from "@/lib/types";

export function ListingBoard({
  listings,
  status,
  onStatusTab,
  maxRent,
  selectedId,
  onSelect,
  onEdit,
  onStatus,
  onProgress,
}: {
  listings: Listing[];
  status: Status;
  onStatusTab: (status: Status) => void;
  maxRent: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (listing: Listing) => void;
  onStatus: (id: string, status: Status) => void;
  onProgress: (
    id: string,
    patch: { visitBooked?: string; visited?: boolean; visitChecks?: VisitCheck[] }
  ) => void;
}) {
  const column = listings.filter((l) => l.status === status);
  const positions = mapPositions(listings);
  const grouped = status === "shortlisted" || status === "contacted";
  const groups = grouped ? groupVisits(column, positions) : null;
  const ranked = grouped ? [] : rankListings(column);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={status}
        onValueChange={(value) => {
          if (typeof value === "string") onStatusTab(value as Status);
        }}
        className="shrink-0"
      >
        <TabsList className="grid h-auto w-full grid-cols-4">
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="px-1 text-[11px]">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: STATUS_COLORS[s] }}
              />
              {STATUS_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {listings.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
            No listings match these filters. Find listings from a URL or notes,
            add one by hand, or loosen rent / parking / area.
          </div>
        ) : column.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No houses in {STATUS_LABELS[status]}.
          </p>
        ) : (
          <div className="flex flex-col gap-2 pb-2">
            {groups
              ? groups.map((group) => (
                  <div key={group.id} className="flex flex-col gap-2">
                    <VisitGroupHeader group={group} />
                    {group.listings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        maxRent={maxRent}
                        selected={selectedId === listing.id}
                        onSelect={() => onSelect(listing.id)}
                        onEdit={() => onEdit(listing)}
                        onStatus={(s) => onStatus(listing.id, s)}
                        onProgress={(patch) => onProgress(listing.id, patch)}
                        nearKcdc={isNearKcdc(positions.get(listing.id))}
                      />
                    ))}
                  </div>
                ))
              : ranked.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    maxRent={maxRent}
                    selected={selectedId === listing.id}
                    onSelect={() => onSelect(listing.id)}
                    onEdit={() => onEdit(listing)}
                    onStatus={(s) => onStatus(listing.id, s)}
                    onProgress={(patch) => onProgress(listing.id, patch)}
                    nearKcdc={isNearKcdc(positions.get(listing.id))}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VisitGroupHeader({ group }: { group: VisitGroup }) {
  if (group.listings.length < 2) return null;
  const omitted = group.route?.omitted ?? 0;
  return (
    <div className="flex items-baseline justify-between gap-2 px-1 pt-1 text-xs text-muted-foreground">
      <p>
        {group.listings.length} houses · {formatSpan(group.spanM)}
        {group.approximate ? " · approximate" : ""}
        {omitted > 0 ? ` · ${omitted} left off the route` : ""}
      </p>
      {group.route ? (
        <a
          href={group.route.url}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 underline"
        >
          Open route
        </a>
      ) : null}
    </div>
  );
}

function listingHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function ListingCard({
  listing,
  maxRent,
  selected,
  onSelect,
  onEdit,
  onStatus,
  onProgress,
  nearKcdc,
}: {
  listing: Listing;
  maxRent: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onStatus: (status: Status) => void;
  onProgress: (patch: {
    visitBooked?: string;
    visited?: boolean;
    visitChecks?: VisitCheck[];
  }) => void;
  nearKcdc: boolean;
}) {
  const over = isOverBudget(listing, maxRent);
  const href = listingHref(listing.url);
  const score = checkScore(listing.visitChecks);
  return (
    <Card
      size="sm"
      className={
        selected
          ? "cursor-pointer ring-2 ring-primary"
          : "cursor-pointer hover:ring-1 hover:ring-foreground/20"
      }
      style={nearKcdc ? { backgroundColor: "rgba(227, 168, 5, 0.5)" } : undefined}
      onClick={onSelect}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2">{listingTitle(listing)}</CardTitle>
          <span className="shrink-0 text-xs font-medium tabular-nums">
            {score.ticked}/{score.total}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {listing.photoUrls?.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photoUrls[0]}
            alt=""
            loading="lazy"
            className="h-28 w-full rounded-md object-cover ring-1 ring-foreground/10"
            onError={(e) => {
              // Sources expire these links; a dead one should not leave a gap.
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <p className="text-sm">
          <span className={over ? "font-medium text-destructive" : "font-medium"}>
            {formatInr(listing.rent)}
          </span>
          <span className="text-muted-foreground">
            {" "}
            · {listing.bhk} BHK · {listing.area}
          </span>
        </p>
        <div className="flex flex-wrap gap-1">
          {over ? <Badge variant="destructive">Over budget</Badge> : null}
          {listing.parking === "yes" ? (
            <Badge variant="secondary">Parking</Badge>
          ) : listing.parking === "no" ? (
            <Badge variant="outline">No parking</Badge>
          ) : (
            <Badge variant="outline">Parking ?</Badge>
          )}
          <Badge variant="outline">{listing.source}</Badge>
        </div>
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
          <Select
            value={listing.status}
            onValueChange={(v) => {
              if (typeof v === "string") onStatus(v as Status);
            }}
          >
            <SelectTrigger className="h-7 w-[140px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-auto text-xs text-muted-foreground underline"
            >
              Listing
            </a>
          ) : null}
          </div>
          {listing.status === "contacted" ? (
            <div className="flex w-full flex-col gap-1.5 pt-1">
              <label className="grid gap-1 text-xs">
                Visit booked
                <Input
                  type="date"
                  className="h-7"
                  value={listing.visitBooked}
                  onChange={(e) => onProgress({ visitBooked: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={listing.visited}
                  onCheckedChange={(v) => {
                    const visited = v === true;
                    onProgress(
                      visited && listing.visitChecks.length === 0
                        ? { visited, visitChecks: defaultVisitChecks() }
                        : { visited }
                    );
                  }}
                />
                Visited
              </label>
            </div>
          ) : null}
          <VisitChecklist
            checks={listing.visitChecks}
            onChange={(visitChecks) => onProgress({ visitChecks })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
