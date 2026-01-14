// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type Cluster } from '@/api'
import { Card, StatusBadge, FadeIn, Button, Spinner } from '@/components/ui'

export function DashboardPage() {
	const { currentTeam, currentTeamDisplayName, buildPath } = useTeamContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Dashboard` : 'Dashboard')

	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function fetchClusters() {
			try {
				// Filter clusters by team when in team context
				const response = await clustersApi.list({ team: currentTeam ?? undefined })
				setClusters(response.clusters || [])
			} catch (error) {
				console.error('Failed to fetch clusters:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchClusters()
	}, [currentTeam])

	// Calculate stats from all clusters (API already filters by access)
	const stats = useMemo(() => {
		const total = clusters.length
		const ready = clusters.filter((c) => c.status?.phase === 'Ready').length
		const provisioning = clusters.filter((c) =>
			['Provisioning', 'Pending', 'Scaling', 'Installing'].includes(c.status?.phase || '')
		).length
		const failed = clusters.filter((c) => c.status?.phase === 'Failed').length

		return { total, ready, provisioning, failed }
	}, [clusters])

	// Recent clusters (sorted by creation date, limit 5)
	const recentClusters = useMemo(() => {
		return [...clusters]
			.sort((a, b) => {
				const aTime = new Date(a.metadata.creationTimestamp || 0).getTime()
				const bTime = new Date(b.metadata.creationTimestamp || 0).getTime()
				return bTime - aTime
			})
			.slice(0, 5)
	}, [clusters])

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Dashboard</h1>
					<p className="text-neutral-400 mt-1">
						Overview of your Kubernetes clusters
					</p>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* Total Clusters */}
					<Card className="p-5">
						<p className="text-sm text-neutral-400 mb-1">Total Clusters</p>
						<p className="text-3xl font-bold text-neutral-100">{stats.total}</p>
					</Card>

					{/* Ready */}
					<Card className="p-5">
						<p className="text-sm text-neutral-400 mb-1">Ready</p>
						<p className="text-3xl font-bold text-green-400">{stats.ready}</p>
					</Card>

					{/* Provisioning */}
					<Card className="p-5">
						<p className="text-sm text-neutral-400 mb-1">Provisioning</p>
						<p className="text-3xl font-bold text-yellow-400">{stats.provisioning}</p>
					</Card>

					{/* Failed */}
					<Card className="p-5">
						<p className="text-sm text-neutral-400 mb-1">Failed</p>
						<p className="text-3xl font-bold text-red-400">{stats.failed}</p>
					</Card>
				</div>

				{/* Recent Clusters */}
				<Card className="overflow-hidden">
					<div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
						<h2 className="text-lg font-medium text-neutral-100">Recent Clusters</h2>
						<Link
							to={buildPath('/clusters')}
							className="text-sm text-green-500 hover:text-green-400 transition-colors"
						>
							View all →
						</Link>
					</div>

					{recentClusters.length === 0 ? (
						<div className="px-5 py-12 text-center">
							<svg
								className="mx-auto h-12 w-12 text-neutral-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
								/>
							</svg>
							<h3 className="mt-4 text-lg font-medium text-neutral-300">
								No clusters yet
							</h3>
							<p className="mt-2 text-sm text-neutral-500">
								Get started by creating your first Kubernetes cluster.
							</p>
							<Link to={buildPath('/clusters/new')} className="inline-block mt-4">
								<Button>Create Cluster</Button>
							</Link>
						</div>
					) : (
						<div className="divide-y divide-neutral-800">
							{recentClusters.map((cluster) => (
								<Link
									key={`${cluster.metadata.namespace}/${cluster.metadata.name}`}
									to={buildPath(`/clusters/${cluster.metadata.namespace}/${cluster.metadata.name}`)}
									className="flex items-center justify-between px-5 py-4 hover:bg-neutral-800/50 transition-colors"
								>
									<div className="flex items-center gap-3">
										{/* Status Indicator */}
										<span
											className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cluster.status?.phase === 'Ready'
												? 'bg-green-500'
												: cluster.status?.phase === 'Failed'
													? 'bg-red-500'
													: 'bg-yellow-500'
												}`}
										/>
										<div>
											<p className="font-medium text-neutral-200">
												{cluster.metadata.name}
											</p>
											<p className="text-xs text-neutral-500">
												{cluster.spec.kubernetesVersion} • {cluster.spec.workers?.replicas || 0} worker
												{(cluster.spec.workers?.replicas || 0) !== 1 ? 's' : ''}
											</p>
										</div>
									</div>

									<div className="flex items-center gap-4">
										{/* Status Badge */}
										<StatusBadge status={cluster.status?.phase || 'Unknown'} />

										{/* Arrow */}
										<svg
											className="w-5 h-5 text-neutral-600"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 5l7 7-7 7"
											/>
										</svg>
									</div>
								</Link>
							))}
						</div>
					)}
				</Card>

				{/* Quick Action */}
				{recentClusters.length > 0 && (
					<div className="mt-6">
						<Link to={buildPath('/clusters/new')}>
							<Button>
								<svg
									className="w-4 h-4 mr-2"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 4v16m8-8H4"
									/>
								</svg>
								Create Cluster
							</Button>
						</Link>
					</div>
				)}
			</div>
		</FadeIn>
	)
}
