"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { defaultVisitChecks, type VisitCheck } from "@/lib/types";

export function VisitChecklist({
  checks,
  onChange,
}: {
  checks: VisitCheck[];
  onChange: (next: VisitCheck[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const shown = checks.length > 0 ? checks : defaultVisitChecks();
  const done = shown.filter((check) => check.checked).length;

  function addCheck() {
    const label = draft.trim();
    if (!label) return;
    onChange([
      ...shown,
      { id: crypto.randomUUID(), label: label.slice(0, 80), checked: false },
    ]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5 rounded-md bg-background/70 p-2">
      <p className="text-xs font-medium">
        Visit checks
        <span className="ml-1 font-normal text-muted-foreground">
          {done}/{shown.length}
        </span>
      </p>
      <ul className="space-y-1">
        {shown.map((check) => (
          <li key={check.id} className="flex items-center gap-1">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs">
              <Checkbox
                checked={check.checked}
                onCheckedChange={(value) =>
                  onChange(
                    shown.map((item) =>
                      item.id === check.id
                        ? { ...item, checked: value === true }
                        : item
                    )
                  )
                }
              />
              <span className={check.checked ? "truncate line-through" : "truncate"}>
                {check.label}
              </span>
            </label>
            <button
              type="button"
              className="px-1 text-xs text-muted-foreground"
              aria-label={`Remove ${check.label}`}
              onClick={() => onChange(shown.filter((item) => item.id !== check.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <Input
          value={draft}
          className="h-7"
          placeholder="Add a check"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCheck();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addCheck}>
          Add
        </Button>
      </div>
    </div>
  );
}
