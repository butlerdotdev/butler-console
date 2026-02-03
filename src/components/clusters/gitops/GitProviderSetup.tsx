/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Card, Button, Spinner } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type { GitProviderType } from '@/types/gitops';

interface GitProviderSetupProps {
	onConfigured: () => void;
}

export function GitProviderSetup({ onConfigured }: GitProviderSetupProps) {
	const { error: showError } = useToast();

	const [providerType, setProviderType] = useState<GitProviderType>('github');
	const [token, setToken] = useState('');
	const [url, setUrl] = useState('');
	const [saving, setSaving] = useState(false);
	const [showTokenInput, setShowTokenInput] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!token.trim()) {
			showError('Token Required', 'Please enter your personal access token');
			return;
		}

		setSaving(true);
		try {
			await gitopsApi.saveConfig({
				type: providerType,
				token: token.trim(),
				url: url.trim() || undefined,
			});
			onConfigured();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to save configuration';
			showError('Configuration Failed', message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="max-w-2xl mx-auto">
			<Card className="p-6">
				<div className="text-center mb-6">
					<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
						<svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<h2 className="text-xl font-semibold text-neutral-100">
						Connect to GitOps
					</h2>
					<p className="text-neutral-400 mt-2">
						Connect your Git repository to export cluster configurations and enable GitOps workflows.
					</p>
				</div>

				{!showTokenInput ? (
					<div className="space-y-4">
						{/* Provider Selection */}
						<div className="grid grid-cols-2 gap-4">
							<button
								onClick={() => {
									setProviderType('github');
									setShowTokenInput(true);
								}}
								className="p-4 rounded-lg border-2 border-neutral-700 hover:border-green-500/50 bg-neutral-800/50 hover:bg-neutral-800 transition-all group"
							>
								<div className="flex flex-col items-center gap-3">
									<svg className="w-10 h-10 text-neutral-300 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
										<path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
									</svg>
									<span className="font-medium text-neutral-200 group-hover:text-white">
										GitHub
									</span>
								</div>
							</button>

							<button
								onClick={() => {
									setProviderType('gitlab');
									setShowTokenInput(true);
								}}
								className="p-4 rounded-lg border-2 border-neutral-700 hover:border-orange-500/50 bg-neutral-800/50 hover:bg-neutral-800 transition-all group"
							>
								<div className="flex flex-col items-center gap-3">
									<svg className="w-10 h-10 text-neutral-300 group-hover:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
										<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
									</svg>
									<span className="font-medium text-neutral-200 group-hover:text-white">
										GitLab
									</span>
								</div>
							</button>
						</div>

						<p className="text-sm text-neutral-500 text-center">
							Select your Git provider to get started
						</p>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Provider Badge */}
						<div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-neutral-800/50">
							{providerType === 'github' ? (
								<svg className="w-5 h-5 text-neutral-300" fill="currentColor" viewBox="0 0 24 24">
									<path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
								</svg>
							) : (
								<svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
									<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
								</svg>
							)}
							<span className="text-neutral-300 font-medium">
								{providerType === 'github' ? 'GitHub' : 'GitLab'}
							</span>
							<button
								type="button"
								onClick={() => setShowTokenInput(false)}
								className="ml-2 text-neutral-500 hover:text-neutral-300"
							>
								Change
							</button>
						</div>

						{/* Token Input */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Personal Access Token
							</label>
							<input
								type="password"
								value={token}
								onChange={(e) => setToken(e.target.value)}
								placeholder={providerType === 'github' ? 'ghp_xxxxxxxxxxxx' : 'glpat-xxxxxxxxxxxx'}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
								autoFocus
							/>
							<p className="text-xs text-neutral-500 mt-1">
								{providerType === 'github' ? (
									<>
										Requires <code className="text-neutral-400">repo</code> scope.{' '}
										<a
											href="https://github.com/settings/tokens/new?scopes=repo&description=Butler%20Console"
											target="_blank"
											rel="noopener noreferrer"
											className="text-green-400 hover:underline"
										>
											Create token →
										</a>
									</>
								) : (
									<>
										Requires <code className="text-neutral-400">api</code> scope.{' '}
										<a
											href="https://gitlab.com/-/profile/personal_access_tokens"
											target="_blank"
											rel="noopener noreferrer"
											className="text-orange-400 hover:underline"
										>
											Create token →
										</a>
									</>
								)}
							</p>
						</div>

						{/* Custom URL for Enterprise */}
						{providerType === 'github' && (
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">
									GitHub URL <span className="text-neutral-500">(optional)</span>
								</label>
								<input
									type="url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="https://github.example.com (for GitHub Enterprise)"
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
								/>
							</div>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-2">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setShowTokenInput(false)}
							>
								Back
							</Button>
							<Button type="submit" disabled={saving || !token.trim()}>
								{saving ? (
									<>
										<Spinner size="sm" />
										<span className="ml-2">Connecting...</span>
									</>
								) : (
									'Connect'
								)}
							</Button>
						</div>
					</form>
				)}
			</Card>

			{/* Info Section */}
			<div className="mt-6 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
				<h3 className="text-sm font-medium text-neutral-300 mb-2">
					What can you do with GitOps?
				</h3>
				<ul className="space-y-2 text-sm text-neutral-400">
					<li className="flex items-start gap-2">
						<svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
						<span>Export cluster configuration to a Git repository</span>
					</li>
					<li className="flex items-start gap-2">
						<svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
						<span>Generate Flux CD or Argo CD manifests automatically</span>
					</li>
					<li className="flex items-start gap-2">
						<svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
						<span>Migrate existing Helm releases to declarative GitOps</span>
					</li>
					<li className="flex items-start gap-2">
						<svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
						<span>Create pull requests for review before changes are applied</span>
					</li>
				</ul>
			</div>
		</div>
	);
}

export default GitProviderSetup;
