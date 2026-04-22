// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export { apiClient } from './client'
export { authApi } from './auth'
export { clustersApi } from './clusters'
export { environmentsApi } from './environments'
export { providersApi } from './providers'
export { addonsApi } from './addons'
export { gitopsApi } from './gitops';
export * from './gitops';

export { identityProvidersApi, PROVIDER_PRESETS } from './identity-providers'
export { networksApi } from './networks'
export * from './certificates';
export { observabilityApi } from './observability'
export { imagesApi } from './images'
export { auditApi } from './audit'
export { configApi } from './config'
export { stewardApi } from './steward'
export type { TenantControlPlane, DataStore } from './steward'
export type {
	ButlerConfigResponse,
	UpdateConfigRequest,
	MultiTenancyInfo,
	ControlPlaneExposureInfo,
	AddonVersionsInfo,
	TeamLimitsInfo,
	CPResourcesInfo,
	ImageFactoryInfo,
	ConfigStatusInfo,
} from './config'

export type { Provider, ProviderListResponse, CreateProviderRequest, ValidateResponse, ImageInfo, NetworkInfo, CloudProviderType, OnPremProviderType } from './providers'
export { isCloudProvider, getProviderRegion, getProviderNetwork } from './providers'
export type {
	Cluster,
	ClusterListResponse,
	CreateClusterRequest,
	UpdateClusterRequest,
	FieldError,
	Node,
	Addon,
	ClusterEvent,
	ManagementCluster,
	ManagementNode,
	ManagementPod,
	MachineRequest,
	LoadBalancerRequest,
} from './clusters'

export type {
	IdentityProvider,
	IdentityProviderListResponse,
	CreateIdentityProviderRequest,
	TestDiscoveryResponse,
	ProviderPresetKey,
} from './identity-providers'

export type { AddonDefinition, InstalledAddon, CatalogResponse, AddonCategory, CreateAddonDefinitionRequest } from './addons'
export { CATEGORY_INFO } from './addons'

export type {
	NetworkPool,
	NetworkPoolListResponse,
	IPAllocation,
	IPAllocationListResponse,
	CreateNetworkPoolRequest,
} from '@/types/networks'

export type {
	ImageSync,
	ImageSyncListResponse,
	CreateImageSyncRequest,
	UpdateImageSyncRequest,
	FactoryCatalogEntry,
} from '@/types/imagesync'

export type {
	AuditEntry,
	AuditListResponse,
	AuditFilters,
} from './audit'

export type {
	TeamEnvironment,
	EnvironmentLimits,
	EnvironmentRequest,
} from '@/types/environments'
export { ENVIRONMENT_LABEL, ENVIRONMENT_NAME_PATTERN, ENVIRONMENT_NAME_MAX_LENGTH } from '@/types/environments'

// Backwards compatible aliases
export type { ManagementCluster as ManagementClusterInfo } from './clusters'
export type { ManagementPod as PodInfo } from './clusters'
export type { Node as NodeInfo } from './clusters'
