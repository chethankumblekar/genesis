# Visit groups and rank

Date: 2026-10-03
Status: approved for implementation

## Problem

The visit checklist records kitchen, bathroom, parking, and any checks added by hand. Those ticks do not change which house appears first, and houses that sit in the same pocket are mixed with houses across the city. The hunt needs the shortlist and the contacted list to surface the strongest houses, and to bunch the ones that can be seen in one outing.

## Outcome

On Shortlisted and Contacted, the right-hand list is visit groups. A group is houses within 2 km of each other. Groups are ordered by their best house. Inside a group, card order is the order to visit them. Each card shows its score. A group of two or more houses can open a Google Maps route for the houses that have a real position.

New and Rejected stay a flat list, sorted by the same rank. They are not grouped.

Nothing is stored. Score, groups, and visit order are computed from the listings already loaded and from the same map positions the pins use.

## Rank

Compare two houses in this order:

1. More ticked checks first.
2. Same tick count: fewer unticked checks first. 3/3 beats 3/5. 2/2 beats 2/3.
3. Still tied: lower rent first. A missing rent sorts after any known rent.
4. Still tied: the more recently updated house first.

An empty saved checklist counts as the three defaults, all unticked: 0/3. It does not count as 0/0. A house with nothing ticked therefore sits at the bottom of an otherwise ticked list.

The card shows the score as ticked/total, for example 2/3, using that same list (saved checks, or the three defaults when nothing is saved).

## Groups

Grouping runs on the houses in the current tab only. A shortlisted house and a contacted house are never in the same group.

Positions are the map positions already used for pins, including the area-centre stand-in for a house with no lat/lng.

Build groups greedily:

1. Take the houses still ungrouped, in rank order.
2. Start a group with the best remaining house.
3. Add any ungrouped house 2 km or closer to a house already in the group. Repeat until none qualify. Distance is straight-line, the same measurement the KCDC circle uses.
4. A chain counts. If A–B is 1.5 km and B–C is 1.5 km, C joins even when A–C is 3 km.

A house with no map position is its own group.

A group of one house renders as a card, with no group header. A group of two or more gets a header:

- How many houses.
- The span: the farthest pair in the group, shown in metres under 1 km and in kilometres otherwise (one decimal).
- The word "approximate" when any house in the group is not an exact pin.

Groups themselves sort by their best house, using the rank comparison above.

## Visit order

Inside a group, the first card is the best house by rank. Each following card is the nearest remaining house by straight-line distance. If two are equally near, the better-ranked one comes first.

This order is the card order and the order of stops on the route link. Approximate positions are included in the visit order. They are left off the maps link.

## Open route

The header of a group with at least two exact pins shows "Open route". It opens Google Maps directions in a new tab.

The URL is `https://www.google.com/maps/dir/?api=1` with `travelmode=driving`. Origin is the first exact house in visit order. Destination is the last. Houses in between are `waypoints`, separated by `|`.

Only exact pins are stops. If more than 11 exact houses are in the group, the link includes the first 11 in visit order, and the header says how many exact houses were left off. Google Maps accepts 9 waypoints plus origin and destination.

A group with fewer than two exact pins has no route link.

## What does not change

- Pins, the KCDC circle, the legend, status tabs, filters, the visit date, the visited checkbox, and the checklist editor stay as they are.
- The map is not filtered by the tab and does not draw the route.
- No database column and no API change.

## Tests

Pure functions, no browser:

- Rank orders by ticks, then fewer unticks, then rent, and treats an empty checklist as 0/3.
- A 2 km chain becomes one group. Houses farther than 2 km from every member stay out.
- Visit order starts at the best house, then nearest.
- The maps URL includes only exact pins, in visit order, and drops the link when fewer than two exist.
- A group longer than 11 exact stops keeps the first 11 and reports the rest.

After implementation, check Shortlisted and Contacted in the running app: score on the card, a header on a real cluster, a lone house with no header, and a route link that opens maps.
