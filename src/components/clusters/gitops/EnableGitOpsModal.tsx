/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Button, Spinner } from '@/components/ui';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type { Repository, Branch, GitOpsToolType } from '@/types/gitops';
import { GITOPS_TOOL_CONFIG } from '@/types/gitops';

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

interface EnableGitOpsModalProps {
	clusterNamespace: string;
	clusterName: string;
	repositories: Repository[];
	onClose: () => void;
	onSuccess: () => void;
}

export function EnableGitOpsModal({
	clusterNamespace,
	clusterName,
	repositories,
	onClose,
	onSuccess,
}: EnableGitOpsModalProps) {
	const { error: showError } = useToast();

	// Form state
	const [provider, setProvider] = useState<GitOpsToolType>('flux');
	const [repository, setRepository] = useState('');
	const [branch, setBranch] = useState('main');
	const [path, setPath] = useState(`clusters/${clusterName}`);
	const [isPrivate, setIsPrivate] = useState(true);

	// Extra components - default to all selected
	const [componentsExtra, setComponentsExtra] = useState<string[]>(
		FLUX_EXTRA_COMPONENTS.map(c => c.name)
	);

	// Loading state
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loadingBranches, setLoadingBranches] = useState(false);
	const [enabling, setEnabling] = useState(false);

	// Toggle extra component
	const toggleComponent = (componentName: string) => {
		setComponentsExtra(prev =>
			prev.includes(componentName)
				? prev.filter(c => c !== componentName)
				: [...prev, componentName]
		);
	};

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

	// Handle enable
	const handleEnable = async () => {
		if (!repository) {
			showError('Repository Required', 'Please select a repository');
			return;
		}

		setEnabling(true);
		try {
			const result = await gitopsApi.enable(clusterNamespace, clusterName, {
				provider,
				repository,
				branch,
				path,
				private: isPrivate,
				componentsExtra: provider === 'flux' ? componentsExtra : undefined,
			});

			// The API returns { success: true, message: "...", ... }
			// Check for success - if we got here without throwing, it worked
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
		<Modal isOpen onClose={onClose} size="lg">
			<ModalHeader>
				Enable GitOps on {clusterName}
			</ModalHeader>

			<ModalBody>
				<div className="space-y-5">
					{/* Provider Selection */}
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-2">
							GitOps Tool
						</label>
						<div className="grid grid-cols-2 gap-3">
							{(['flux', 'argocd'] as GitOpsToolType[]).map((tool) => {
								const config = GITOPS_TOOL_CONFIG[tool];
								const isSelected = provider === tool;
								const isDisabled = tool === 'argocd'; // ArgoCD not yet implemented

								return (
									<button
										key={tool}
										type="button"
										onClick={() => !isDisabled && setProvider(tool)}
										disabled={isDisabled}
										className={`p-4 rounded-lg border-2 transition-all text-left ${isSelected
											? 'border-green-500 bg-green-500/10'
											: isDisabled
												? 'border-neutral-700 bg-neutral-800/30 opacity-50 cursor-not-allowed'
												: 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
											}`}
									>
										<div className="flex items-center gap-3">
											<span className="text-2xl">{config.icon}</span>
											<div>
												<p className={`font-medium ${isSelected ? 'text-green-400' : 'text-neutral-200'}`}>
													{config.label}
												</p>
												{isDisabled && (
													<p className="text-xs text-neutral-500">Coming soon</p>
												)}
											</div>
										</div>
									</button>
								);
							})}
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
									{repo.fullName} {repo.private ? '(private)' : ''}
								</option>
							))}
						</select>
						<p className="text-xs text-neutral-500 mt-1">
							This repository will store your cluster's GitOps manifests
						</p>
					</div>

					{/* Branch and Path */}
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

					{/* Private repo option */}
					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={isPrivate}
							onChange={(e) => setIsPrivate(e.target.checked)}
							className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
						/>
						<div>
							<span className="text-neutral-200">Private repository</span>
							<p className="text-xs text-neutral-500">
								Create deploy key for private repository access
							</p>
						</div>
					</label>

					{/* Extra Components (Flux only) */}
					{provider === 'flux' && (
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
												? 'border-green-500/50 bg-green-500/5'
												: 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
												}`}
										>
											<input
												type="checkbox"
												checked={isChecked}
												onChange={() => toggleComponent(component.name)}
												className="w-4 h-4 mt-0.5 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
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
							<p className="text-xs text-neutral-500 mt-2">
								These controllers enable automatic image updates via GitOps
							</p>
						</div>
					)}

					{/* Info Box */}
					<div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/30">
						<div className="flex items-start gap-3">
							<svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div className="text-sm">
								<p className="text-blue-200 font-medium">What will be installed?</p>
								<ul className="text-blue-300/80 mt-1 space-y-1">
									<li>• Flux controllers in the <code className="text-blue-400">flux-system</code> namespace</li>
									<li>• GitRepository and Kustomization resources</li>
									<li>• Directory structure: <code className="text-blue-400">{path}/infrastructure</code> and <code className="text-blue-400">{path}/apps</code></li>
									{componentsExtra.length > 0 && (
										<li>• Extra: {componentsExtra.join(', ')}</li>
									)}
								</ul>
							</div>
						</div>
					</div>
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>
					Cancel
				</Button>
				<Button
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
			</ModalFooter>
		</Modal>
	);
}

export default EnableGitOpsModal;
