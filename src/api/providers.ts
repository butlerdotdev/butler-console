// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

export interface Provider {
	metadata: {
		name: string
		namespace: string
		uid?: string
		creationTimestamp?: string
	}
	spec: {
		provider: string
		credentialsRef?: {
			name: string
			namespace?: string
			key?: string
		}
		nutanix?: {
			endpoint?: string
			port?: number
			insecure?: boolean
		}
		proxmox?: {
			endpoint?: string
			insecure?: boolean
			nodes?: string[]
		}
		// Cloud providers
		aws?: {
			region?: string
			vpcID?: string
			subnetIDs?: string[]
			securityGroupIDs?: string[]
		}
		azure?: {
			subscriptionID?: string
			resourceGroup?: string
			location?: string
			vnetName?: string
			subnetName?: string
		}
		gcp?: {
			projectID?: string
			region?: string
			network?: string
			subnetwork?: string
		}
		network?: {
			mode?: 'ipam' | 'cloud'
			poolRefs?: Array<{ name: string; priority?: number }>
			subnet?: string
			gateway?: string
			dnsServers?: string[]
			loadBalancer?: { defaultPoolSize?: number }
			quotaPerTenant?: { maxNodeIPs?: number; maxLoadBalancerIPs?: number }
		}
		scope?: {
			type?: 'platform' | 'team'
			teamRef?: { name: string }
		}
		limits?: {
			maxClustersPerTeam?: number
			maxNodesPerTeam?: number
		}
	}
	status?: {
		validated?: boolean
		lastValidationTime?: string
		ready?: boolean
		conditions?: Array<{
			type: string
			status: string
			reason: string
			message: string
		}>
		capacity?: {
			availableIPs?: number
			estimatedTenants?: number
		}
	}
}

export interface ProviderListResponse {
	providers: Provider[]
}

export interface ValidateResponse {
	valid: boolean
	message: string
}

export interface CreateProviderRequest {
	name: string
	namespace?: string
	provider: 'harvester' | 'nutanix' | 'proxmox' | 'aws' | 'azure' | 'gcp'
	// Harvester
	harvesterKubeconfig?: string
	// Nutanix
	nutanixEndpoint?: string
	nutanixPort?: number
	nutanixUsername?: string
	nutanixPassword?: string
	nutanixInsecure?: boolean
	// Proxmox
	proxmoxEndpoint?: string
	proxmoxUsername?: string
	proxmoxPassword?: string
	proxmoxTokenId?: string
	proxmoxTokenSecret?: string
	proxmoxInsecure?: boolean
	// Network configuration
	networkMode?: 'ipam' | 'cloud'
	networkSubnet?: string
	networkGateway?: string
	networkDnsServers?: string[]
	poolRefs?: Array<{ name: string; priority?: number }>
	lbDefaultPoolSize?: number
	quotaMaxNodeIPs?: number
	quotaMaxLoadBalancerIPs?: number
	// AWS
	awsRegion?: string
	awsAccessKeyId?: string
	awsSecretAccessKey?: string
	awsVpcId?: string
	awsSubnetIds?: string[]
	awsSecurityGroupIds?: string[]
	// Azure
	azureSubscriptionId?: string
	azureTenantId?: string
	azureClientId?: string
	azureClientSecret?: string
	azureResourceGroup?: string
	azureLocation?: string
	azureVnetName?: string
	azureSubnetName?: string
	// GCP
	gcpProjectId?: string
	gcpRegion?: string
	gcpServiceAccount?: string
	gcpNetwork?: string
	gcpSubnetwork?: string
	// Scope
	scopeType?: 'platform' | 'team'
	scopeTeamRef?: string
	// Limits
	maxClustersPerTeam?: number
	maxNodesPerTeam?: number
}

export interface ImageInfo {
	name: string
	id: string
	description?: string
	os?: string
}

export interface ImageListResponse {
	images: ImageInfo[]
}

export interface NetworkInfo {
	name: string
	id: string
	vlan?: number
	description?: string
}

export interface NetworkListResponse {
	networks: NetworkInfo[]
}

export const providersApi = {
	async list(): Promise<ProviderListResponse> {
		return apiClient.get<ProviderListResponse>('/providers')
	},

	async get(namespace: string, name: string): Promise<Provider> {
		return apiClient.get<Provider>(`/providers/${namespace}/${name}`)
	},

	async create(data: CreateProviderRequest): Promise<Provider> {
		return apiClient.post<Provider>('/providers', data)
	},

	async delete(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/providers/${namespace}/${name}`)
	},

	async validate(namespace: string, name: string): Promise<ValidateResponse> {
		return apiClient.post<ValidateResponse>(`/providers/${namespace}/${name}/validate`, {})
	},

	async testConnection(data: CreateProviderRequest): Promise<ValidateResponse> {
		return apiClient.post<ValidateResponse>('/providers/test', data)
	},

	async listImages(namespace: string, name: string): Promise<ImageListResponse> {
		return apiClient.get<ImageListResponse>(`/providers/${namespace}/${name}/images`)
	},

	async listNetworks(namespace: string, name: string): Promise<NetworkListResponse> {
		return apiClient.get<NetworkListResponse>(`/providers/${namespace}/${name}/networks`)
	},

	async listTeamProviders(teamName: string): Promise<ProviderListResponse> {
		return apiClient.get<ProviderListResponse>(`/teams/${teamName}/providers`)
	},

	async createTeamProvider(teamName: string, data: CreateProviderRequest): Promise<Provider> {
		return apiClient.post<Provider>(`/teams/${teamName}/providers`, data)
	},

	async deleteTeamProvider(teamName: string, namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/teams/${teamName}/providers/${namespace}/${name}`)
	},

	async testTeamConnection(teamName: string, data: CreateProviderRequest): Promise<ValidateResponse> {
		return apiClient.post<ValidateResponse>(`/teams/${teamName}/providers/test`, data)
	},
}

export type CloudProviderType = 'aws' | 'azure' | 'gcp'
export type OnPremProviderType = 'harvester' | 'nutanix' | 'proxmox'

export function isCloudProvider(provider: string): provider is CloudProviderType {
	return ['aws', 'azure', 'gcp'].includes(provider)
}

export function getProviderRegion(provider: Provider): string | undefined {
	const type = provider.spec.provider
	if (type === 'aws') return provider.spec.aws?.region
	if (type === 'azure') return provider.spec.azure?.location
	if (type === 'gcp') return provider.spec.gcp?.region
	return undefined
}

export function getProviderNetwork(provider: Provider): string | undefined {
	const type = provider.spec.provider
	if (type === 'aws') return provider.spec.aws?.vpcID
	if (type === 'azure') return provider.spec.azure?.vnetName
	if (type === 'gcp') return provider.spec.gcp?.network
	return provider.spec.network?.subnet
}
