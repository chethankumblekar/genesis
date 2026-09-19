"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatInr, isOverBudget, listingTitle } from "@/lib/format";
import { STATUSES, type Listing, type Status } from "@/lib/types";

export function ListingBoard({
  listings,
  maxRent,
  selectedId,
  onSelect,
  onEdit,
  onStatus,
}: {
  listings: Listing[];
  maxRent: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (listing: Listing) => void;
  onStatus: (id: string, status: Status) => void;
}) {
  if (listings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
        No listings match these filters. Find listings from a URL or notes, add
        one by hand, or loosen rent / parking / area.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max gap-3 pb-3">
        {STATUSES.map((status) => {
          const column = listings.filter((l) => l.status === status);
          return (
            <div key={status} className="w-[260px] shrink-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: STATUS_COLORS[status] }}
                />
                <h3 className="text-sm font-medium">{STATUS_LABELS[status]}</h3>
                <span className="text-xs text-muted-foreground">
                  {column.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {column.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                ) : (
                  column.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      maxRent={maxRent}
                      selected={selectedId === listing.id}
                      onSelect={() => onSelect(listing.id)}
                      onEdit={() => onEdit(listing)}
                      onStatus={(s) => onStatus(listing.id, s)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  maxRent,
  selected,
  onSelect,
  onEdit,
  onStatus,
}: {
  listing: Listing;
  maxRent: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onStatus: (status: Status) => void;
}) {
  const over = isOverBudget(listing, maxRent);
  return (
    <Card
      size="sm"
      className={
        selected
          ? "cursor-pointer ring-2 ring-primary"
          : "cursor-pointer hover:ring-1 hover:ring-foreground/20"
      }
      onClick={onSelect}
    >
      <CardHeader className="pb-0">
        <CardTitle className="line-clamp-2">{listingTitle(listing)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
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
        </div>
      </CardContent>
    </Card>
  );
}
