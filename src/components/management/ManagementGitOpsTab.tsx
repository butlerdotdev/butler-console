/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Spinner, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type {
	GitProviderConfig,
	DiscoveryResult,
	DiscoveredRelease,
	Repository,
} from '@/types/gitops';
import { sortReleases, GITOPS_TOOL_CONFIG, getCategoryLabel } from '@/types/gitops';
import { GitProviderSetup } from '@/components/clusters/gitops/GitProviderSetup';
import { DiscoveredReleaseCard } from '@/components/clusters/gitops/DiscoveredReleaseCard';

// Available extra components for Flux
const FLUX_EXTRA_COMPONENTS = [
	{
		name: 'image-reflector-controller',
		label: 'Image Reflector Controller',
		description: 'Watches container registries for new image tags',
	},
	{
		name: 'image-automation-controller',
		label: 'Image Automation Controller',
		description: 'Automatically commits image updates to Git',
	},
];

export function ManagementGitOpsTab() {
	const { success, error: showError } = useToast();

	// State
	const [gitConfig, setGitConfig] = useState<GitProviderConfig | null>(null);
	const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
	const [repositories, setRepositories] = useState<Repository[]>([]);
	const [loading, setLoading] = useState(true);
	const [discovering, setDiscovering] = useState(false);
	const [disabling, setDisabling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Modal state
	const [exportRelease, setExportRelease] = useState<DiscoveredRelease | null>(null);
	const [showEnableModal, setShowEnableModal] = useState(false);
	const [showDisableConfirm, setShowDisableConfirm] = useState(false);
	const [showMigrateAll, setShowMigrateAll] = useState(false);

	// Load Git provider config
	const loadGitConfig = useCallback(async () => {
		try {
			const config = await gitopsApi.getConfig();
			setGitConfig(config);

			// If configured, also load repositories
			if (config.configured) {
				try {
					const repos = await gitopsApi.listRepositories();
					setRepositories(repos);
				} catch (err) {
					console.warn('Failed to load repositories:', err);
				}
			}
		} catch (err) {
			console.error('Failed to load GitOps config:', err);
		}
	}, []);

	// Discover releases on management cluster
	const discoverReleases = useCallback(async () => {
		setDiscovering(true);
		try {
			const result = await gitopsApi.discoverManagement();
			setDiscovery(result);
			setError(null);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to discover releases';
			setError(message);
			showError('Discovery Failed', message);
		} finally {
			setDiscovering(false);
		}
	}, [showError]);

	// Initial load
	useEffect(() => {
		const load = async () => {
			setLoading(true);
			await loadGitConfig();
			await discoverReleases();
			setLoading(false);
		};
		load();
	}, [loadGitConfig, discoverReleases]);

	// Handle Git provider configured
	const handleGitConfigured = async () => {
		await loadGitConfig();
		success('Git Provider Connected', 'You can now export releases to your repository');
	};

	// Handle enable GitOps success
	const handleEnableSuccess = async () => {
		setShowEnableModal(false);
		success('GitOps Enabled', 'Flux has been installed on the management cluster');
		await discoverReleases();
	};

	// Handle disable GitOps
	const handleDisableGitOps = async () => {
		setDisabling(true);
		try {
			await gitopsApi.disableManagement();
			success('GitOps Disabled', 'Flux has been removed from the management cluster');
			setShowDisableConfirm(false);
			await discoverReleases();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to disable GitOps';
			showError('Disable Failed', message);
		} finally {
			setDisabling(false);
		}
	};

	// Loading state
	if (loading) {
		return (
			<div className="flex items-center justify-center p-12">
				<Spinner size="lg" />
				<span className="ml-3 text-neutral-400">Loading GitOps configuration...</span>
			</div>
		);
	}

	// No Git provider configured
	if (!gitConfig?.configured) {
		return (
			<GitProviderSetup onConfigured={handleGitConfigured} />
		);
	}

	// Error state
	if (error && !discovery) {
		return (
			<Card className="p-6">
				<div className="text-center">
					<p className="text-red-400 mb-4">{error}</p>
					<Button variant="secondary" onClick={discoverReleases}>
						Retry Discovery
					</Button>
				</div>
			</Card>
		);
	}

	const allReleases = [
		...sortReleases(discovery?.matched || []),
		...sortReleases(discovery?.unmatched || []),
	];

	// Only count releases that are unmatched AND don't have a repoUrl
	const releasesNeedingUrl = (discovery?.unmatched || []).filter(r => !r.repoUrl);
	const hasReleasesNeedingUrl = releasesNeedingUrl.length > 0;
	const gitopsEngine = discovery?.gitopsEngine;
	const isGitOpsInstalled = gitopsEngine?.installed ?? false;

	return (
		<div className="space-y-6">
			{/* GitOps Engine Status Banner - Show when installed */}
			{isGitOpsInstalled && (
				<Card className="p-4 bg-gradient-to-r from-violet-900/20 to-purple-900/20 border-violet-500/30">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<span className="text-2xl">
								{GITOPS_TOOL_CONFIG[gitopsEngine?.provider || 'flux'].icon}
							</span>
							<div>
								<h3 className="text-neutral-100 font-medium">
									{GITOPS_TOOL_CONFIG[gitopsEngine?.provider || 'flux'].label} Installed
								</h3>
								<p className="text-sm text-neutral-400">
									{gitopsEngine?.version && `Version ${gitopsEngine.version} • `}
									{gitopsEngine?.components?.length || 0} components running
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${gitopsEngine?.ready
								? 'bg-green-500/10 text-green-400 border border-green-500/30'
								: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
								}`}>
								{gitopsEngine?.ready ? 'Ready' : 'Degraded'}
							</span>
							<Button
								variant="danger"
								size="sm"
								onClick={() => setShowDisableConfirm(true)}
							>
								Disable GitOps
							</Button>
						</div>
					</div>
				</Card>
			)}

			{/* Enable GitOps Banner - Show when NOT installed */}
			{!isGitOpsInstalled && (
				<Card className="p-6 border-dashed border-2 border-neutral-700 bg-neutral-900/50">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
								<svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
							</div>
							<div>
								<h3 className="text-lg font-medium text-neutral-100">
									GitOps Not Enabled
								</h3>
								<p className="text-neutral-400 mt-1">
									Install Flux CD to manage the management cluster's configuration via Git
								</p>
							</div>
						</div>
						<Button onClick={() => setShowEnableModal(true)}>
							Enable GitOps
						</Button>
					</div>

					{/* Benefits list */}
					<div className="mt-6 pt-6 border-t border-neutral-800">
						<h4 className="text-sm font-medium text-neutral-300 mb-3">Benefits of GitOps</h4>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="flex items-start gap-2">
								<svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
								<div>
									<p className="text-neutral-200 text-sm font-medium">Version Control</p>
									<p className="text-neutral-500 text-xs">Track all changes in Git</p>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
								<div>
									<p className="text-neutral-200 text-sm font-medium">Auto-sync</p>
									<p className="text-neutral-500 text-xs">Automatic reconciliation</p>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
								<div>
									<p className="text-neutral-200 text-sm font-medium">Audit Trail</p>
									<p className="text-neutral-500 text-xs">Complete change history</p>
								</div>
							</div>
						</div>
					</div>
				</Card>
			)}

			{/* Git Provider Status */}
			<Card className="p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
							<svg className="w-5 h-5 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
								<path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
							</svg>
						</div>
						<div>
							<p className="text-neutral-200 font-medium">
								Connected to {gitConfig.type === 'github' ? 'GitHub' : 'GitLab'}
							</p>
							<p className="text-sm text-neutral-500">
								{gitConfig.username}
								{gitConfig.organization && ` • ${gitConfig.organization}`}
							</p>
						</div>
					</div>
					<Button
						variant="secondary"
						size="sm"
						onClick={() => setShowMigrateAll(true)}
						disabled={discovering || allReleases.length === 0}
					>
						Export All to GitOps
					</Button>
				</div>
			</Card>

			{/* Discovery Section - Only show when GitOps is installed */}
			{isGitOpsInstalled && (
				<>
					{/* Discovery Header */}
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-medium text-neutral-100">
								Discovered Releases
							</h2>
							<p className="text-sm text-neutral-400 mt-1">
								{allReleases.length} Helm releases found on the management cluster
							</p>
						</div>
						<Button
							variant="secondary"
							size="sm"
							onClick={discoverReleases}
							disabled={discovering}
						>
							{discovering ? (
								<>
									<Spinner size="sm" />
									<span className="ml-2">Discovering...</span>
								</>
							) : (
								'Refresh'
							)}
						</Button>
					</div>

					{/* Unmatched Warning - only show if releases are missing repoUrl */}
					{hasReleasesNeedingUrl && (
						<Card className="p-4 border-yellow-500/30 bg-yellow-900/10">
							<div className="flex items-start gap-3">
								<svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
								<div>
									<p className="text-yellow-200 font-medium">
										{releasesNeedingUrl.length} release{releasesNeedingUrl.length !== 1 ? 's' : ''} need repository URL
									</p>
									<p className="text-sm text-yellow-300/70 mt-1">
										These releases don't match any AddonDefinition and couldn't be auto-detected.
										You'll need to provide the Helm repository URL when exporting.
									</p>
								</div>
							</div>
						</Card>
					)}

					{/* Releases Grid */}
					{allReleases.length === 0 ? (
						<Card className="p-8 text-center">
							<p className="text-neutral-400">No Helm releases found on the management cluster</p>
						</Card>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{allReleases.map((release) => (
								<DiscoveredReleaseCard
									key={`${release.namespace}/${release.name}`}
									release={release}
									onExport={() => setExportRelease(release)}
								/>
							))}
						</div>
					)}
				</>
			)}

			{/* Enable GitOps Modal */}
			{showEnableModal && (
				<EnableManagementGitOpsModal
					repositories={repositories}
					onClose={() => setShowEnableModal(false)}
					onSuccess={handleEnableSuccess}
				/>
			)}

			{/* Disable GitOps Confirmation Modal */}
			{showDisableConfirm && (
				<DisableManagementGitOpsModal
					disabling={disabling}
					onClose={() => setShowDisableConfirm(false)}
					onConfirm={handleDisableGitOps}
				/>
			)}

			{/* Export Modal */}
			{exportRelease && (
				<ManagementExportModal
					release={exportRelease}
					repositories={repositories}
					configuredRepository={gitopsEngine?.repository}
					onClose={() => setExportRelease(null)}
					onSuccess={(result) => {
						setExportRelease(null);
						if (result.prUrl) {
							success('Pull Request Created', 'A PR has been created for review');
						} else {
							success('Exported Successfully', 'Manifests have been committed to your repository');
						}
					}}
				/>
			)}

			{/* Migrate All Modal */}
			{showMigrateAll && (
				<ManagementMigrateAllModal
					releases={allReleases}
					repositories={repositories}
					configuredRepository={gitopsEngine?.repository}
					onClose={() => setShowMigrateAll(false)}
					onSuccess={(result) => {
						setShowMigrateAll(false);
						discoverReleases();
						if (result.prUrl) {
							success('Pull Request Created', 'A PR has been created for review');
						} else {
							success('Exported Successfully', 'Manifests have been committed to your repository');
						}
					}}
				/>
			)}
		</div>
	);
}

// Enable Management GitOps Modal Component
interface EnableManagementGitOpsModalProps {
	repositories: Repository[];
	onClose: () => void;
	onSuccess: () => void;
}

function EnableManagementGitOpsModal({
	repositories,
	onClose,
	onSuccess,
}: EnableManagementGitOpsModalProps) {
	const { error: showError } = useToast();

	// Form state
	const [repository, setRepository] = useState('');
	const [branch, setBranch] = useState('main');
	const [path, setPath] = useState('clusters/management');
	const [isPrivate, setIsPrivate] = useState(true);
	const [componentsExtra, setComponentsExtra] = useState<string[]>(
		FLUX_EXTRA_COMPONENTS.map(c => c.name)
	);

	// Loading state
	const [enabling, setEnabling] = useState(false);

	// Toggle extra component
	const toggleComponent = (componentName: string) => {
		setComponentsExtra(prev =>
			prev.includes(componentName)
				? prev.filter(c => c !== componentName)
				: [...prev, componentName]
		);
	};

	// Handle enable
	const handleEnable = async () => {
		if (!repository) {
			showError('Repository Required', 'Please select a repository');
			return;
		}

		setEnabling(true);
		try {
			const result = await gitopsApi.enableManagement({
				provider: 'flux',
				repository,
				branch,
				path,
				private: isPrivate,
				componentsExtra,
			});

			if (result && result.success !== false) {
				onSuccess();
			} else {
				showError('Enable Failed', result?.message || 'Unknown error');
			}
		} catch (err) {
			console.error('Enable GitOps error:', err);
			const message = err instanceof Error ? err.message : 'Failed to enable GitOps';
			showError('Enable Failed', message);
		} finally {
			setEnabling(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<h3 className="text-lg font-semibold text-neutral-100 mb-4">
						Enable GitOps on Management Cluster
					</h3>

					<div className="space-y-4">
						{/* Repository Selection */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Target Repository
							</label>
							<select
								value={repository}
								onChange={(e) => setRepository(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							>
								<option value="">Select a repository...</option>
								{repositories.map((repo) => (
									<option key={repo.fullName} value={repo.fullName}>
										{repo.fullName} {repo.private ? '(private)' : ''}
									</option>
								))}
							</select>
						</div>

						{/* Branch and Path */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Branch
								</label>
								<input
									type="text"
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Path
								</label>
								<input
									type="text"
									value={path}
									onChange={(e) => setPath(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								/>
							</div>
						</div>

						{/* Private repo option */}
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={isPrivate}
								onChange={(e) => setIsPrivate(e.target.checked)}
								className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
							/>
							<span className="text-neutral-200">Private repository</span>
						</label>

						{/* Extra Components */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-2">
								Additional Components
							</label>
							<div className="space-y-2">
								{FLUX_EXTRA_COMPONENTS.map((component) => {
									const isChecked = componentsExtra.includes(component.name);
									return (
										<label
											key={component.name}
											className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked
												? 'border-violet-500/50 bg-violet-500/5'
												: 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
												}`}
										>
											<input
												type="checkbox"
												checked={isChecked}
												onChange={() => toggleComponent(component.name)}
												className="w-4 h-4 mt-0.5 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
											/>
											<div>
												<span className="text-neutral-200 font-medium">
													{component.label}
												</span>
												<p className="text-xs text-neutral-500 mt-0.5">
													{component.description}
												</p>
											</div>
										</label>
									);
								})}
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-3 mt-6">
						<Button
							variant="secondary"
							className="flex-1"
							onClick={onClose}
							disabled={enabling}
						>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onClick={handleEnable}
							disabled={enabling || !repository}
						>
							{enabling ? (
								<>
									<Spinner size="sm" />
									<span className="ml-2">Installing Flux...</span>
								</>
							) : (
								'Enable GitOps'
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// Disable Management GitOps Confirmation Modal
interface DisableManagementGitOpsModalProps {
	disabling: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

function DisableManagementGitOpsModal({ disabling, onClose, onConfirm }: DisableManagementGitOpsModalProps) {
	const [confirmText, setConfirmText] = useState('');
	const canConfirm = confirmText === 'management';

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-md w-full mx-4">
				<div className="p-6">
					{/* Warning Icon */}
					<div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10">
						<svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>

					<h3 className="text-lg font-semibold text-neutral-100 text-center mb-2">
						Disable GitOps on Management Cluster?
					</h3>

					<p className="text-neutral-400 text-center mb-4">
						This will uninstall Flux from the <span className="text-neutral-200 font-medium">management cluster</span> and
						remove all GitOps controllers. Your Git repository will not be affected.
					</p>

					{/* Warning Box */}
					<div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 mb-4">
						<p className="text-sm text-red-200">
							<strong>Warning:</strong> Any resources managed by Flux will no longer be
							automatically reconciled from Git. This includes Butler platform components
							if they are managed via GitOps.
						</p>
					</div>

					{/* Confirmation Input */}
					<div className="mb-4">
						<label className="block text-sm text-neutral-400 mb-2">
							Type <span className="text-neutral-200 font-mono">management</span> to confirm:
						</label>
						<input
							type="text"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder="management"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
							autoFocus
						/>
					</div>

					{/* Actions */}
					<div className="flex gap-3">
						<Button
							variant="secondary"
							className="flex-1"
							onClick={onClose}
							disabled={disabling}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							className="flex-1"
							onClick={onConfirm}
							disabled={!canConfirm || disabling}
						>
							{disabling ? (
								<>
									<Spinner size="sm" />
									<span className="ml-2">Disabling...</span>
								</>
							) : (
								'Disable GitOps'
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// Management Export Modal Component
interface ManagementExportModalProps {
	release: DiscoveredRelease;
	repositories: Repository[];
	configuredRepository?: string; // owner/repo format - auto-select this if provided
	onClose: () => void;
	onSuccess: (result: { prUrl?: string; commitUrl?: string }) => void;
}

function ManagementExportModal({
	release,
	repositories,
	configuredRepository,
	onClose,
	onSuccess,
}: ManagementExportModalProps) {
	const { error: showError } = useToast();

	// Form state - auto-select configured repository if available
	const [repository, setRepository] = useState(configuredRepository || '');
	const [branch, setBranch] = useState('main');
	const [path, setPath] = useState(`clusters/management/${release.category || 'apps'}`);
	const [createPR, setCreatePR] = useState(true);
	const [prTitle, setPrTitle] = useState(`Add ${release.name} to GitOps`);
	const [helmRepoUrl, setHelmRepoUrl] = useState(release.repoUrl || '');

	// Update repository when configuredRepository becomes available
	useEffect(() => {
		if (configuredRepository && !repository) {
			setRepository(configuredRepository);
		}
	}, [configuredRepository, repository]);

	// Loading state
	const [exporting, setExporting] = useState(false);

	// Preview state
	const [preview, setPreview] = useState<Record<string, string> | null>(null);
	const [loadingPreview, setLoadingPreview] = useState(false);

	// Only block export if no addonDefinition AND no URL provided
	const missingRepoUrl = !release.addonDefinition && !helmRepoUrl;

	// Toggle preview
	const togglePreview = async () => {
		if (preview) {
			setPreview(null);
			return;
		}

		if (!repository) return;

		setLoadingPreview(true);
		try {
			const result = await gitopsApi.previewManifests({
				addonName: release.name,
				repository,
				targetPath: path,
				values: release.values,
			});
			setPreview(result);
		} catch (err) {
			console.warn('Failed to load preview:', err);
		} finally {
			setLoadingPreview(false);
		}
	};

	// Handle export
	const handleExport = async () => {
		if (!repository) {
			showError('Repository Required', 'Please select a repository');
			return;
		}

		if (missingRepoUrl) {
			showError('Helm Repository Required', 'Please provide the Helm repository URL');
			return;
		}

		setExporting(true);
		try {
			const result = await gitopsApi.exportManagementRelease({
				releaseName: release.name,
				releaseNamespace: release.namespace,
				repository,
				branch,
				path,
				createPR,
				prTitle: createPR ? prTitle : undefined,
				helmRepoUrl: !release.addonDefinition ? helmRepoUrl : undefined,
			});

			onSuccess(result);
		} catch (err) {
			console.error('Export error:', err);
			const message = err instanceof Error ? err.message : 'Failed to export';
			showError('Export Failed', message);
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<h3 className="text-lg font-semibold text-neutral-100 mb-4">
						Export {release.name}
					</h3>

					<div className="space-y-4">
						{/* Release Info */}
						<div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-neutral-200 font-medium">{release.name}</p>
									<p className="text-sm text-neutral-500">
										{release.namespace} • {release.chart}:{release.chartVersion}
									</p>
								</div>
								<span className={`px-2 py-1 text-xs rounded ${release.category === 'infrastructure'
									? 'bg-blue-500/10 text-blue-400'
									: 'bg-purple-500/10 text-purple-400'
									}`}>
									{release.category || 'apps'}
								</span>
							</div>
						</div>

						{/* Helm Repo URL (if needed) */}
						{!release.addonDefinition && (
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Helm Repository URL {!helmRepoUrl && <span className="text-red-400">*</span>}
								</label>
								<input
									type="text"
									value={helmRepoUrl}
									onChange={(e) => setHelmRepoUrl(e.target.value)}
									placeholder="https://charts.example.com"
									className={`w-full px-3 py-2 bg-neutral-800 border rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500 ${!helmRepoUrl ? 'border-yellow-500/50' : 'border-neutral-700'
										}`}
								/>
								{!helmRepoUrl ? (
									<p className="text-xs text-yellow-400 mt-1">
										⚠️ Please provide the Helm repository URL
									</p>
								) : release.repoUrl ? (
									<p className="text-xs text-neutral-500 mt-1">
										Auto-detected from chart metadata
									</p>
								) : null}
							</div>
						)}

						{/* Repository Selection */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Target Repository
								{configuredRepository && (
									<span className="ml-2 text-xs text-violet-400">(GitOps configured)</span>
								)}
							</label>
							<select
								value={repository}
								onChange={(e) => setRepository(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							>
								<option value="">Select a repository...</option>
								{repositories.map((repo) => (
									<option key={repo.fullName} value={repo.fullName}>
										{repo.fullName} {repo.fullName === configuredRepository ? '✓' : ''} {repo.private ? '(private)' : ''}
									</option>
								))}
							</select>
						</div>

						{/* Branch and Path */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Branch
								</label>
								<input
									type="text"
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Path
								</label>
								<input
									type="text"
									value={path}
									onChange={(e) => setPath(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								/>
							</div>
						</div>

						{/* Create PR option */}
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={createPR}
								onChange={(e) => setCreatePR(e.target.checked)}
								className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
							/>
							<span className="text-neutral-200">Create Pull Request</span>
						</label>

						{/* PR Title (if creating PR) */}
						{createPR && (
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									PR Title
								</label>
								<input
									type="text"
									value={prTitle}
									onChange={(e) => setPrTitle(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								/>
							</div>
						)}

						{/* Preview Button */}
						{repository && (
							<div className="pt-2">
								<button
									onClick={togglePreview}
									disabled={loadingPreview}
									className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-2"
								>
									{loadingPreview ? (
										<>
											<Spinner size="sm" />
											Loading preview...
										</>
									) : preview ? (
										<>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
											</svg>
											Hide generated manifests
										</>
									) : (
										<>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											</svg>
											Preview generated manifests
										</>
									)}
								</button>
							</div>
						)}

						{/* Preview Content */}
						{preview && (
							<div className="border border-neutral-700 rounded-lg overflow-hidden">
								<div className="bg-neutral-800 px-3 py-2 text-sm text-neutral-400 border-b border-neutral-700">
									Generated Files
								</div>
								<div className="max-h-64 overflow-y-auto">
									{Object.entries(preview).map(([filename, content]) => (
										<details key={filename} className="border-b border-neutral-800 last:border-0">
											<summary className="px-3 py-2 text-sm text-neutral-300 cursor-pointer hover:bg-neutral-800/50 flex items-center gap-2">
												<svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
												</svg>
												{filename}
											</summary>
											<pre className="px-3 py-2 bg-neutral-900 text-xs text-neutral-400 overflow-x-auto">
												{content}
											</pre>
										</details>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="flex gap-3 mt-6">
						<Button
							variant="secondary"
							className="flex-1"
							onClick={onClose}
							disabled={exporting}
						>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onClick={handleExport}
							disabled={exporting || !repository || missingRepoUrl}
						>
							{exporting ? (
								<>
									<Spinner size="sm" />
									<span className="ml-2">Exporting...</span>
								</>
							) : (
								'Export'
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// Management Migrate All Modal Component
interface ManagementMigrateAllModalProps {
	releases: DiscoveredRelease[];
	repositories: Repository[];
	configuredRepository?: string;
	onClose: () => void;
	onSuccess: (result: { prUrl?: string }) => void;
}

function ManagementMigrateAllModal({
	releases,
	repositories,
	configuredRepository,
	onClose,
	onSuccess,
}: ManagementMigrateAllModalProps) {
	const { error: showError } = useToast();

	// Selection state - select releases that have repoUrl (matched or auto-detected)
	const [selected, setSelected] = useState<Set<string>>(
		new Set(releases.filter(r => r.addonDefinition || r.repoUrl).map(r => `${r.namespace}/${r.name}`))
	);

	// Form state - auto-select configured repository if available
	const [repository, setRepository] = useState(configuredRepository || '');
	const [branch, setBranch] = useState('main');
	const [basePath, setBasePath] = useState('clusters/management');
	const [createPR, setCreatePR] = useState(true);

	// Update repository when configuredRepository becomes available
	useEffect(() => {
		if (configuredRepository && !repository) {
			setRepository(configuredRepository);
		}
	}, [configuredRepository, repository]);

	// Loading state
	const [migrating, setMigrating] = useState(false);

	// Unmatched releases that need repo URL (user-provided overrides)
	const [customRepoUrls, setCustomRepoUrls] = useState<Record<string, string>>({});

	// Sort releases
	const sortedReleases = useMemo(() => sortReleases(releases), [releases]);

	// Check if all selected releases have required info
	const selectedReleases = useMemo(() => {
		return sortedReleases.filter(r => selected.has(`${r.namespace}/${r.name}`));
	}, [sortedReleases, selected]);

	// Only count as "needing URL" if no addonDefinition AND no repoUrl AND no custom URL provided
	const unmatchedSelected = useMemo(() => {
		return selectedReleases.filter(r =>
			!r.addonDefinition &&
			!r.repoUrl &&
			!customRepoUrls[`${r.namespace}/${r.name}`]
		);
	}, [selectedReleases, customRepoUrls]);

	const canMigrate = repository && selected.size > 0 && unmatchedSelected.length === 0;

	// Toggle selection
	const toggleRelease = (release: DiscoveredRelease) => {
		const key = `${release.namespace}/${release.name}`;
		const newSelected = new Set(selected);
		if (newSelected.has(key)) {
			newSelected.delete(key);
		} else {
			newSelected.add(key);
		}
		setSelected(newSelected);
	};

	// Select all / none
	const selectAll = () => {
		setSelected(new Set(sortedReleases.map(r => `${r.namespace}/${r.name}`)));
	};

	const selectNone = () => {
		setSelected(new Set());
	};

	// Handle migration
	const handleMigrate = async () => {
		if (!canMigrate) return;

		setMigrating(true);
		try {
			const migrationReleases = selectedReleases.map(r => ({
				name: r.name,
				namespace: r.namespace,
				repoUrl: r.repoUrl || customRepoUrls[`${r.namespace}/${r.name}`] || '',
				chartName: r.chart,
				chartVersion: r.chartVersion,
				values: r.values,
				category: r.category,
			}));

			const result = await gitopsApi.migrateManagement({
				releases: migrationReleases,
				repository,
				branch,
				basePath,
				createPR,
				prTitle: `Migrate ${selected.size} management cluster releases to GitOps`,
			});

			if (result.success) {
				onSuccess({ prUrl: result.prUrl });
			} else {
				showError('Migration Failed', result.message);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to migrate';
			showError('Migration Failed', message);
		} finally {
			setMigrating(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<h3 className="text-lg font-semibold text-neutral-100 mb-4">
						Export All Releases to GitOps
					</h3>

					<div className="space-y-4">
						{/* Summary */}
						<div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
							<div className="flex items-center justify-between">
								<p className="text-neutral-200">
									<span className="font-medium">{selected.size}</span> of{' '}
									<span className="font-medium">{releases.length}</span> releases selected
								</p>
								<div className="flex gap-2">
									<button
										onClick={selectAll}
										className="text-sm text-violet-400 hover:text-violet-300"
									>
										Select All
									</button>
									<span className="text-neutral-600">|</span>
									<button
										onClick={selectNone}
										className="text-sm text-neutral-400 hover:text-neutral-300"
									>
										Select None
									</button>
								</div>
							</div>
						</div>

						{/* Repository Selection */}
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2">
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Target Repository
									{configuredRepository && (
										<span className="ml-2 text-xs text-violet-400">(GitOps configured)</span>
									)}
								</label>
								<select
									value={repository}
									onChange={(e) => setRepository(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								>
									<option value="">Select a repository...</option>
									{repositories.map((repo) => (
										<option key={repo.fullName} value={repo.fullName}>
											{repo.fullName} {repo.fullName === configuredRepository ? '✓' : ''} {repo.private ? '(private)' : ''}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									Branch
								</label>
								<input
									type="text"
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
								/>
							</div>
						</div>

						{/* Base Path */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Base Path
							</label>
							<input
								type="text"
								value={basePath}
								onChange={(e) => setBasePath(e.target.value)}
								placeholder="clusters/management"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							/>
							<p className="text-xs text-neutral-500 mt-1">
								Releases will be organized as: {basePath}/infrastructure/[addon] and {basePath}/apps/[addon]
							</p>
						</div>

						{/* Create PR option */}
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={createPR}
								onChange={(e) => setCreatePR(e.target.checked)}
								className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
							/>
							<div>
								<span className="text-neutral-200">Create Pull Request</span>
								<p className="text-xs text-neutral-500">
									Create a PR for review instead of committing directly
								</p>
							</div>
						</label>

						{/* Releases List */}
						<div className="border border-neutral-700 rounded-lg overflow-hidden">
							<div className="bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-700">
								Select Releases to Export
							</div>
							<div className="max-h-64 overflow-y-auto divide-y divide-neutral-800">
								{sortedReleases.map((release) => {
									const key = `${release.namespace}/${release.name}`;
									const isSelected = selected.has(key);
									const needsRepoUrl = !release.addonDefinition && !release.repoUrl;
									const hasRepoUrl = release.repoUrl || customRepoUrls[key];

									return (
										<div
											key={key}
											className={`p-3 ${isSelected ? 'bg-violet-900/10' : 'hover:bg-neutral-800/50'}`}
										>
											<div className="flex items-center gap-3">
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => toggleRelease(release)}
													className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
												/>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="text-neutral-200 font-medium truncate">
															{release.name}
														</span>
														{release.platform && (
															<span className="px-1.5 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded">
																Platform
															</span>
														)}
														<span className="px-1.5 py-0.5 text-xs bg-neutral-700 text-neutral-400 rounded">
															{getCategoryLabel(release.category)}
														</span>
													</div>
													<p className="text-xs text-neutral-500 mt-0.5">
														{release.namespace} • {release.chart}:{release.chartVersion}
														{release.repoUrl && !release.addonDefinition && (
															<span className="ml-2 text-neutral-600">• {release.repoUrl}</span>
														)}
													</p>
												</div>
												{needsRepoUrl && !hasRepoUrl && isSelected && (
													<span className="text-yellow-400 text-xs">
														Needs repo URL
													</span>
												)}
											</div>

											{/* Repo URL input for unmatched releases without auto-detected URL */}
											{needsRepoUrl && isSelected && (
												<div className="mt-2 pl-7">
													<input
														type="url"
														value={customRepoUrls[key] || ''}
														onChange={(e) => setCustomRepoUrls({ ...customRepoUrls, [key]: e.target.value })}
														placeholder="Enter Helm repository URL..."
														className={`w-full px-2 py-1 text-sm bg-neutral-800 border rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500 ${hasRepoUrl ? 'border-neutral-700' : 'border-yellow-500/50'
															}`}
													/>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Validation Warning */}
						{unmatchedSelected.length > 0 && (
							<div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-500/30">
								<div className="flex items-start gap-2">
									<svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<div>
										<p className="text-yellow-200 font-medium text-sm">
											{unmatchedSelected.length} selected release{unmatchedSelected.length > 1 ? 's' : ''} need Helm repository URL
										</p>
										<p className="text-yellow-300/70 text-xs mt-1">
											{unmatchedSelected.map(r => r.name).join(', ')}
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-2">
							<Button
								variant="secondary"
								onClick={onClose}
								disabled={migrating}
							>
								Cancel
							</Button>
							<Button
								onClick={handleMigrate}
								disabled={migrating || !canMigrate}
							>
								{migrating ? (
									<>
										<Spinner size="sm" />
										<span className="ml-2">Exporting {selected.size} releases...</span>
									</>
								) : createPR ? (
									`Create PR with ${selected.size} releases`
								) : (
									`Export ${selected.size} releases`
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ManagementGitOpsTab;
