# Visit groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank houses by visit checks and group Shortlisted and Contacted houses that can be seen in one outing, with a Google Maps route for exact pins.

**Architecture:** Pure functions in `src/lib/visit-plan.ts` score a checklist, compare houses, cluster them at 2 km, order each cluster as a visit, and build a maps URL. `listing-board.tsx` renders groups on Shortlisted and Contacted and a flat ranked list on New and Rejected. No schema or API change.

**Tech Stack:** TypeScript, node:test via `npm test`, React client components.

**Spec:** `docs/superpowers/specs/2026-10-03-visit-groups-design.md`

## Global Constraints

- Group radius is 2 km or closer, straight-line, same measurement as the KCDC circle.
- Empty checklist scores 0/3.
- Route uses only exact pins, at most 11 stops, `travelmode=driving`.
- A group of one house has no header.
- New and Rejected are ranked and not grouped.

## Review Focus

- A checklist saved as an empty array must not score as complete.
- A house with no map position must not be pulled into a neighbour's group.
- An approximate pin inside a real cluster must stay in the visit order and off the maps URL.
- Exactly 2000 m joins; just over 2000 m does not.
- More than 11 exact stops must not put the 12th coordinate in the URL.

### Task 1: Rank and groups

**Files:**
- Create: `src/lib/visit-plan.ts`
- Create: `src/lib/visit-plan.test.ts`
- Modify: `src/lib/map-position.ts` (export `distanceMeters`)

**Interfaces:**
- Produces: `checkScore(checks: VisitCheck[]): { ticked: number; total: number }`
- Produces: `compareByRank(a: Listing, b: Listing): number` (negative when `a` ranks first)
- Produces: `rankListings(listings: Listing[]): Listing[]`
- Produces: `formatSpan(meters: number): string`
- Produces: `groupVisits(listings: Listing[], positions: Map<string, MapPosition>): VisitGroup[]`
- `VisitGroup`: `{ id: string; listings: Listing[]; spanM: number; approximate: boolean; route: { url: string; omitted: number } | null }`

- [ ] Write failing tests for score, rank, chain grouping, boundary, visit order, route URL, and the 11-stop cap.
- [ ] Run `npm test -- src/lib/visit-plan.test.ts` and confirm the module is missing.
- [ ] Implement `visit-plan.ts` and export `distanceMeters`.
- [ ] Re-run the test file and confirm it passes.

### Task 2: List UI

**Files:**
- Modify: `src/components/listing-board.tsx`

- [ ] Shortlisted and Contacted render `groupVisits` of the current tab, using `mapPositions(listings)` so pins and groups share positions.
- [ ] Groups of two or more show a header: count, span, "approximate" when needed, "Open route" when `route` is set, and how many exact houses were left off.
- [ ] Each card shows `ticked/total` from `checkScore`.
- [ ] New and Rejected render `rankListings` with no headers.
- [ ] Verify in the browser on the running dev server.
