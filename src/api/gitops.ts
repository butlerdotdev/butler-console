/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from './client';
import type {
	GitProviderConfig,
	SaveGitProviderRequest,
	Repository,
	Branch,
	DiscoveryResult,
	ExportAddonRequest,
	ExportAddonResponse,
	PreviewManifestRequest,
	PreviewManifestResponse,
	MigrationRequest,
	MigrationResult,
	GitOpsStatus,
} from '@/types/gitops';

/**
 * GitOps API client
 */
export const gitopsApi = {
	/**
	 * Get the current Git provider configuration
	 */
	async getConfig(): Promise<GitProviderConfig> {
		return apiClient.get<GitProviderConfig>('/gitops/config');
	},

	/**
	 * Save Git provider configuration (token, etc.)
	 */
	async saveConfig(request: SaveGitProviderRequest): Promise<GitProviderConfig> {
		return apiClient.post<GitProviderConfig>('/gitops/config', request);
	},

	/**
	 * Clear Git provider configuration
	 */
	async clearConfig(): Promise<void> {
		return apiClient.delete('/gitops/config');
	},

	/**
	 * List repositories accessible to the configured Git provider
	 */
	async listRepositories(): Promise<Repository[]> {
		return apiClient.get<Repository[]>('/gitops/repos');
	},

	/**
	 * List branches for a repository
	 */
	async listBranches(owner: string, repo: string): Promise<Branch[]> {
		return apiClient.get<Branch[]>(`/gitops/repos/${owner}/${repo}/branches`);
	},

	/**
	 * Preview manifest generation without committing
	 */
	async previewManifests(request: PreviewManifestRequest): Promise<PreviewManifestResponse> {
		return apiClient.post<PreviewManifestResponse>('/gitops/preview', request);
	},

	/**
	 * Get GitOps status for a tenant cluster
	 */
	async getStatus(namespace: string, name: string): Promise<GitOpsStatus> {
		return apiClient.get<GitOpsStatus>(`/clusters/${namespace}/${name}/gitops/status`);
	},

	/**
	 * Discover Helm releases on a tenant cluster
	 */
	async discover(namespace: string, name: string): Promise<DiscoveryResult> {
		return apiClient.get<DiscoveryResult>(`/clusters/${namespace}/${name}/gitops/discover`);
	},

	/**
	 * Export a single addon to GitOps repository
	 */
	async exportAddon(
		namespace: string,
		name: string,
		request: ExportAddonRequest
	): Promise<ExportAddonResponse> {
		return apiClient.post<ExportAddonResponse>(
			`/clusters/${namespace}/${name}/gitops/export`,
			request
		);
	},

	/**
	 * Export a single installed Helm release to GitOps repository
	 */
	async exportRelease(
		namespace: string,
		name: string,
		request: {
			releaseName: string;
			releaseNamespace: string;
			repository: string;
			branch: string;
			path?: string;
			createPR?: boolean;
			prTitle?: string;
			helmRepoUrl?: string;
		}
	): Promise<ExportAddonResponse> {
		return apiClient.post<ExportAddonResponse>(
			`/clusters/${namespace}/${name}/gitops/export-release`,
			request
		);
	},

	/**
	 * Migrate multiple releases to GitOps repository
	 */
	async migrate(
		namespace: string,
		name: string,
		request: MigrationRequest
	): Promise<MigrationResult> {
		return apiClient.post<MigrationResult>(
			`/clusters/${namespace}/${name}/gitops/migrate`,
			request
		);
	},

	/**
	 * Enable GitOps on a tenant cluster (bootstrap Flux/ArgoCD)
	 */
	async enable(
		namespace: string,
		name: string,
		config: {
			provider: 'flux' | 'argocd';
			repository: string;
			branch?: string;
			path?: string;
			private?: boolean;
			componentsExtra?: string[];
		}
	): Promise<{ success: boolean; message: string }> {
		return apiClient.post(`/clusters/${namespace}/${name}/gitops/enable`, config);
	},

	/**
	 * Disable GitOps on a tenant cluster
	 */
	async disable(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/clusters/${namespace}/${name}/gitops`);
	},

	/**
	 * Get GitOps status for the management cluster
	 */
	async getManagementStatus(): Promise<GitOpsStatus> {
		return apiClient.get<GitOpsStatus>('/management/gitops/status');
	},

	/**
	 * Discover Helm releases on the management cluster
	 */
	async discoverManagement(): Promise<DiscoveryResult> {
		return apiClient.get<DiscoveryResult>('/management/gitops/discover');
	},

	/**
	 * Export a single addon from catalog to GitOps repository for management cluster
	 * This is for addons that are NOT YET installed - generates manifests from AddonDefinition
	 */
	async exportManagementAddon(request: ExportAddonRequest): Promise<ExportAddonResponse> {
		return apiClient.post<ExportAddonResponse>('/management/gitops/export-catalog', request);
	},

	/**
	 * Export a single installed Helm release from management cluster to GitOps repository
	 * This is for addons that ARE ALREADY installed - discovers and exports the actual release
	 */
	async exportManagementRelease(request: {
		releaseName: string;
		releaseNamespace: string;
		repository: string;
		branch: string;
		path?: string;
		createPR?: boolean;
		prTitle?: string;
		helmRepoUrl?: string;
	}): Promise<ExportAddonResponse> {
		return apiClient.post<ExportAddonResponse>('/management/gitops/export', request);
	},

	/**
	 * Migrate management cluster releases to GitOps repository
	 */
	async migrateManagement(request: MigrationRequest): Promise<MigrationResult> {
		return apiClient.post<MigrationResult>('/management/gitops/migrate', request);
	},

	/**
	 * Enable GitOps on the management cluster (bootstrap Flux/ArgoCD)
	 */
	async enableManagement(config: {
		provider: 'flux' | 'argocd';
		repository: string;
		branch?: string;
		path?: string;
		private?: boolean;
		componentsExtra?: string[];
	}): Promise<{ success: boolean; message: string }> {
		return apiClient.post('/management/gitops/enable', config);
	},

	/**
	 * Disable GitOps on the management cluster
	 */
	async disableManagement(): Promise<void> {
		return apiClient.delete('/management/gitops');
	},
};

// Re-export types for convenience
export type {
	GitProviderConfig,
	SaveGitProviderRequest,
	Repository,
	Branch,
	DiscoveryResult,
	DiscoveredRelease,
	ExportAddonRequest,
	ExportAddonResponse,
	PreviewManifestRequest,
	PreviewManifestResponse,
	MigrationRequest,
	MigrationResult,
	GitOpsStatus,
	GitOpsEngineStatus,
} from '@/types/gitops';
