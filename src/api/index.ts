// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export { apiClient } from './client'
export { authApi } from './auth'
export { clustersApi } from './clusters'
export { providersApi } from './providers'
export { addonsApi } from './addons'
export { gitopsApi } from './gitops';
export * from './gitops';

export { identityProvidersApi, PROVIDER_PRESETS } from './identity-providers'
export { networksApi } from './networks'
export * from './certificates';

export type { Provider, ProviderListResponse, CreateProviderRequest, ValidateResponse, ImageInfo, NetworkInfo, CloudProviderType, OnPremProviderType } from './providers'
export { isCloudProvider, getProviderRegion, getProviderNetwork } from './providers'
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

export type {
	IdentityProvider,
	IdentityProviderListResponse,
	CreateIdentityProviderRequest,
	TestDiscoveryResponse,
	ProviderPresetKey,
} from './identity-providers'

export type { AddonDefinition, InstalledAddon, CatalogResponse } from './addons'

export type {
	NetworkPool,
	NetworkPoolListResponse,
	IPAllocation,
	IPAllocationListResponse,
	CreateNetworkPoolRequest,
} from '@/types/networks'

// Backwards compatible aliases
export type { ManagementCluster as ManagementClusterInfo } from './clusters'
export type { ManagementPod as PodInfo } from './clusters'
export type { Node as NodeInfo } from './clusters'
