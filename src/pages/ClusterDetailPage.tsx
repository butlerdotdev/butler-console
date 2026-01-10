// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi } from '@/api'
import { Card, Spinner, StatusBadge, Button, FadeIn } from '@/components/ui'
import { ClusterTerminal } from '@/components/terminal'
import { DeleteClusterModal } from '@/components/clusters/DeleteClusterModal'
import { useToast } from '@/contexts/ToastContext'
import type { TenantCluster, NodeInfo, AddonStatus, ClusterEvent, ClusterPhase } from '@/types'
import { AddonsTab } from '@/components/clusters'


const TABS = ['overview', 'nodes', 'addons', 'events', 'terminal'] as const
type TabType = typeof TABS[number]

function isValidTab(tab: string | null): tab is TabType {
	return tab !== null && TABS.includes(tab as TabType)
}

export function ClusterDetailPage() {
	const { namespace, name } = useParams<{ namespace: string; name: string }>()
	const navigate = useNavigate()
	const { success, error: showError } = useToast()

	// URL-based tab persistence
	const [searchParams, setSearchParams] = useSearchParams()
	const tabParam = searchParams.get('tab')
	const activeTab: TabType = isValidTab(tabParam) ? tabParam : 'overview'

	const setActiveTab = (tab: TabType) => {
		setSearchParams({ tab }, { replace: true })
	}

	useDocumentTitle(name ? `${name} - Cluster` : 'Cluster')

	const [cluster, setCluster] = useState<TenantCluster | null>(null)
	const [nodes, setNodes] = useState<NodeInfo[]>([])
	const [addons, setAddons] = useState<AddonStatus[]>([])
	const [events, setEvents] = useState<ClusterEvent[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showDeleteModal, setShowDeleteModal] = useState(false)

	useEffect(() => {
		if (namespace && name) {
			loadCluster()
		}
	}, [namespace, name])

	useEffect(() => {
		if (cluster && activeTab === 'nodes') {
			loadNodes()
		} else if (cluster && activeTab === 'addons') {
			loadAddons()
		} else if (cluster && activeTab === 'events') {
			loadEvents()
		}
	}, [cluster, activeTab])

	const loadCluster = async () => {
		if (!namespace || !name) return
		try {
			setLoading(true)
			const data = await clustersApi.get(namespace, name)
			setCluster(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load cluster')
		} finally {
			setLoading(false)
		}
	}

	const loadNodes = async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getNodes(namespace, name)
			setNodes(data.nodes || [])
		} catch (err) {
		}
	}

	const loadAddons = async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getAddons(namespace, name)
			setAddons(data.addons || [])
		} catch (err) {
		}
	}

	const loadEvents = async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getEvents(namespace, name)
			setEvents(data.events || [])
		} catch (err) {
		}
	}

	const handleDelete = async () => {
		if (!namespace || !name) return
		await clustersApi.delete(namespace, name)
		success('Cluster Deleted', `Cluster ${name} has been deleted`)
		navigate('/clusters')
	}

	const handleDownloadKubeconfig = async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getKubeconfig(namespace, name)
			const blob = new Blob([data.kubeconfig], { type: 'text/yaml' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${name}-kubeconfig.yaml`
			a.click()
			URL.revokeObjectURL(url)
			success('Downloaded', `Kubeconfig saved as ${name}-kubeconfig.yaml`)
		} catch (err) {
			showError('Download Failed', err instanceof Error ? err.message : 'Failed to download kubeconfig')
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error || !cluster) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">{error || 'Cluster not found'}</p>
				<button
					onClick={() => navigate('/clusters')}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Back to clusters
				</button>
			</div>
		)
	}

	const phase = (cluster.status?.phase || 'Unknown') as ClusterPhase
	const clusterName = cluster.metadata.name
	const clusterNamespace = cluster.metadata.namespace
	const workerCount = cluster.spec.workers?.replicas || 0

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button
							onClick={() => navigate('/clusters')}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
						>
							<svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-semibold text-neutral-50">{clusterName}</h1>
								<StatusBadge status={phase} />
							</div>
							<p className="text-neutral-400 mt-1">{clusterNamespace}</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Link to={`/terminal/tenant/${namespace}/${name}`}>
							<Button variant="secondary" disabled={phase !== 'Ready'}>
								<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								Terminal
							</Button>
						</Link>
						<Button
							variant="secondary"
							onClick={handleDownloadKubeconfig}
							disabled={phase !== 'Ready'}
						>
							Download Kubeconfig
						</Button>
						<Button
							variant="danger"
							onClick={() => setShowDeleteModal(true)}
						>
							Delete
						</Button>
					</div>
				</div>

				{/* Tabs */}
				<div className="border-b border-neutral-800">
					<nav className="flex gap-6">
						{TABS.map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`pb-3 text-sm font-medium transition-colors capitalize ${activeTab === tab
									? 'text-green-500 border-b-2 border-green-500'
									: 'text-neutral-400 hover:text-neutral-200'
									}`}
								disabled={tab === 'terminal' && phase !== 'Ready'}
							>
								{tab}
							</button>
						))}
					</nav>
				</div>

				{/* Tab Content */}
				{activeTab === 'overview' && <OverviewTab cluster={cluster} />}
				{activeTab === 'nodes' && <NodesTab nodes={nodes} />}
				{activeTab === 'addons' && (
					<AddonsTab
						clusterNamespace={namespace!}
						clusterName={name!}
						addons={addons}
						onRefresh={loadAddons}
					/>
				)}
				{activeTab === 'events' && <EventsTab events={events} />}
				{activeTab === 'terminal' && phase === 'Ready' && (
					<Card className="h-[500px] overflow-hidden">
						<ClusterTerminal
							type="tenant"
							namespace={clusterNamespace}
							cluster={clusterName}
						/>
					</Card>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			<DeleteClusterModal
				isOpen={showDeleteModal}
				onClose={() => setShowDeleteModal(false)}
				onConfirm={handleDelete}
				clusterName={clusterName}
				clusterNamespace={clusterNamespace}
				workerCount={workerCount}
			/>
		</FadeIn>
	)
}

function OverviewTab({ cluster }: { cluster: TenantCluster }) {
	const spec = cluster.spec
	const status = cluster.status
	const provider = spec.providerConfigRef?.name || 'Default'
	const isControlPlaneReady = status?.phase === 'Ready'

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<Card className="p-5">
				<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Specification</h3>
				<dl className="space-y-3">
					<div className="flex justify-between">
						<dt className="text-neutral-400">Kubernetes Version</dt>
						<dd className="text-neutral-50">{spec.kubernetesVersion || 'Unknown'}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-neutral-400">Provider</dt>
						<dd className="text-neutral-50">
							<Link to="/providers" className="text-purple-400 hover:text-purple-300">
								{provider}
							</Link>
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-neutral-400">Worker Replicas</dt>
						<dd className="text-neutral-50">{spec.workers?.replicas || 0}</dd>
					</div>
				</dl>
			</Card>

			<Card className="p-5">
				<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Status</h3>
				<dl className="space-y-3">
					<div className="flex justify-between">
						<dt className="text-neutral-400">Phase</dt>
						<dd><StatusBadge status={status?.phase || 'Unknown'} /></dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-neutral-400">Tenant Namespace</dt>
						<dd className="text-neutral-50">{status?.tenantNamespace || 'N/A'}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-neutral-400">Control Plane Ready</dt>
						<dd className="text-neutral-50">{isControlPlaneReady ? 'Yes' : 'No'}</dd>
					</div>
				</dl>
			</Card>
		</div>
	)
}

function NodesTab({ nodes }: { nodes: NodeInfo[] }) {
	if (nodes.length === 0) {
		return (
			<Card className="p-8 text-center">
				<p className="text-neutral-400">No nodes available or cluster not ready</p>
			</Card>
		)
	}

	return (
		<Card className="overflow-hidden">
			<table className="w-full">
				<thead className="bg-neutral-800/50">
					<tr>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Name</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Roles</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Version</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">IP</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-neutral-800">
					{nodes.map((node) => (
						<tr key={node.name} className="hover:bg-neutral-800/30">
							<td className="px-4 py-3 text-sm text-neutral-200">{node.name}</td>
							<td className="px-4 py-3">
								<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${node.status === 'Ready' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
									}`}>
									{node.status}
								</span>
							</td>
							<td className="px-4 py-3 text-sm text-neutral-400">{node.roles.join(', ')}</td>
							<td className="px-4 py-3 text-sm text-neutral-400">{node.version}</td>
							<td className="px-4 py-3 text-sm text-neutral-400 font-mono">{node.internalIP}</td>
						</tr>
					))}
				</tbody>
			</table>
		</Card>
	)
}

function EventsTab({ events }: { events: ClusterEvent[] }) {
	if (events.length === 0) {
		return (
			<Card className="p-8 text-center">
				<p className="text-neutral-400">No events found</p>
			</Card>
		)
	}

	return (
		<Card className="overflow-hidden">
			<table className="w-full">
				<thead className="bg-neutral-800/50">
					<tr>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Type</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Reason</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Message</th>
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Count</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-neutral-800">
					{events.map((event, idx) => (
						<tr key={idx} className="hover:bg-neutral-800/30">
							<td className="px-4 py-3">
								<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${event.type === 'Normal' ? 'bg-blue-500/10 text-blue-400' : 'bg-yellow-500/10 text-yellow-400'
									}`}>
									{event.type}
								</span>
							</td>
							<td className="px-4 py-3 text-sm text-neutral-200">{event.reason}</td>
							<td className="px-4 py-3 text-sm text-neutral-400 max-w-md truncate">{event.message}</td>
							<td className="px-4 py-3 text-sm text-neutral-400">{event.count}</td>
						</tr>
					))}
				</tbody>
			</table>
		</Card>
	)
}
