/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Button } from '@/components/ui';
import type { DiscoveredRelease } from '@/types/gitops';
import { getCategoryLabel } from '@/types/gitops';

interface DiscoveredReleaseCardProps {
	release: DiscoveredRelease;
	onExport: () => void;
}

export function DiscoveredReleaseCard({ release, onExport }: DiscoveredReleaseCardProps) {
	const isMatched = !!release.addonDefinition;
	const isPlatform = release.platform;
	const hasRepoUrl = !!release.repoUrl;

	return (
		<Card className={`p-4 ${!isMatched && !hasRepoUrl ? 'border-yellow-500/30' : ''}`}>
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1 min-w-0">
					{/* Name and Version */}
					<div className="flex items-center gap-2">
						<h3 className="text-neutral-100 font-medium truncate">
							{release.name}
						</h3>
						{isPlatform && (
							<span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded border border-purple-500/30">
								Platform
							</span>
						)}
					</div>

					{/* Namespace and Chart */}
					<p className="text-sm text-neutral-500 mt-1">
						{release.namespace} • {release.chart}:{release.chartVersion}
					</p>

					{/* Category */}
					<div className="flex items-center gap-2 mt-2">
						<span className={`px-2 py-0.5 text-xs rounded-full ${release.category === 'infrastructure'
							? 'bg-blue-500/10 text-blue-400'
							: 'bg-neutral-700 text-neutral-400'
							}`}>
							{getCategoryLabel(release.category)}
						</span>

						{/* Status */}
						<span className={`px-2 py-0.5 text-xs rounded-full ${release.status === 'deployed'
							? 'bg-green-500/10 text-green-400'
							: 'bg-yellow-500/10 text-yellow-400'
							}`}>
							{release.status}
						</span>
					</div>

					{/* Warning only if no AddonDefinition AND no repoUrl */}
					{!isMatched && !hasRepoUrl && (
						<div className="flex items-center gap-1.5 mt-2 text-yellow-400 text-xs">
							<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<span>Repo URL required</span>
						</div>
					)}

					{/* Show Repo URL if we have one (matched or auto-detected) */}
					{hasRepoUrl && (
						<p className="text-xs text-neutral-600 mt-2 truncate" title={release.repoUrl}>
							{release.repoUrl}
						</p>
					)}
				</div>

				{/* Export Button */}
				<Button
					variant="secondary"
					size="sm"
					onClick={onExport}
					className="flex-shrink-0"
				>
					Export
				</Button>
			</div>

			{/* Values Preview (collapsed) */}
			{release.values && Object.keys(release.values).length > 0 && (
				<details className="mt-3 pt-3 border-t border-neutral-800">
					<summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-400">
						{Object.keys(release.values).length} custom values
					</summary>
					<pre className="mt-2 p-2 bg-neutral-900 rounded text-xs text-neutral-400 overflow-x-auto max-h-32">
						{JSON.stringify(release.values, null, 2)}
					</pre>
				</details>
			)}
		</Card>
	);
}

export default DiscoveredReleaseCard;
