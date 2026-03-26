# IPAM `nodesPerTenant` — Review Needed

**Date**: 2026-03-26
**Context**: During P1.4 (NetworkPool Edit modal), we questioned whether `nodesPerTenant` in `NetworkPool.spec.tenantAllocation.defaults` serves a real purpose.

## The Problem

`nodesPerTenant` reserves a block of IPs from the NetworkPool for worker node addresses. But in every realistic deployment:

- **On-prem (Harvester, Nutanix, Proxmox)**: Worker VMs get IPs from DHCP on the VLAN. Butler doesn't assign static IPs to nodes.
- **Cloud (AWS, GCP, Azure)**: `network.mode: cloud` skips IPAM entirely. The cloud provider handles all networking.

There is no practical scenario where Butler needs to statically assign node IPs from the pool. The only IPAM allocation doing real work is `lbPoolPerTenant` — MetalLB needs specific IPs reserved for LoadBalancer VIPs, which can't come from DHCP.

## What Exists Today

- **CRD field**: `NetworkPool.spec.tenantAllocation.defaults.nodesPerTenant` (int32) in `butler-api/api/v1alpha1/networkpool_types.go`
- **Allocation logic**: `internal/controller/networkpool/networkpool_controller.go` processes IPAllocations with `type: nodes`
- **TenantCluster controller**: Creates IPAllocation with `type: nodes` when `network.mode: ipam`
- **Console**: Removed from EditNetworkPoolModal (2026-03-26). Still present in CreateNetworkPoolModal and NetworkPoolDetailPage read-only view.
- **Server**: Still accepted in Create/Update NetworkPool request payloads

## Decision Needed

Options:
1. **Remove from CRD** — Delete `nodesPerTenant` from `TenantAllocationDefaults`, remove node IP allocation logic from controllers. Breaking change, needs migration.
2. **Deprecate in UI** — Hide from all console forms (done for edit, still in create). Keep in CRD for backward compat but don't surface it.
3. **Keep but document** — Mark as "advanced/optional" for edge cases (air-gapped bare metal with no DHCP). Low priority.

## Affected Files

- `butler-api/api/v1alpha1/networkpool_types.go` — `TenantAllocationDefaults.NodesPerTenant`
- `butler-controller/internal/controller/networkpool/networkpool_controller.go` — allocation processing
- `butler-controller/internal/controller/tenantcluster/tenantcluster_controller.go` — node IPAllocation creation
- `butler-console/src/components/networks/CreateNetworkPoolModal.tsx` — still shows nodesPerTenant field
- `butler-console/src/pages/NetworkPoolDetailPage.tsx` — still shows nodesPerTenant in read-only view
- `butler-server/internal/api/handlers/networks.go` — still accepts in create/update payloads
