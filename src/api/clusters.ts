// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

export interface Cluster {
	metadata: {
		name: string
		namespace: string
		uid?: string
		creationTimestamp?: string
	}
	spec: {
		kubernetesVersion: string
		providerConfigRef?: {
			name: string
			namespace?: string
		}
		teamRef?: {
			name: string
		}
		workers?: {
			replicas: number
			machineTemplate?: {
				cpu?: number
				memory?: string
				diskSize?: string
			}
		}
		networking?: {
			loadBalancerPool?: {
				start: string
				end: string
			}
		}
		infrastructureOverride?: {
			harvester?: {
				namespace?: string
				networkName?: string
				imageName?: string
			}
			nutanix?: {
				clusterUUID?: string
				subnetUUID?: string
				imageUUID?: string
				storageContainerUUID?: string
			}
			proxmox?: {
				node?: string
				storage?: string
				templateID?: number
			}
		}
	}
	status?: {
		phase?: string
		tenantNamespace?: string
		controlPlaneReady?: boolean
		infrastructureReady?: boolean
		observedState?: {
			addons?: Array<{
				name: string
				status: string
				version?: string
			}>
		}
		conditions?: Array<{
			type: string
			status: string
			reason?: string
			message?: string
		}>
	}
}

export interface ClusterListResponse {
	clusters: Cluster[]
}

export interface ClusterListOptions {
	namespace?: string
	team?: string
}

export interface CreateClusterRequest {
	name: string
	namespace?: string
	kubernetesVersion?: string
	providerConfigRef: string
	workerReplicas?: number
	workerCPU?: number
	workerMemory?: string
	workerDiskSize?: string
	loadBalancerStart: string
	loadBalancerEnd: string
	teamRef?: string

	// Harvester-specific
	harvesterNamespace?: string
	harvesterNetworkName?: string
	harvesterImageName?: string

	// Nutanix-specific
	nutanixClusterUUID?: string
	nutanixSubnetUUID?: string
	nutanixImageUUID?: string
	nutanixStorageContainerUUID?: string

	// Proxmox-specific
	proxmoxNode?: string
	proxmoxStorage?: string
	proxmoxTemplateID?: number
}

export interface ScaleRequest {
	replicas: number
}

export interface Node {
	name: string
	status: string
	roles: string[]
	version: string
	internalIP: string
	os: string
	containerRuntime: string
	cpu: string
	memory: string
	age: string
}

export interface Addon {
	name: string
	status: string
	version?: string
}

export interface ClusterEvent {
	type: string
	reason: string
	message: string
	source: string
	firstTimestamp: string
	lastTimestamp: string
	count: number
}

export interface ManagementCluster {
	name: string
	kubernetesVersion: string
	phase: string
	nodes: {
		total: number
		ready: number
	}
	systemNamespaces: Array<{
		namespace: string
		running: number
		total: number
	}>
	tenantClusters: number
	tenantNamespaces: Array<{
		name: string
		namespace: string
		tenantNamespace: string
		phase: string
	}>
}

export interface ManagementNode {
	name: string
	status: string
	roles: string[]
	version: string
	internalIP: string
	os: string
	containerRuntime: string
	cpu: string
	memory: string
	age: string
}

export interface ManagementPod {
	name: string
	namespace: string
	status: string
	ready: string
	restarts: number
	age: string
}

export const clustersApi = {
	/**
	 * List clusters with optional filters
	 * @param options - Filter options (namespace, team)
	 */
	async list(options?: ClusterListOptions): Promise<ClusterListResponse> {
		const params = new URLSearchParams()
		if (options?.namespace) {
			params.set('namespace', options.namespace)
		}
		if (options?.team) {
			params.set('team', options.team)
		}
		const queryString = params.toString()
		return apiClient.get<ClusterListResponse>(`/clusters${queryString ? `?${queryString}` : ''}`)
	},

	async get(namespace: string, name: string): Promise<Cluster> {
		return apiClient.get<Cluster>(`/clusters/${namespace}/${name}`)
	},

	async create(data: CreateClusterRequest): Promise<Cluster> {
		return apiClient.post<Cluster>('/clusters', data)
	},

	async delete(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/clusters/${namespace}/${name}`)
	},

	async scale(namespace: string, name: string, replicas: number): Promise<Cluster> {
		return apiClient.patch<Cluster>(`/clusters/${namespace}/${name}/scale`, { replicas })
	},

	async getKubeconfig(namespace: string, name: string): Promise<{ kubeconfig: string }> {
		return apiClient.get<{ kubeconfig: string }>(`/clusters/${namespace}/${name}/kubeconfig`)
	},

	async getNodes(namespace: string, name: string): Promise<{ nodes: Node[] }> {
		return apiClient.get<{ nodes: Node[] }>(`/clusters/${namespace}/${name}/nodes`)
	},

	async getAddons(namespace: string, name: string): Promise<{ addons: Addon[] }> {
		return apiClient.get<{ addons: Addon[] }>(`/clusters/${namespace}/${name}/addons`)
	},

	async getEvents(namespace: string, name: string): Promise<{ events: ClusterEvent[] }> {
		return apiClient.get<{ events: ClusterEvent[] }>(`/clusters/${namespace}/${name}/events`)
	},

	async getManagement(): Promise<ManagementCluster> {
		return apiClient.get<ManagementCluster>('/management')
	},

	async getManagementNodes(): Promise<{ nodes: ManagementNode[] }> {
		return apiClient.get<{ nodes: ManagementNode[] }>('/management/nodes')
	},

	async getManagementPods(namespace: string): Promise<{ pods: ManagementPod[] }> {
		return apiClient.get<{ pods: ManagementPod[] }>(`/management/namespaces/${namespace}/pods`)
	},
}
