# ADR 0001: IPAM Page Full Network Pool Visualization

**Status:** Proposed
**Date:** 2026-04-29
**Issue:** butlerdotdev/butler-console#52

## Context

The IPAM Network Pools detail page currently presents utilization stats and a
usage bar scoped to the tenant allocation range. When a /23 pool (512 IPs)
has a tenant allocation window of .32-.63, the page shows "9/32 IPs used"
with no indication that the other 480 IPs exist or what they're doing.

This is a real problem for operators working with brownfield network
deployments. They configure Butler's IPAM for a narrow tenant carve-out
within a broader site network, then hand the console to colleagues who don't
have that context. Those colleagues see a pool that looks 28% full when it's
actually a sliver of a much larger, mostly-spoken-for network. They can't
verify whether a proposed tenant range overlaps with the site's DHCP scope or
management infrastructure without leaving the console and cross-referencing
external documentation.

The IPAddressMap component already renders the full pool CIDR as a
color-coded grid. The gaps are in the summary layer above it:

- **Stats cards** report controller status values scoped to the tenant range
  (`TotalIPs`, `AllocatedIPs`, `AvailableIPs`), not the full pool.
- **No layout overview** shows how the full CIDR is subdivided across uses.
- **Reserved ranges are visually uniform** — all gray, no distinction between
  DHCP, management, infrastructure, or generic reservations.
- **PoolUsageBar** shows a single green/amber/red bar for tenant utilization
  only.

## Decision

Extend the IPAM detail page to show the full network pool context, using a
two-phase approach:

### Phase 1: Console-only changes (no schema change)

All data needed to render the full pool breakdown already exists in the
NetworkPool spec: `cidr`, `reserved[]` (with CIDR + description), and
`tenantAllocation.start/end`. Phase 1 computes the full layout client-side
and renders it. No API, CRD, or controller changes.

Specifically:

1. **Extract IP math utilities** (`ipToInt`, `intToIp`, `parseCIDR`) from
   `IPAddressMap.tsx` into a shared `src/lib/ip-math.ts` module.

2. **Add a NetworkLayoutBar component** — a stacked horizontal bar showing
   the full CIDR divided into proportional segments:

   ```
   ┌──────────────────────────────────────────────────────────────┐
   │ 10.92.90.0/23  (512 addresses)                              │
   │                                                              │
   │ ┌──────────────────────────────────────────────────────────┐ │
   │ │░░░░░░░░░│████████│▓▓▓▓▓▓▓▓▓▓▓▓▓│▒▒▒▒▒│●│              │ │
   │ │ DHCP    │  Mgmt  │   Tenant     │ Rsvd │G│  Unassigned  │ │
   │ │ .0-.127 │.128-159│  .160-.223   │      │ │   .224-.511  │ │
   │ └──────────────────────────────────────────────────────────┘ │
   │                                                              │
   │ Segment colors:                                              │
   │   ░ Reserved (DHCP scope)     █ Reserved (Management LBs)   │
   │   ▓ Tenant allocation         ▒ Reserved (other)            │
   │   ● Gateway                      Unassigned                 │
   └──────────────────────────────────────────────────────────────┘
   ```

   In Phase 1, all reserved ranges share the same gray color.
   Descriptions appear in hover tooltips. The tenant segment is subdivided
   to show allocated (darker) vs available (lighter) within it.

3. **Revise stats cards into two tiers:**

   **Full Pool** (top row):
   | Pool Size | Reserved | Tenant Range | Unassigned |
   |-----------|----------|--------------|------------|
   | 512       | 288      | 64           | 159        |

   **Tenant Allocation** (second row, labeled with the IP range):
   | Allocated | Available | Fragmentation | Largest Free Block |
   |-----------|-----------|---------------|--------------------|
   | 9         | 55        | 12%           | 23                 |

   The second row uses the existing controller status values. The first
   row is computed client-side from `spec.cidr`, `spec.reserved`, and
   `spec.tenantAllocation`.

4. **Enhance the Reserved Ranges card** to show IP count and percentage of
   total pool alongside each CIDR and description.

### Phase 2: CRD schema enhancement (multi-repo)

Add a `purpose` enum field to the existing `ReservedRange` struct in
`butler-api`:

```go
type ReservedRange struct {
    CIDR        string `json:"cidr"`
    Description string `json:"description,omitempty"`
    // +optional
    // +kubebuilder:validation:Enum=dhcp;management;infrastructure;gateway;""
    Purpose     string `json:"purpose,omitempty"`
}
```

This unlocks color-coded reserved-range visualization in the console. Each
purpose gets a distinct color in both the NetworkLayoutBar and IPAddressMap
grid. The create/edit modals gain a "Purpose" dropdown per reserved range.

The field is optional and defaults to empty, so existing NetworkPool
resources continue to work unchanged.

### Why this approach over alternatives

**Annotations (rejected):** Storing network layout data in annotations
(`butler.butlerlabs.dev/dhcp-scope: 10.92.90.0/25`) avoids a schema
change but introduces unvalidated, stringly-typed data that can't be set
from console modals and that other Butler components can't consume
reliably. Annotation typos silently produce wrong visualizations.

**Separate CR/ConfigMap (rejected):** A console-managed
`NetworkPoolLayout` resource decouples the layout data from the pool
lifecycle. This means two objects to keep in sync per pool, no
referential integrity (pool gets deleted, layout stays), and one more
thing for operators to write YAML for. The reserved ranges on the
NetworkPool spec already carry 90% of this data.

**CRD-first (rejected as initial approach):** Gating the console work on
a CRD change delays the fix unnecessarily. The core problem — "show the
full pool" — is solvable with data that already exists. The CRD
enhancement adds refinement (per-type coloring) and should follow, not
block, the console work.

## Consequences

### What changes

- The IPAM detail page shifts from a tenant-range-only view to a
  full-pool-context view, with the tenant details preserved as a
  drill-down section.
- Operators can see at a glance how a site's network is carved up and
  where the tenant range sits within it.
- The IP math utilities become reusable across components.

### What's deferred

- **Overlap warnings** (DHCP scope vs tenant range) are a follow-up.
  Phase 1 provides the visual context for operators to spot overlaps
  themselves. Automated detection requires either the `purpose` field
  (Phase 2) or description-string heuristics (fragile). Ship it after
  Phase 2 lands.
- **Controller-side full-pool stats** — the controller currently reports
  `TotalIPs`/`AllocatedIPs`/`AvailableIPs` scoped to the tenant range.
  A future enhancement could add full-pool counters to the status, but
  client-side computation from spec fields is sufficient and avoids a
  controller change.
- **NetworkPoolsPage (list view)** — the pool card list continues showing
  tenant utilization via PoolUsageBar. Adding full-pool context to the
  list view is a separate decision; the detail page is the priority.

### What to watch for

- **Segment overlap:** Reserved ranges and the tenant allocation range
  can overlap (the controller handles this in its bitmap allocator). The
  layout bar should treat overlap as reserved-wins for display, matching
  the controller's behavior where reserved IPs are excluded from
  allocation.
- **Large pools:** A /16 pool has 65,536 IPs. The layout bar is
  proportional (not per-IP), so it handles any pool size. The existing
  IPAddressMap already groups large pools into /24 blocks.

## Implementation Outline

### Phase 1 PR (butler-console only)

| Action | File |
|--------|------|
| Create | `src/lib/ip-math.ts` |
| Create | `src/components/networks/NetworkLayoutBar.tsx` |
| Modify | `src/components/networks/IPAddressMap.tsx` (import from ip-math) |
| Modify | `src/pages/NetworkPoolDetailPage.tsx` (layout bar, two-tier stats, enhanced reserved card) |

PoolUsageBar.tsx is unchanged — it's still used by the list page.

### Phase 2 PRs (multi-repo)

| Repo | Scope |
|------|-------|
| butler-api | Add `Purpose` to `ReservedRange`, regenerate CRD manifests |
| butler-charts | Update CRD template in butler-crds chart, version bump |
| butler-console | Purpose-aware colors in IPAddressMap + NetworkLayoutBar, purpose dropdown in create/edit modals |

### Phase 3 PR (follow-up)

| Repo | Scope |
|------|-------|
| butler-console | Overlap warning banner when reserved ranges with `purpose=dhcp` intersect the tenant allocation range |

### Verification

- Unit tests for `ip-math.ts` (pure functions, exhaustive edge cases)
- Unit tests for the layout computation (extract as pure function)
- Manual verification against real NetworkPool resources in a dev cluster:
  layout bar segment widths should sum to 100% and align with the
  IPAddressMap grid
- Backward compatibility: pools without `purpose` field render identically
  to Phase 1 (all reserved ranges gray)
