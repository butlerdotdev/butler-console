/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spinner, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type {
	GitProviderConfig,
	DiscoveryResult,
	DiscoveredRelease,
	Repository,
} from '@/types/gitops';
import { sortReleases, GITOPS_TOOL_CONFIG } from '@/types/gitops';
import { GitProviderSetup } from './GitProviderSetup';
import { DiscoveredReleaseCard } from './DiscoveredReleaseCard';
import { ExportModal } from './ExportModal';
import { MigrateAllModal } from './MigrateAllModal';
import { EnableGitOpsModal } from './EnableGitOpsModal';

export function GitOpsTab() {
	const { namespace, name } = useParams<{ namespace: string; name: string }>();
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
	const [showMigrateAll, setShowMigrateAll] = useState(false);
	const [showEnableModal, setShowEnableModal] = useState(false);
	const [showDisableConfirm, setShowDisableConfirm] = useState(false);

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

	// Discover releases on cluster
	const discoverReleases = useCallback(async () => {
		if (!namespace || !name) return;

		setDiscovering(true);
		try {
			const result = await gitopsApi.discover(namespace, name);
			setDiscovery(result);
			setError(null);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to discover releases';
			setError(message);
			showError('Discovery Failed', message);
		} finally {
			setDiscovering(false);
		}
	}, [namespace, name, showError]);

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

	// Handle export success
	const handleExportSuccess = (result: { prUrl?: string; commitUrl?: string }) => {
		setExportRelease(null);
		if (result.prUrl) {
			success('Pull Request Created', 'A PR has been created for review');
		} else {
			success('Exported Successfully', 'Manifests have been committed to your repository');
		}
	};

	// Handle migrate all success
	const handleMigrateSuccess = (result: { prUrl?: string }) => {
		setShowMigrateAll(false);
		if (result.prUrl) {
			success('Migration PR Created', 'A PR has been created with all releases');
		} else {
			success('Migration Complete', 'All releases have been exported to GitOps');
		}
	};

	// Handle enable GitOps success
	const handleEnableSuccess = async () => {
		setShowEnableModal(false);
		success('GitOps Enabled', 'Flux has been installed on your cluster');
		// Refresh discovery to show the new GitOps engine status
		await discoverReleases();
	};

	// Handle disable GitOps
	const handleDisableGitOps = async () => {
		if (!namespace || !name) return;

		setDisabling(true);
		try {
			await gitopsApi.disable(namespace, name);
			success('GitOps Disabled', 'Flux has been removed from your cluster');
			setShowDisableConfirm(false);
			// Refresh discovery to update the status
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
				<Card className="p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
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
							<div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
								<svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
							</div>
							<div>
								<h3 className="text-lg font-medium text-neutral-100">
									GitOps Not Enabled
								</h3>
								<p className="text-neutral-400 mt-1">
									Install Flux CD to manage this cluster's configuration via Git
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
					{isGitOpsInstalled && (
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setShowMigrateAll(true)}
							disabled={allReleases.length === 0}
						>
							Export All to GitOps
						</Button>
					)}
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
								{allReleases.length} Helm releases found on this cluster
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
							<p className="text-neutral-400">No Helm releases found on this cluster</p>
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

			{/* Export Modal */}
			{exportRelease && (
				<ExportModal
					release={exportRelease}
					repositories={repositories}
					clusterNamespace={namespace!}
					clusterName={name!}
					configuredRepository={gitopsEngine?.repository}
					onClose={() => setExportRelease(null)}
					onSuccess={handleExportSuccess}
				/>
			)}

			{/* Migrate All Modal */}
			{showMigrateAll && (
				<MigrateAllModal
					releases={allReleases}
					repositories={repositories}
					clusterNamespace={namespace!}
					clusterName={name!}
					configuredRepository={gitopsEngine?.repository}
					onClose={() => setShowMigrateAll(false)}
					onSuccess={handleMigrateSuccess}
				/>
			)}

			{/* Enable GitOps Modal */}
			{showEnableModal && (
				<EnableGitOpsModal
					clusterNamespace={namespace!}
					clusterName={name!}
					repositories={repositories}
					onClose={() => setShowEnableModal(false)}
					onSuccess={handleEnableSuccess}
				/>
			)}

			{/* Disable GitOps Confirmation Modal */}
			{showDisableConfirm && (
				<DisableGitOpsModal
					clusterName={name!}
					disabling={disabling}
					onClose={() => setShowDisableConfirm(false)}
					onConfirm={handleDisableGitOps}
				/>
			)}
		</div>
	);
}

// Disable GitOps Confirmation Modal Component
interface DisableGitOpsModalProps {
	clusterName: string;
	disabling: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

function DisableGitOpsModal({ clusterName, disabling, onClose, onConfirm }: DisableGitOpsModalProps) {
	const [confirmText, setConfirmText] = useState('');
	const canConfirm = confirmText === clusterName;

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
						Disable GitOps?
					</h3>

					<p className="text-neutral-400 text-center mb-4">
						This will uninstall Flux from <span className="text-neutral-200 font-medium">{clusterName}</span> and
						remove all GitOps controllers. Your Git repository will not be affected.
					</p>

					{/* Warning Box */}
					<div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 mb-4">
						<p className="text-sm text-red-200">
							<strong>Warning:</strong> Any resources managed by Flux will no longer be
							automatically reconciled from Git.
						</p>
					</div>

					{/* Confirmation Input */}
					<div className="mb-4">
						<label className="block text-sm text-neutral-400 mb-2">
							Type <span className="text-neutral-200 font-mono">{clusterName}</span> to confirm:
						</label>
						<input
							type="text"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder={clusterName}
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

export default GitOpsTab;
