"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { withDefaultVisitChecks, type VisitCheck, type VisitPhase } from "@/lib/types";

export function VisitChecklist({
  checks,
  onChange,
}: {
  checks: VisitCheck[];
  onChange: (next: VisitCheck[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const shown = withDefaultVisitChecks(checks);
  const primary = shown.filter((check) => check.phase === "primary");
  const secondary = shown.filter((check) => check.phase === "secondary" && check.id.startsWith("default:"));
  const added = shown.filter((check) => !check.id.startsWith("default:"));

  function setChecked(id: string, checked: boolean) {
    onChange(shown.map((item) => (item.id === id ? { ...item, checked } : item)));
  }

  function addCheck() {
    const label = draft.trim();
    if (!label) return;
    onChange([
      ...shown,
      {
        id: crypto.randomUUID(),
        label: label.slice(0, 80),
        checked: false,
        phase: "secondary" satisfies VisitPhase,
      },
    ]);
    setDraft("");
  }

  return (
    <div className="space-y-2 rounded-md bg-background/70 p-2">
      <CheckGroup
        title="Must-have"
        checks={primary}
        onChecked={setChecked}
      />
      <CheckGroup
        title="Secondary"
        checks={[...secondary, ...added]}
        onChecked={setChecked}
        onRemove={(id) => onChange(shown.filter((item) => item.id !== id))}
      />
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

function CheckGroup({
  title,
  checks,
  onChecked,
  onRemove,
}: {
  title: string;
  checks: VisitCheck[];
  onChecked: (id: string, checked: boolean) => void;
  onRemove?: (id: string) => void;
}) {
  const done = checks.filter((check) => check.checked).length;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">
        {title}
        <span className="ml-1 font-normal text-muted-foreground">
          {done}/{checks.length}
        </span>
      </p>
      <ul className="space-y-1">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-1">
            <label className="flex min-w-0 flex-1 items-start gap-2 text-xs">
              <Checkbox
                checked={check.checked}
                className="mt-0.5"
                onCheckedChange={(value) => onChecked(check.id, value === true)}
              />
              <span className={check.checked ? "line-through" : undefined}>{check.label}</span>
            </label>
            {onRemove && !check.id.startsWith("default:") ? (
              <button
                type="button"
                className="px-1 text-xs text-muted-foreground"
                aria-label={`Remove ${check.label}`}
                onClick={() => onRemove(check.id)}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
