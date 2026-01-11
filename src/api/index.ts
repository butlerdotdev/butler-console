// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export { apiClient } from './client'
export { authApi } from './auth'
export { clustersApi } from './clusters'
export { providersApi } from './providers'
export { addonsApi } from './addons'

export type { Provider, ProviderListResponse, CreateProviderRequest, ImageInfo } from './providers'
export type {
	Cluster,
	ClusterListResponse,
	CreateClusterRequest,
	Node,
	Addon,
	ClusterEvent,
	ManagementCluster,
	ManagementNode,
	ManagementPod,
} from './clusters'
export type { AddonDefinition, InstalledAddon, CatalogResponse } from './addons'

// Backwards compatible aliases
export type { ManagementCluster as ManagementClusterInfo } from './clusters'
export type { ManagementPod as PodInfo } from './clusters'
export type { Node as NodeInfo } from './clusters'
