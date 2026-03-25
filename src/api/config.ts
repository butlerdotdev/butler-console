// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

// --- Response Types ---

export interface ButlerConfigResponse {
	multiTenancy: MultiTenancyInfo
	defaultNamespace: string
	defaultProviderRef?: ProviderRefInfo
	controlPlaneExposure?: ControlPlaneExposureInfo
	defaultAddonVersions?: AddonVersionsInfo
	defaultTeamLimits?: TeamLimitsInfo
	defaultControlPlaneResources?: CPResourcesInfo
	imageFactory?: ImageFactoryInfo
	sshAuthorizedKey?: string
	status: ConfigStatusInfo
}

export interface MultiTenancyInfo {
	mode: string
}

export interface ProviderRefInfo {
	name: string
}

export interface ControlPlaneExposureInfo {
	mode: string
	hostname?: string
	ingressClassName?: string
	controllerType?: string
	gatewayRef?: string
}

export interface AddonVersionsInfo {
	cilium?: string
	metallb?: string
	certManager?: string
	longhorn?: string
	traefik?: string
	fluxcd?: string
}

export interface TeamLimitsInfo {
	maxClusters?: number
	maxWorkersPerCluster?: number
	maxTotalCPU?: string
	maxTotalMemory?: string
	maxTotalStorage?: string
}

export interface CPResourcesInfo {
	apiServer?: ComponentResourcesInfo
	controllerManager?: ComponentResourcesInfo
	scheduler?: ComponentResourcesInfo
}

export interface ComponentResourcesInfo {
	requests?: ResourceQuantitiesInfo
	limits?: ResourceQuantitiesInfo
}

export interface ResourceQuantitiesInfo {
	cpu?: string
	memory?: string
}

export interface ImageFactoryInfo {
	url: string
	credentialsRef?: string
	defaultSchematicID?: string
	autoSync?: boolean
}

export interface ConfigStatusInfo {
	teamCount: number
	clusterCount: number
	controlPlaneExposureMode?: string
	tcpProxyRequired: boolean
}

// --- Request Types ---

export interface UpdateConfigRequest {
	multiTenancy?: MultiTenancyInfo
	defaultNamespace?: string
	defaultProviderRef?: ProviderRefInfo
	controlPlaneExposure?: ControlPlaneExposureInfo
	defaultAddonVersions?: AddonVersionsInfo
	defaultTeamLimits?: TeamLimitsInfo
	defaultControlPlaneResources?: CPResourcesInfo
	imageFactory?: ImageFactoryInfo
	sshAuthorizedKey?: string
}

// --- API ---

export const configApi = {
	async getConfig(): Promise<ButlerConfigResponse> {
		return apiClient.get<ButlerConfigResponse>('/admin/config')
	},

	async updateConfig(data: UpdateConfigRequest): Promise<ButlerConfigResponse> {
		return apiClient.put<ButlerConfigResponse>('/admin/config', data)
	},
}
