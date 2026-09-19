"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { ParkingPreferredToggle } from "@/components/listing-form";
import { AREAS, SOURCES, STATUSES, type Area, type Filters } from "@/lib/types";

export function FiltersBar({
  filters,
  onChange,
  onAreaFocus,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  onAreaFocus: (area: Area | null) => void;
}) {
  const toggleArea = (area: Area) => {
    const has = filters.areas.includes(area);
    const areas = has
      ? filters.areas.filter((a) => a !== area)
      : [...filters.areas, area];
    onChange({ ...filters, areas });
    onAreaFocus(has ? null : area);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {AREAS.map((area) => {
          const active = filters.areas.includes(area);
          return (
            <Button
              key={area}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => toggleArea(area)}
            >
              {area}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="max-rent">Max rent (₹)</Label>
          <Input
            id="max-rent"
            className="w-32"
            inputMode="numeric"
            value={filters.maxRent}
            onChange={(e) =>
              onChange({
                ...filters,
                maxRent: Number(e.target.value.replace(/[^\d]/g, "")) || 0,
              })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => {
              if (typeof v === "string")
                onChange({ ...filters, status: v as Filters["status"] });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Source</Label>
          <Select
            value={filters.source}
            onValueChange={(v) => {
              if (typeof v === "string")
                onChange({ ...filters, source: v as Filters["source"] });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="pb-1">
          <ParkingPreferredToggle
            checked={filters.parkingPreferred}
            onChange={(parkingPreferred) =>
              onChange({ ...filters, parkingPreferred })
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Over-budget listings stay on the board and map, marked in red. Parking
        preferred hides “no parking” only.
      </p>
    </div>
  );
}
