// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type ManagementClusterInfo, type PodInfo } from '@/api'
import { addonsApi, type ManagementAddon } from '@/api/addons'
import { Card, Spinner, StatusBadge, FadeIn } from '@/components/ui'
import { ClusterTerminal } from '@/components/terminal'
import { ManagementAddonsTab } from '@/components/management/ManagementAddonsTab'
import type { NodeInfo } from '@/types'

const TABS = ['overview', 'nodes', 'pods', 'addons', 'terminal'] as const
type TabType = typeof TABS[number]

function isValidTab(tab: string | null): tab is TabType {
	return tab !== null && TABS.includes(tab as TabType)
}

export function ManagementPage() {
	useDocumentTitle('Management Cluster')

	// URL-based tab persistence
	const [searchParams, setSearchParams] = useSearchParams()
	const tabParam = searchParams.get('tab')
	const activeTab: TabType = isValidTab(tabParam) ? tabParam : 'overview'

	const setActiveTab = (tab: TabType) => {
		setSearchParams({ tab }, { replace: true })
	}

	const [info, setInfo] = useState<ManagementClusterInfo | null>(null)
	const [nodes, setNodes] = useState<NodeInfo[]>([])
	const [pods, setPods] = useState<PodInfo[]>([])
	const [managementAddons, setManagementAddons] = useState<ManagementAddon[]>([])
	const [selectedNamespace, setSelectedNamespace] = useState('butler-system')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		loadManagement()
	}, [])

	useEffect(() => {
		if (activeTab === 'nodes') {
			loadNodes()
		} else if (activeTab === 'pods') {
			loadPods(selectedNamespace)
		} else if (activeTab === 'addons') {
			loadManagementAddons()
		}
	}, [activeTab, selectedNamespace])

	const loadManagement = async () => {
		try {
			setLoading(true)
			const data = await clustersApi.getManagement()
			setInfo(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load management cluster')
		} finally {
			setLoading(false)
		}
	}

	const loadNodes = async () => {
		try {
			const data = await clustersApi.getManagementNodes()
			setNodes(data.nodes || [])
		} catch (err) {
			console.error('Failed to load nodes:', err)
		}
	}

	const loadPods = async (namespace: string) => {
		try {
			const data = await clustersApi.getManagementPods(namespace)
			setPods(data.pods || [])
		} catch (err) {
			console.error('Failed to load pods:', err)
		}
	}

	const loadManagementAddons = async () => {
		try {
			const data = await addonsApi.getManagementAddons()
			setManagementAddons(data.addons || [])
		} catch (err) {
			console.error('Failed to load management addons:', err)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error || !info) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">{error || 'Failed to load'}</p>
				<button
					onClick={loadManagement}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Retry
				</button>
			</div>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
							<svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
							</svg>
						</div>
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-semibold text-neutral-50">Management Cluster</h1>
								<span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded">
									Management
								</span>
								<StatusBadge status={info.phase} />
							</div>
							<p className="text-neutral-400 mt-1">Kubernetes {info.kubernetesVersion}</p>
						</div>
					</div>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card className="p-4">
						<p className="text-sm text-neutral-400">Nodes</p>
						<p className="text-2xl font-semibold text-neutral-50">
							{info.nodes.ready}/{info.nodes.total}
						</p>
					</Card>
					<Card className="p-4">
						<p className="text-sm text-neutral-400">Tenant Clusters</p>
						<p className="text-2xl font-semibold text-green-500">{info.tenantClusters}</p>
					</Card>
					<Card className="p-4">
						<p className="text-sm text-neutral-400">System Namespaces</p>
						<p className="text-2xl font-semibold text-neutral-50">{info.systemNamespaces.length}</p>
					</Card>
					<Card className="p-4">
						<p className="text-sm text-neutral-400">Version</p>
						<p className="text-2xl font-semibold text-neutral-50">{info.kubernetesVersion}</p>
					</Card>
				</div>

				{/* Tabs */}
				<div className="border-b border-neutral-800">
					<nav className="flex gap-6">
						{TABS.map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`pb-3 text-sm font-medium transition-colors capitalize ${activeTab === tab
									? 'text-blue-500 border-b-2 border-blue-500'
									: 'text-neutral-400 hover:text-neutral-200'
									}`}
							>
								{tab}
							</button>
						))}
					</nav>
				</div>

				{/* Tab Content */}
				{activeTab === 'overview' && (
					<OverviewTab info={info} />
				)}
				{activeTab === 'nodes' && (
					<NodesTab nodes={nodes} />
				)}
				{activeTab === 'pods' && (
					<PodsTab
						pods={pods}
						namespaces={info.systemNamespaces}
						selectedNamespace={selectedNamespace}
						onNamespaceChange={(ns) => {
							setSelectedNamespace(ns)
							loadPods(ns)
						}}
					/>
				)}
				{activeTab === 'addons' && (
					<ManagementAddonsTab
						addons={managementAddons}
						onRefresh={loadManagementAddons}
					/>
				)}
				{activeTab === 'terminal' && (
					<Card className="h-[500px] overflow-hidden">
						<ClusterTerminal
							type="management"
							namespace=""
							cluster="management"
						/>
					</Card>
				)}
			</div>
		</FadeIn>
	)
}

function OverviewTab({ info }: { info: ManagementClusterInfo }) {
	const tenantNamespaces = info.tenantNamespaces || []

	return (
		<div className="space-y-8">
			{/* System Namespaces */}
			<div>
				<h3 className="text-lg font-medium text-neutral-50 mb-4">System Namespaces</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{info.systemNamespaces.map((ns) => (
						<Card key={ns.namespace} className="p-4">
							<div className="flex items-center justify-between">
								<span className="font-medium text-neutral-200">{ns.namespace}</span>
								<span className={`text-sm ${ns.running === ns.total ? 'text-green-400' : 'text-yellow-400'
									}`}>
									{ns.running}/{ns.total} pods
								</span>
							</div>
							<div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
								<div
									className={`h-full rounded-full ${ns.running === ns.total ? 'bg-green-500' : 'bg-yellow-500'
										}`}
									style={{ width: `${ns.total > 0 ? (ns.running / ns.total) * 100 : 0}%` }}
								/>
							</div>
						</Card>
					))}
				</div>
			</div>

			{/* Tenant Namespaces */}
			<div>
				<h3 className="text-lg font-medium text-neutral-50 mb-4">Tenant Namespaces</h3>
				{tenantNamespaces.length === 0 ? (
					<Card className="p-6 text-center">
						<p className="text-neutral-400">No tenant clusters</p>
					</Card>
				) : (
					<Card className="overflow-hidden">
						<table className="w-full">
							<thead className="bg-neutral-800/50">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Cluster</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Source Namespace</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Tenant Namespace</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Phase</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{tenantNamespaces.map((tenant) => (
									<tr key={tenant.name} className="hover:bg-neutral-800/30">
										<td className="px-4 py-3 text-sm text-neutral-200">{tenant.name}</td>
										<td className="px-4 py-3 text-sm text-neutral-400">{tenant.namespace}</td>
										<td className="px-4 py-3 text-sm text-neutral-400 font-mono">{tenant.tenantNamespace || '-'}</td>
										<td className="px-4 py-3">
											<StatusBadge status={tenant.phase || 'Unknown'} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				)}
			</div>
		</div>
	)
}

function NodesTab({ nodes }: { nodes: NodeInfo[] }) {
	if (nodes.length === 0) {
		return (
			<Card className="p-8 text-center">
				<p className="text-neutral-400">Loading nodes...</p>
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
						<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Age</th>
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
							<td className="px-4 py-3 text-sm text-neutral-400">{node.age}</td>
						</tr>
					))}
				</tbody>
			</table>
		</Card>
	)
}

interface PodsTabProps {
	pods: PodInfo[]
	namespaces: Array<{ namespace: string; running: number; total: number }>
	selectedNamespace: string
	onNamespaceChange: (ns: string) => void
}

function PodsTab({ pods, namespaces, selectedNamespace, onNamespaceChange }: PodsTabProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-4">
				<label className="text-sm text-neutral-400">Namespace:</label>
				<select
					value={selectedNamespace}
					onChange={(e) => onNamespaceChange(e.target.value)}
					className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					{namespaces.map((ns) => (
						<option key={ns.namespace} value={ns.namespace}>
							{ns.namespace} ({ns.running}/{ns.total})
						</option>
					))}
				</select>
			</div>

			<Card className="overflow-hidden">
				<table className="w-full">
					<thead className="bg-neutral-800/50">
						<tr>
							<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Name</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Ready</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Restarts</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Age</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-neutral-800">
						{pods.map((pod) => (
							<tr key={pod.name} className="hover:bg-neutral-800/30">
								<td className="px-4 py-3 text-sm text-neutral-200 font-mono">{pod.name}</td>
								<td className="px-4 py-3">
									<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${pod.status === 'Running' ? 'bg-green-500/10 text-green-400' :
										pod.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' :
											'bg-red-500/10 text-red-400'
										}`}>
										{pod.status}
									</span>
								</td>
								<td className="px-4 py-3 text-sm text-neutral-400">{pod.ready}</td>
								<td className="px-4 py-3 text-sm text-neutral-400">{pod.restarts}</td>
								<td className="px-4 py-3 text-sm text-neutral-400">{pod.age}</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
		</div>
	)
}
