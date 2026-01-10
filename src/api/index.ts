// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export { apiClient } from './client'
export { authApi } from './auth'
export { clustersApi } from './clusters'
export { providersApi } from './providers'
export { addonsApi } from './addons'

export type { Provider, ProviderListResponse, CreateProviderRequest } from './providers'
export type {
	Cluster,
	ClusterListResponse,
	CreateClusterRequest,
	ManagementCluster,
	ManagementNode,
	ManagementPod,
	Node,
	Addon,
	ClusterEvent,
} from './clusters'
export type { AddonDefinition, InstalledAddon, CatalogResponse } from './addons'

// Type aliases for backwards compatibility
export type ManagementClusterInfo = ManagementCluster
export type PodInfo = ManagementPod
export type NodeInfo = Node
