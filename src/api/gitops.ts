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
	PreviewClusterRequest,
	PreviewClusterResponse,
	ExportClusterRequest,
	ExportClusterResponse,
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
	async listBranches(fullName: string): Promise<Branch[]> {
		return apiClient.get<Branch[]>(`/gitops/repos/branches?repo=${encodeURIComponent(fullName)}`);
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

	/**
	 * v2 cluster-wide export — preview the whole cluster's tree before
	 * commit. Runs discovery + layout + coverage; no git interaction.
	 * The response carries the rendered files, the coverage report (with
	 * source-classified captured items), and a summary block including
	 * the native-inventory count — the agnostically-discovered surface.
	 */
	async previewCluster(
		namespace: string,
		name: string,
		request: PreviewClusterRequest = {}
	): Promise<PreviewClusterResponse> {
		return apiClient.post<PreviewClusterResponse>(
			`/clusters/${namespace}/${name}/gitops/preview-cluster`,
			request
		);
	},

	/**
	 * v2 cluster-wide export — commit the whole cluster's tree (or a
	 * subset, when selection is provided). Discovery is re-run at
	 * export time; the selection from a stale preview is matched
	 * against current state.
	 */
	async exportCluster(
		namespace: string,
		name: string,
		request: ExportClusterRequest
	): Promise<ExportClusterResponse> {
		return apiClient.post<ExportClusterResponse>(
			`/clusters/${namespace}/${name}/gitops/export-cluster`,
			request
		);
	},

	/**
	 * v2 management cluster preview. Same shape as previewCluster but
	 * for the mgmt cluster.
	 */
	async previewManagementCluster(
		request: PreviewClusterRequest = {}
	): Promise<PreviewClusterResponse> {
		return apiClient.post<PreviewClusterResponse>(
			'/management/gitops/preview-cluster',
			request
		);
	},

	/**
	 * v2 management cluster export. Same shape as exportCluster but
	 * for the mgmt cluster.
	 */
	async exportManagementCluster(
		request: ExportClusterRequest
	): Promise<ExportClusterResponse> {
		return apiClient.post<ExportClusterResponse>(
			'/management/gitops/export-cluster',
			request
		);
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
	PreviewClusterRequest,
	PreviewClusterResponse,
	ExportClusterRequest,
	ExportClusterResponse,
	CapturedItem,
	CapturedItemSource,
	CapturedItemIdentity,
} from '@/types/gitops';
