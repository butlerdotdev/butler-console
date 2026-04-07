// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

export interface TenantControlPlane {
	name: string
	namespace: string
	specVersion: string
	status: {
		phase: string
		version: string
		controlPlaneEndpoint: string
		replicas: number
		readyReplicas: number
		servicePort: number
		loadBalancerIP: string
		dataStoreName: string
		dataStoreDriver: string
		konnectivityEnabled: boolean
		workerBootstrap: {
			provider: string
			endpoint: string
		}
	}
}

export interface DataStore {
	name: string
	driver: string
	endpoints: string[]
	usedBy: string[]
}

export const stewardApi = {
	async listTCPs(): Promise<{ tenantControlPlanes: TenantControlPlane[] }> {
		return apiClient.get('/management/tenantcontrolplanes')
	},

	async getTCP(namespace: string, name: string): Promise<TenantControlPlane> {
		return apiClient.get(`/management/tenantcontrolplanes/${namespace}/${name}`)
	},

	async getClusterTCP(namespace: string, clusterName: string): Promise<TenantControlPlane> {
		return apiClient.get(`/clusters/${namespace}/${clusterName}/tenantcontrolplane`)
	},

	async listDataStores(): Promise<{ datastores: DataStore[] }> {
		return apiClient.get('/management/datastores')
	},

	async getDataStore(name: string): Promise<DataStore> {
		return apiClient.get(`/management/datastores/${name}`)
	},
}
