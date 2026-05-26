/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Git provider type (GitHub, GitLab, etc.)
 */
export type GitProviderType = 'github' | 'gitlab';

/**
 * GitOps tool type (Flux, ArgoCD)
 */
export type GitOpsToolType = 'flux' | 'argocd';

/**
 * Configuration status for Git provider
 */
export interface GitProviderConfig {
	configured: boolean;
	type?: GitProviderType;
	url?: string;
	username?: string;
	organization?: string;
}

/**
 * Request to save Git provider configuration
 */
export interface SaveGitProviderRequest {
	type: GitProviderType;
	token: string;
	url?: string; // For GitHub Enterprise
	organization?: string;
}

/**
 * Git repository information
 */
export interface Repository {
	name: string;
	fullName: string;
	defaultBranch: string;
	private: boolean;
	cloneUrl: string;
	sshUrl: string;
	htmlUrl: string;
	updatedAt: string;
}

/**
 * Git branch information
 */
export interface Branch {
	name: string;
	sha: string;
	protected: boolean;
	default: boolean;
}

/**
 * GitOps engine status on a cluster
 */
export interface GitOpsEngineStatus {
	provider?: GitOpsToolType;
	installed: boolean;
	ready: boolean;
	version?: string;
	components?: string[];
	repository?: string; // owner/repo format
	branch?: string;
	path?: string;
}

/**
 * Discovered Helm release on a cluster
 */
export interface DiscoveredRelease {
	name: string;
	namespace: string;
	chart: string;
	chartVersion: string;
	appVersion?: string;
	status: string;
	revision: number;
	values?: Record<string, unknown>;
	repoUrl?: string;
	category?: string;
	addonDefinition?: string;
	platform?: boolean;
}

/**
 * Discovery result from a cluster
 */
export interface DiscoveryResult {
	matched: DiscoveredRelease[];
	unmatched: DiscoveredRelease[];
	gitopsEngine?: GitOpsEngineStatus;
}

/**
 * Request to export an addon to GitOps
 */
export interface ExportAddonRequest {
	addonName: string;
	repository: string;
	branch: string;
	targetPath: string;
	values?: Record<string, unknown>;
	createPR?: boolean;
	prTitle?: string;
	prBody?: string;
}

/**
 * Response from export operation
 */
export interface ExportAddonResponse {
	success: boolean;
	message: string;
	files?: string[];
	commitSha?: string;
	commitUrl?: string;
	prUrl?: string;
	prNumber?: number;
}

/**
 * Request to preview manifests
 */
export interface PreviewManifestRequest {
	addonName: string;
	repository: string;
	targetPath: string;
	values?: Record<string, unknown>;
	tool?: GitOpsToolType;
}

/**
 * Preview manifest response - filename to content mapping
 */
export type PreviewManifestResponse = Record<string, string>;

/**
 * v2 cluster-wide export preview types. The preview-cluster endpoint
 * runs discovery + layout + coverage on the whole cluster (no git
 * interaction) and returns the rendered tree plus a coverage report
 * with Source classification surfaced for the modal's three-section
 * UI: summary, captured-by-source, file tree.
 */

/**
 * Source classification for a captured item. The native-inventory
 * bucket is the v2 capability made visible — items the Flux
 * inventory walk found that Butler has no AddonDefinition for.
 */
export type CapturedItemSource = 'helm-addon' | 'helm-unmatched' | 'native-inventory';

/**
 * One captured resource as the preview API returns it. The Source
 * field tells the operator how this item was discovered: as a known
 * Butler addon, as an unmatched Helm release, or as an
 * agnostically-discovered native resource (the unknown-to-Butler
 * bucket).
 */
export interface CapturedItem {
	apiVersion: string;
	kind: string;
	namespace?: string;
	name: string;
	path?: string;
	sourceKustomization?: string;
	source: CapturedItemSource;
	addonDefinition?: string;
}

/**
 * Identity tuple used for selection in the preview. When the operator
 * selects a subset, the console sends a list of these identities; the
 * server filters discovery output to just those items before running
 * the export.
 */
export interface CapturedItemIdentity {
	kind: string;
	namespace?: string;
	name: string;
}

/**
 * Inline patch observed on a Flux Kustomization's spec.patches block.
 * Carried in the preview's coverage report so operators see env
 * overrides the v1 emit does not preserve as separate overlays.
 */
export interface InlinePatchCoverage {
	targetKind: string;
	targetName: string;
	targetNamespace?: string;
	targetGroup?: string;
	patchSize: number;
	note: string;
}

/**
 * Per-Kustomization observation. Loud surface for inline patches that
 * the v1 export does not preserve.
 */
export interface KustomizationCoverage {
	name: string;
	namespace: string;
	ready: boolean;
	lastAppliedRevision?: string;
	inventoryItemCount: number;
	skipped?: boolean;
	skipReason?: string;
	inlinePatches?: InlinePatchCoverage[];
}

/**
 * Discovery failure: inventory entry the walk found but couldn't
 * fetch (CRD version mismatch, RBAC, stale inventory). Loud surface
 * for the silent-drop class the v2 design exists to prevent.
 */
export interface DiscoveryFailureCoverage {
	inventoryID: string;
	group?: string;
	kind: string;
	namespace?: string;
	name: string;
	sourceKustomization?: string;
	error: string;
	hint?: string;
}

/**
 * Path collision: two distinct emitted objects resolving to the same
 * tree path. Empty in normal operation; populated when something
 * unexpected fires.
 */
export interface PathCollisionCoverage {
	path: string;
	conflicts: CapturedItem[];
}

/**
 * Coverage section of the preview response.
 */
export interface PreviewClusterCoverage {
	captured: CapturedItem[];
	fluxSelfManagement: CapturedItem[];
	kustomizationObservations: KustomizationCoverage[];
	discoveryFailures?: DiscoveryFailureCoverage[];
	pathCollisions?: PathCollisionCoverage[];
}

/**
 * Summary section of the preview response. The
 * capturedBySource.nativeInventory count is the load-bearing surface
 * — the visible answer to "how much did agnostic discovery find that
 * Butler doesn't recognize?"
 */
export interface PreviewClusterSummary {
	fileCount: number;
	capturedByKind: Record<string, number>;
	capturedBySource: {
		helmAddon: number;
		helmUnmatched: number;
		nativeInventory: number;
	};
	collisions: number;
	failures: number;
}

/**
 * Preview request body. Env defaults to "prd" if omitted.
 * clusterName overrides the directory name under clusters/; when
 * omitted, the server derives it from the cluster's Flux root path.
 */
export interface PreviewClusterRequest {
	env?: string;
	clusterName?: string;
}

/**
 * Preview response body. Files is the rendered tree (filename to
 * content); coverage carries the classification + loud surfaces;
 * summary is the at-a-glance numbers for the modal header.
 * clusterName is the resolved name used (Flux-path-derived or
 * override); the UI seeds its editable override field with this.
 */
export interface PreviewClusterResponse {
	clusterName: string;
	files: Record<string, string>;
	coverage: PreviewClusterCoverage;
	summary: PreviewClusterSummary;
}

/**
 * Export request body. Selection is the optional subset chosen in
 * the preview; an empty/undefined selection exports everything the
 * fresh discovery finds.
 */
export interface ExportClusterRequest {
	env?: string;
	clusterName?: string;
	repository: string;
	branch?: string;
	createPR?: boolean;
	prTitle?: string;
	prBody?: string;
	commitMessage?: string;
	selection?: CapturedItemIdentity[];
}

/**
 * Export response body. Mirrors ExportAddonResponse shape so the
 * console can render commit/PR metadata consistently across paths.
 */
export interface ExportClusterResponse {
	success: boolean;
	message: string;
	mode?: 'direct-push' | 'feature-branch-mr';
	branch?: string;
	commitSha?: string;
	prUrl?: string;
	prNumber?: number;
	filesCount?: number;
	files?: string[];
}

/**
 * Request to migrate releases to GitOps
 */
export interface MigrationRequest {
	releases: MigrationRelease[];
	repository: string;
	branch: string;
	basePath: string;
	createPR?: boolean;
	prTitle?: string;
}

/**
 * Single release to migrate
 */
export interface MigrationRelease {
	name: string;
	namespace: string;
	repoUrl: string;
	chartName?: string;
	chartVersion?: string;
	values?: Record<string, unknown>;
	category?: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
	success: boolean;
	message: string;
	filesCreated?: string[];
	commitSha?: string;
	prUrl?: string;
	prNumber?: number;
	errors?: string[];
}

/**
 * GitOps status for a cluster
 */
export interface GitOpsStatus {
	enabled: boolean;
	provider?: GitOpsToolType;
	repository?: string;
	branch?: string;
	path?: string;
	status?: string;
	version?: string;
	fluxVersion?: string; // Deprecated, use version
	providerStatus?: GitOpsEngineStatus;
}

/**
 * Display configuration for GitOps tools
 */
export const GITOPS_TOOL_CONFIG: Record<
	GitOpsToolType,
	{ label: string; icon: string; color: string }
> = {
	flux: {
		label: 'Flux CD',
		icon: '🔄',
		color: 'text-blue-400',
	},
	argocd: {
		label: 'Argo CD',
		icon: '🐙',
		color: 'text-orange-400',
	},
};

/**
 * Display configuration for Git providers
 */
export const GIT_PROVIDER_CONFIG: Record<
	GitProviderType,
	{ label: string; icon: string; url: string }
> = {
	github: {
		label: 'GitHub',
		icon: '🐙',
		url: 'https://github.com',
	},
	gitlab: {
		label: 'GitLab',
		icon: '🦊',
		url: 'https://gitlab.com',
	},
};

/**
 * Category display info
 */
export const CATEGORY_CONFIG: Record<string, { label: string; order: number }> = {
	infrastructure: {
		label: 'Infrastructure',
		order: 1,
	},
	apps: {
		label: 'Applications',
		order: 2,
	},
};

/**
 * Get category label
 */
export function getCategoryLabel(category?: string): string {
	if (!category) return 'Unknown';
	return CATEGORY_CONFIG[category]?.label || category;
}

/**
 * Sort releases by category and name
 */
export function sortReleases(releases: DiscoveredRelease[]): DiscoveredRelease[] {
	return [...releases].sort((a, b) => {
		const orderA = CATEGORY_CONFIG[a.category || 'apps']?.order || 99;
		const orderB = CATEGORY_CONFIG[b.category || 'apps']?.order || 99;
		if (orderA !== orderB) return orderA - orderB;
		return a.name.localeCompare(b.name);
	});
}
