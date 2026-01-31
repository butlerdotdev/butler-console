/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Button, Spinner } from '@/components/ui';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type { DiscoveredRelease, Repository, Branch } from '@/types/gitops';

interface ExportModalProps {
	release: DiscoveredRelease;
	repositories: Repository[];
	clusterNamespace: string;
	clusterName: string;
	configuredRepository?: string;
	onClose: () => void;
	onSuccess: (result: { prUrl?: string; commitUrl?: string }) => void;
}

export function ExportModal({
	release,
	repositories,
	clusterNamespace,
	clusterName,
	onClose,
	onSuccess,
}: ExportModalProps) {
	const { error: showError } = useToast();

	// Form state
	const [repository, setRepository] = useState('');
	const [branch, setBranch] = useState('main');
	// Generate path based on addon type (platform = infrastructure, otherwise apps)
	const defaultPath = release.platform
		? `clusters/${clusterName}/infrastructure/${release.name}`
		: `clusters/${clusterName}/apps/${release.name}`;
	const [path, setPath] = useState(defaultPath);
	const [createPR, setCreatePR] = useState(true);
	const [customRepoUrl, setCustomRepoUrl] = useState(release.repoUrl || '');

	// Loading state
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loadingBranches, setLoadingBranches] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [preview, setPreview] = useState<Record<string, string> | null>(null);
	const [loadingPreview, setLoadingPreview] = useState(false);

	const needsRepoUrl = !release.addonDefinition && !customRepoUrl;

	// Update path when release changes
	useEffect(() => {
		const newPath = release.platform
			? `clusters/${clusterName}/infrastructure/${release.name}`
			: `clusters/${clusterName}/apps/${release.name}`;
		setPath(newPath);
	}, [release, clusterName]);

	// Auto-select first repository when available
	useEffect(() => {
		if (repositories.length > 0 && !repository) {
			setRepository(repositories[0].fullName);
		}
	}, [repositories, repository]);

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

					// Set default branch if available
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

	// Toggle preview
	const togglePreview = async () => {
		// If preview is shown, hide it
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

		if (needsRepoUrl) {
			showError('Helm Repository URL Required', 'This release needs a Helm repository URL');
			return;
		}

		setExporting(true);
		try {
			const result = await gitopsApi.exportAddon(clusterNamespace, clusterName, {
				addonName: release.name,
				repository,
				branch,
				targetPath: path,
				values: release.values,
				createPR,
				prTitle: `Add ${release.name} addon`,
				prBody: `This PR adds the ${release.name} addon (${release.chart}:${release.chartVersion}) to the cluster.\n\nExported via Butler Console.`,
			});

			if (result.success) {
				onSuccess({
					prUrl: result.prUrl,
					commitUrl: result.commitUrl,
				});
			} else {
				showError('Export Failed', result.message);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to export';
			showError('Export Failed', message);
		} finally {
			setExporting(false);
		}
	};

	return (
		<Modal isOpen onClose={onClose} size="lg">
			<ModalHeader>
				Export {release.name} to GitOps
			</ModalHeader>

			<ModalBody>
				<div className="space-y-4">
					{/* Release Info */}
					<div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-neutral-200 font-medium">{release.name}</p>
								<p className="text-sm text-neutral-500">
									{release.chart}:{release.chartVersion} in {release.namespace}
								</p>
							</div>
							<span className={`px-2 py-1 text-xs rounded ${release.status === 'deployed'
								? 'bg-green-500/10 text-green-400'
								: 'bg-yellow-500/10 text-yellow-400'
								}`}>
								{release.status}
							</span>
						</div>
					</div>

					{/* Repository Selection */}
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">
							Target Repository
						</label>
						<select
							value={repository}
							onChange={(e) => setRepository(e.target.value)}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						>
							<option value="">Select a repository...</option>
							{repositories.map((repo) => (
								<option key={repo.fullName} value={repo.fullName}>
									{repo.fullName}
								</option>
							))}
						</select>
					</div>

					{/* Branch Selection */}
					<div className="grid grid-cols-2 gap-4">
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

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Path
							</label>
							<input
								type="text"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="clusters/my-cluster"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>

					{/* Helm Repo URL for unmatched releases */}
					{!release.addonDefinition && (
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Helm Repository URL
								<span className="text-red-400 ml-1">*</span>
							</label>
							<input
								type="url"
								value={customRepoUrl}
								onChange={(e) => setCustomRepoUrl(e.target.value)}
								placeholder="https://charts.example.com"
								className={`w-full px-3 py-2 bg-neutral-800 border rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 ${needsRepoUrl ? 'border-yellow-500/50' : 'border-neutral-700'
									}`}
							/>
							<p className="text-xs text-yellow-400 mt-1">
								This release doesn't match any known addon. Please provide the Helm repository URL.
							</p>
						</div>
					)}

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

					{/* Preview Button */}
					{repository && (
						<div className="pt-2">
							<button
								onClick={togglePreview}
								disabled={loadingPreview}
								className="text-sm text-green-400 hover:text-green-300 flex items-center gap-2"
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
										<summary className="px-3 py-2 text-sm text-neutral-300 cursor-pointer hover:bg-neutral-800/50">
											📄 {filename}
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
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>
					Cancel
				</Button>
				<Button
					onClick={handleExport}
					disabled={exporting || !repository || needsRepoUrl}
				>
					{exporting ? (
						<>
							<Spinner size="sm" />
							<span className="ml-2">Exporting...</span>
						</>
					) : createPR ? (
						'Create Pull Request'
					) : (
						'Export to Repository'
					)}
				</Button>
			</ModalFooter>
		</Modal>
	);
}

export default ExportModal;
