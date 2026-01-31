/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { Button, Spinner } from '@/components/ui';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type { DiscoveredRelease, Repository, Branch, MigrationRelease } from '@/types/gitops';
import { getCategoryLabel, sortReleases } from '@/types/gitops';

interface MigrateAllModalProps {
	releases: DiscoveredRelease[];
	repositories: Repository[];
	clusterNamespace: string;
	clusterName: string;
	configuredRepository?: string; // owner/repo format - auto-select this if provided
	onClose: () => void;
	onSuccess: (result: { prUrl?: string }) => void;
}

export function MigrateAllModal({
	releases,
	repositories,
	clusterNamespace,
	clusterName,
	configuredRepository,
	onClose,
	onSuccess,
}: MigrateAllModalProps) {
	const { error: showError } = useToast();

	// Selection state - select releases that have repoUrl (matched or auto-detected)
	const [selected, setSelected] = useState<Set<string>>(
		new Set(releases.filter(r => r.addonDefinition || r.repoUrl).map(r => `${r.namespace}/${r.name}`))
	);

	// Form state - auto-select configured repository if available
	const [repository, setRepository] = useState(configuredRepository || '');
	const [branch, setBranch] = useState('main');
	const [basePath, setBasePath] = useState(`clusters/${clusterName}`);
	const [createPR, setCreatePR] = useState(true);

	// Update repository when configuredRepository becomes available
	useEffect(() => {
		if (configuredRepository && !repository) {
			setRepository(configuredRepository);
		}
	}, [configuredRepository, repository]);

	// Loading state
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loadingBranches, setLoadingBranches] = useState(false);
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

	// Load branches when repository changes
	useEffect(() => {
		if (!repository) {
			setBranches([]);
			return;
		}

		const loadBranches = async () => {
			setLoadingBranches(true);
			try {
				const [owner, repo] = repository.split('/');
				if (owner && repo) {
					const branchList = await gitopsApi.listBranches(owner, repo);
					setBranches(branchList);

					const defaultBranch = repositories.find(r => r.fullName === repository)?.defaultBranch;
					if (defaultBranch) {
						setBranch(defaultBranch);
					}
				}
			} catch (err) {
				console.warn('Failed to load branches:', err);
			} finally {
				setLoadingBranches(false);
			}
		};

		loadBranches();
	}, [repository, repositories]);

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
			const migrationReleases: MigrationRelease[] = selectedReleases.map(r => ({
				name: r.name,
				namespace: r.namespace,
				repoUrl: r.repoUrl || customRepoUrls[`${r.namespace}/${r.name}`] || '',
				chartName: r.chart,
				chartVersion: r.chartVersion,
				values: r.values,
				category: r.category,
			}));

			const result = await gitopsApi.migrate(clusterNamespace, clusterName, {
				releases: migrationReleases,
				repository,
				branch,
				basePath,
				createPR,
				prTitle: `Migrate ${selected.size} releases to GitOps`,
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
		<Modal isOpen onClose={onClose} size="xl">
			<ModalHeader>
				Export All Releases to GitOps
			</ModalHeader>

			<ModalBody>
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
									className="text-sm text-green-400 hover:text-green-300"
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
									<span className="ml-2 text-xs text-green-400">(GitOps configured)</span>
								)}
							</label>
							<select
								value={repository}
								onChange={(e) => setRepository(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
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
							<div className="relative">
								<select
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									disabled={loadingBranches || branches.length === 0}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
								>
									{branches.length === 0 ? (
										<option value={branch}>{branch}</option>
									) : (
										branches.map((b) => (
											<option key={b.name} value={b.name}>
												{b.name}
											</option>
										))
									)}
								</select>
								{loadingBranches && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										<Spinner size="sm" />
									</div>
								)}
							</div>
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
							placeholder="clusters/my-cluster"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
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
							className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
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
								// Only show as needing URL if no addonDefinition AND no auto-detected repoUrl
								const needsRepoUrl = !release.addonDefinition && !release.repoUrl;
								const hasRepoUrl = release.repoUrl || customRepoUrls[key];

								return (
									<div
										key={key}
										className={`p-3 ${isSelected ? 'bg-green-900/10' : 'hover:bg-neutral-800/50'}`}
									>
										<div className="flex items-center gap-3">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleRelease(release)}
												className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
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
													className={`w-full px-2 py-1 text-sm bg-neutral-800 border rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-green-500 ${hasRepoUrl ? 'border-neutral-700' : 'border-yellow-500/50'
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
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>
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
			</ModalFooter>
		</Modal>
	);
}

export default MigrateAllModal;
