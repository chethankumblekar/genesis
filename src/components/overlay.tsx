"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "drawer",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "drawer" | "modal";
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panel =
    variant === "drawer"
      ? "absolute inset-y-0 right-0 z-10 flex w-full max-w-lg flex-col bg-card text-card-foreground shadow-xl pointer-events-auto"
      : "relative z-10 mx-auto mt-[8vh] flex max-h-[84vh] w-full max-w-lg flex-col rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-foreground/10 pointer-events-auto";

  return (
    <div className="fixed inset-0 z-[100]" role="presentation" data-hh-overlay="">
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/40"
        aria-label="Close overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hh-overlay-title"
        className={panel}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h2 id="hh-overlay-title" className="font-heading text-base font-medium">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
