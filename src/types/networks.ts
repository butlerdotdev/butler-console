// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import type { ObjectMeta, Condition } from './index'

// ----------------------------------------------------------------------------
// NetworkPool CRD
// ----------------------------------------------------------------------------

export interface NetworkPoolSpec {
	cidr: string
	reserved?: Array<{
		cidr: string
		description?: string
	}>
	tenantAllocation?: {
		start?: string
		end?: string
		defaults?: {
			nodesPerTenant?: number
			lbPoolPerTenant?: number
		}
	}
}

export interface NetworkPoolStatus {
	totalIPs?: number
	allocatedIPs?: number
	availableIPs?: number
	allocationCount?: number
	fragmentation?: number
	largestFreeBlock?: number
	conditions?: Condition[]
}

export interface NetworkPool {
	apiVersion?: string
	kind?: string
	metadata: ObjectMeta
	spec: NetworkPoolSpec
	status?: NetworkPoolStatus
}

export interface NetworkPoolListResponse {
	pools: NetworkPool[]
}

// ----------------------------------------------------------------------------
// IPAllocation CRD
// ----------------------------------------------------------------------------

export type AllocationPhase = 'Pending' | 'Allocated' | 'Released' | 'Failed'

export interface IPAllocationSpec {
	poolRef: {
		name: string
		namespace?: string
	}
	tenantClusterRef?: {
		name: string
		namespace?: string
	}
	type?: 'nodes' | 'loadbalancer'
	count?: number
	pinnedRange?: {
		start: string
		end: string
	}
}

export interface IPAllocationStatus {
	phase?: AllocationPhase
	startAddress?: string
	endAddress?: string
	addresses?: string[]
	allocatedAt?: string
	conditions?: Condition[]
}

export interface IPAllocation {
	apiVersion?: string
	kind?: string
	metadata: ObjectMeta
	spec: IPAllocationSpec
	status?: IPAllocationStatus
}

export interface IPAllocationListResponse {
	allocations: IPAllocation[]
}

// ----------------------------------------------------------------------------
// Create Request
// ----------------------------------------------------------------------------

export interface CreateNetworkPoolRequest {
	name: string
	namespace?: string
	cidr: string
	reserved?: Array<{
		cidr: string
		description?: string
	}>
	tenantAllocation?: {
		start?: string
		end?: string
		defaults?: {
			nodesPerTenant?: number
			lbPoolPerTenant?: number
		}
	}
}
