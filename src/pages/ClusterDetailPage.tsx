// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useAuth } from '@/hooks/useAuth'
import { clustersApi, stewardApi, type Cluster, type TenantControlPlane, type Node, type Addon, type ClusterEvent, type MachineRequest, type LoadBalancerRequest } from '@/api'
import { ENVIRONMENT_LABEL } from '@/types/environments'
import { Card, Spinner, StatusBadge, Button, FadeIn } from '@/components/ui'
import { ClusterTerminal } from '@/components/terminal'
import { DeleteClusterModal } from '@/components/clusters/DeleteClusterModal'
import { ScaleWorkersModal } from '@/components/clusters/ScaleWorkersModal'
import { EditClusterModal } from '@/components/clusters/EditClusterModal'
import { ChangeEnvironmentModal } from '@/components/clusters/ChangeEnvironmentModal'
import { useEnvContext } from '@/hooks/useEnvContext'
import { useToast } from '@/hooks/useToast'
import { AddonsTab } from '@/components/clusters'
import { AccessDenied } from '@/components/AccessDenied'
import { CertificatesTab } from '@/components/clusters/certificates';
import { GitOpsTab } from '@/components/clusters/gitops';
import { NetworkAllocationsCard } from '@/components/clusters/NetworkAllocationsCard';
import { ObservabilityTab } from '@/components/clusters/observability';


// Error type for API responses
interface ApiError {
	status?: number
	response?: { status?: number }
	message?: string
}

const TABS = ['overview', 'control-plane', 'nodes', 'addons', 'gitops', 'events', 'certificates', 'observability', 'terminal'] as const

type TabType = typeof TABS[number]

function isValidTab(tab: string | null): tab is TabType {
	return tab !== null && TABS.includes(tab as TabType)
}

export function ClusterDetailPage() {
	const { namespace, name } = useParams<{ namespace: string; name: string }>()
	const navigate = useNavigate()
	const { success, error: showError } = useToast()
	const { buildPath, currentTeam } = useTeamContext()
	const { user } = useAuth()
	const isAdmin = user?.isPlatformAdmin || user?.teams?.some(t => t.name === currentTeam && t.role === 'admin') || false

	// URL-based tab persistence
	const [searchParams, setSearchParams] = useSearchParams()
	const tabParam = searchParams.get('tab')
	const activeTab: TabType = isValidTab(tabParam) ? tabParam : 'overview'

	const setActiveTab = (tab: TabType) => {
		setSearchParams({ tab }, { replace: true })
	}

	useDocumentTitle(name ? `${name} - Cluster` : 'Cluster')

	const [cluster, setCluster] = useState<Cluster | null>(null)
	const [nodes, setNodes] = useState<Node[]>([])
	const [addons, setAddons] = useState<Addon[]>([])
	const [events, setEvents] = useState<ClusterEvent[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [accessDenied, setAccessDenied] = useState(false)
	const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>('')
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [showScaleModal, setShowScaleModal] = useState(false)
	const [showEditModal, setShowEditModal] = useState(false)
	const [showChangeEnvModal, setShowChangeEnvModal] = useState(false)
	const { availableEnvs } = useEnvContext()
	const [scaleTarget, setScaleTarget] = useState<number | null>(null)
	const [loadBalancerRequests, setLoadBalancerRequests] = useState<LoadBalancerRequest[]>([])
	const [machineRequests, setMachineRequests] = useState<MachineRequest[]>([])
	const [tcp, setTcp] = useState<TenantControlPlane | null>(null)

	const loadTCP = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await stewardApi.getClusterTCP(namespace, name)
			setTcp(data)
		} catch {
			// Non-fatal: TCP may not exist yet during provisioning
		}
	}, [namespace, name])

	const loadCluster = useCallback(async (silent = false) => {
		if (!namespace || !name) return
		try {
			if (!silent) setLoading(true)
			setAccessDenied(false)
			const data = await clustersApi.get(namespace, name)
			setCluster(data)
		} catch (err: unknown) {
			const apiErr = err as ApiError
			// Check for 403 Forbidden response
			if (apiErr?.status === 403 || apiErr?.response?.status === 403 ||
				(apiErr?.message && apiErr.message.includes('forbidden'))) {
				setAccessDenied(true)
				setAccessDeniedMessage(apiErr?.message || 'You do not have access to this cluster')
			} else if (!silent) {
				setError(err instanceof Error ? err.message : 'Failed to load cluster')
			}
		} finally {
			if (!silent) setLoading(false)
		}
	}, [namespace, name])

	const loadNodes = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getNodes(namespace, name)
			setNodes(data.nodes || [])
		} catch {
			// Silently handle error - nodes will remain empty
		}
	}, [namespace, name])

	const loadAddons = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getAddons(namespace, name)
			setAddons(data.addons || [])
		} catch {
			// Silently handle error - addons will remain empty
		}
	}, [namespace, name])

	const loadEvents = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getEvents(namespace, name)
			setEvents(data.events || [])
		} catch {
			// Silently handle error
		}
	}, [namespace, name])

	const loadMachineRequests = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getMachineRequests(namespace, name)
			setMachineRequests(data.machineRequests || [])
		} catch {
			// Silently handle - CRD may not exist
		}
	}, [namespace, name])

	const loadLoadBalancerRequests = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await clustersApi.getLoadBalancerRequests(namespace, name)
			setLoadBalancerRequests(data.loadBalancerRequests || [])
		} catch {
			// Silently handle error
		}
	}, [namespace, name])

	useEffect(() => {
		if (namespace && name) {
			loadCluster()
		}
	}, [namespace, name, loadCluster])

	// Clear scaleTarget when scaling is complete
	useEffect(() => {
		if (scaleTarget == null || !cluster) return
		const ready = cluster.status?.workerNodesReady
		if (ready != null && ready === scaleTarget) {
			setScaleTarget(null)
		}
	}, [cluster, scaleTarget])

	// Auto-poll every 5s when workers are scaling or cluster not Ready
	useEffect(() => {
		if (!cluster) return
		const phase = cluster.status?.phase
		const ready = cluster.status?.workerNodesReady
		const desired = cluster.status?.workerNodesDesired
		const isConverging = ready != null && desired != null && ready !== desired
		const isNotReady = phase && phase !== 'Ready'
		const isScaling = scaleTarget != null
		if (!isConverging && !isNotReady && !isScaling) return

		const interval = setInterval(() => {
			loadCluster(true)
		}, 5000)
		return () => clearInterval(interval)
	}, [cluster, scaleTarget, loadCluster])

	useEffect(() => {
		if (cluster && activeTab === 'nodes') {
			loadNodes()
		} else if (cluster && (activeTab === 'addons' || activeTab === 'observability')) {
			loadAddons()
		} else if (cluster && activeTab === 'events') {
			loadEvents()
		} else if (cluster && activeTab === 'overview') {
			loadLoadBalancerRequests()
			loadMachineRequests()
		} else if (cluster && activeTab === 'control-plane') {
			loadTCP()
		}
	}, [cluster, activeTab, loadNodes, loadAddons, loadEvents, loadLoadBalancerRequests, loadMachineRequests, loadTCP])

	const handleDelete = async () => {
		if (!namespace || !name) return
		try {
			await clustersApi.delete(namespace, name)
			success('Cluster Deleted', `Cluster ${name} has been deleted`)
			navigate(buildPath('/clusters'))
		} catch (err: unknown) {
			const apiErr = err as ApiError
			if (apiErr?.status === 403 || apiErr?.response?.status === 403) {
				showError('Permission Denied', 'You do not have permission to delete this cluster')
			} else {
				showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete cluster')
			}
		}
	}

	const handleScale = async (replicas: number) => {
		if (!namespace || !name) return
		await clustersApi.scale(namespace, name, replicas)
		setScaleTarget(replicas)
		success('Workers Scaled', `Cluster ${name} scaling to ${replicas} worker${replicas !== 1 ? 's' : ''}`)
		loadCluster(true)
	}

	const handleExportYAML = async () => {
		if (!namespace || !name) return
		try {
			const yamlContent = await clustersApi.exportYAML(namespace, name)
			const blob = new Blob([yamlContent], { type: 'application/x-yaml' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${name}.yaml`
			a.click()
			URL.revokeObjectURL(url)
			success('Exported', `Cluster manifest saved as ${name}.yaml`)
		} catch (err) {
			showError('Export Failed', err instanceof Error ? err.message : 'Failed to export cluster YAML')
		}
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
		} catch (err: unknown) {
			const apiErr = err as ApiError
			if (apiErr?.status === 403 || apiErr?.response?.status === 403) {
				showError('Permission Denied', 'You do not have permission to download this kubeconfig')
			} else {
				showError('Download Failed', err instanceof Error ? err.message : 'Failed to download kubeconfig')
			}
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	// Show access denied page for 403 responses
	if (accessDenied) {
		return (
			<AccessDenied
				message={accessDeniedMessage}
				resourceType="cluster"
				resourceName={name}
				teamName={namespace}
			/>
		)
	}

	if (error || !cluster) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">{error || 'Cluster not found'}</p>
				<button
					onClick={() => navigate(-1)}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Go back
				</button>
			</div>
		)
	}

	const phase = cluster.status?.phase || 'Unknown'
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
							onClick={() => navigate(-1)}
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
							onClick={handleExportYAML}
						>
							<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export YAML
						</Button>
						<Button
							variant="secondary"
							onClick={handleDownloadKubeconfig}
							disabled={phase !== 'Ready'}
						>
							Download Kubeconfig
						</Button>
						<Button
							variant="secondary"
							onClick={() => setShowEditModal(true)}
							disabled={phase === 'Failed' || phase === 'Deleting'}
						>
							Edit
						</Button>
						<Button
							variant="secondary"
							onClick={() => setShowScaleModal(true)}
						>
							Scale Workers
						</Button>
						{availableEnvs.length > 0 && (
							<Button
								variant="secondary"
								onClick={() => setShowChangeEnvModal(true)}
								disabled={phase === 'Deleting'}
							>
								Change Environment
							</Button>
						)}
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
								{tab === 'control-plane' ? 'Control Plane' : tab}
							</button>
						))}
					</nav>
				</div>

				{/* Tab Content */}
				{activeTab === 'overview' && <OverviewTab cluster={cluster} namespace={namespace!} name={name!} scaleTarget={scaleTarget} loadBalancerRequests={loadBalancerRequests} machineRequests={machineRequests} />}
				{activeTab === 'control-plane' && <ControlPlaneTab tcp={tcp} />}
				{activeTab === 'nodes' && <NodesTab nodes={nodes} />}
				{activeTab === 'addons' && (
					<AddonsTab
						clusterNamespace={namespace!}
						clusterName={name!}
						addons={addons}
						onRefresh={loadAddons}
					/>
				)}
				{activeTab === 'gitops' && <GitOpsTab />}
				{activeTab === 'events' && <EventsTab events={events} />}
				{activeTab === 'certificates' && <CertificatesTab />}
				{activeTab === 'observability' && (
					<ObservabilityTab
						clusterNamespace={namespace!}
						clusterName={name!}
						addons={addons}
						onRefresh={loadAddons}
					/>
				)}
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
			<ScaleWorkersModal
				isOpen={showScaleModal}
				onClose={() => setShowScaleModal(false)}
				onScale={handleScale}
				clusterName={clusterName}
				currentReplicas={workerCount}
			/>
			{cluster && (
				<EditClusterModal
					isOpen={showEditModal}
					onClose={() => setShowEditModal(false)}
					onSaved={() => { success('Cluster Updated', `Cluster ${name} has been updated`); loadCluster(true) }}
					cluster={cluster}
					isAdmin={isAdmin}
				/>
			)}
			{cluster && availableEnvs.length > 0 && (
				<ChangeEnvironmentModal
					isOpen={showChangeEnvModal}
					onClose={() => setShowChangeEnvModal(false)}
					onChanged={(newEnv) => {
						success(
							'Environment Changed',
							newEnv
								? `Cluster ${clusterName} moved to environment ${newEnv}`
								: `Cluster ${clusterName} env label cleared`
						)
						loadCluster(true)
					}}
					clusterName={clusterName}
					namespace={clusterNamespace}
					currentEnvironment={cluster.metadata?.labels?.[ENVIRONMENT_LABEL] || ''}
					availableEnvs={availableEnvs}
					allowClear={false}
				/>
			)}
		</FadeIn>
	)
}

function WarningBanner({ title, message }: { title: string; message?: string }) {
	return (
		<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
			<div className="flex items-start gap-3">
				<svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
				</svg>
				<div>
					<p className="text-sm font-medium text-amber-400">{title}</p>
					{message && <p className="text-xs text-neutral-400 mt-1">{message}</p>}
				</div>
			</div>
		</div>
	)
}

function OverviewTab({ cluster, namespace, name, scaleTarget, loadBalancerRequests, machineRequests }: { cluster: Cluster; namespace: string; name: string; scaleTarget: number | null; loadBalancerRequests: LoadBalancerRequest[]; machineRequests: MachineRequest[] }) {
	const spec = cluster.spec
	const status = cluster.status
	const provider = spec.providerConfigRef?.name || 'Default'
	const isControlPlaneReady = status?.phase === 'Ready'

	const conditions = (status?.conditions || []) as Array<{type: string; status: string; reason?: string; message?: string}>
	const readyCondition = conditions.find(c => c.type === 'Ready')
	const isDegraded = readyCondition?.reason === 'ReconcileDegraded'
	const ready = status?.workerNodesReady
	const desired = status?.workerNodesDesired
	const hasStaleNodes = status?.phase === 'Ready' && ready != null && desired != null && ready > desired

	return (
		<div className="space-y-6">
			{isDegraded && (
				<WarningBanner title="Cluster Degraded" message={readyCondition?.message} />
			)}
			{hasStaleNodes && (
				<WarningBanner
					title="Stale Nodes Detected"
					message={`${ready} nodes reporting but only ${desired} desired. Check the Nodes tab for NotReady nodes that may need manual cleanup.`}
				/>
			)}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Specification</h3>
					<dl className="space-y-3">
						<div className="flex justify-between">
							<dt className="text-neutral-400">Control Plane Version</dt>
							<dd className="text-neutral-50">{spec.kubernetesVersion || 'Unknown'}</dd>
						</div>
						{spec.workers?.machineTemplate?.os && (
							<div className="flex justify-between">
								<dt className="text-neutral-400">Worker OS</dt>
								<dd className="text-neutral-50">
									{spec.workers.machineTemplate.os.type || 'Unknown'}
									{spec.workers.machineTemplate.os.version ? ` ${spec.workers.machineTemplate.os.version}` : ''}
								</dd>
							</div>
						)}
						<div className="flex justify-between">
							<dt className="text-neutral-400">Provider</dt>
							<dd className="text-neutral-50">
								<Link to="/providers" className="text-purple-400 hover:text-purple-300">
									{provider}
								</Link>
							</dd>
						</div>
						{cluster.metadata.labels?.[ENVIRONMENT_LABEL] && (
							<div className="flex justify-between">
								<dt className="text-neutral-400">Environment</dt>
								<dd className="text-neutral-50 font-mono">
									{cluster.metadata.labels[ENVIRONMENT_LABEL]}
								</dd>
							</div>
						)}
						{(() => {
							const owner =
								cluster.metadata?.annotations?.['butler.butlerlabs.dev/owner'] ||
								cluster.metadata?.annotations?.['butler.butlerlabs.dev/creator-email']
							if (!owner) return null
							return (
								<div className="flex justify-between">
									<dt className="text-neutral-400">Created by</dt>
									<dd className="text-neutral-50 truncate" title={owner}>{owner}</dd>
								</div>
							)
						})()}
						<div className="flex justify-between">
							<dt className="text-neutral-400">Workers</dt>
							<dd className="text-neutral-50">
								{(() => {
									const ready = status?.workerNodesReady
									const desired = status?.workerNodesDesired
									const specReplicas = spec.workers?.replicas ?? 0
									if (ready != null && desired != null && ready !== desired) {
										return (
											<span className="flex items-center gap-2">
												<span className="text-amber-400">{ready}/{desired} ready</span>
												<svg className="w-4 h-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
												</svg>
											</span>
										)
									}
									if (ready != null && desired != null) {
										return <span>{ready}/{desired} ready</span>
									}
									if (scaleTarget != null) {
										return (
											<span className="flex items-center gap-2">
												<span className="text-amber-400">Scaling to {scaleTarget}...</span>
												<svg className="w-4 h-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
												</svg>
											</span>
										)
									}
									return <span>{specReplicas}</span>
								})()}
							</dd>
						</div>
						{spec.controlPlane?.replicas != null && (
							<div className="flex justify-between">
								<dt className="text-neutral-400">Control Plane Replicas</dt>
								<dd className="text-neutral-50">{spec.controlPlane.replicas}</dd>
							</div>
						)}
						{spec.workers?.machineTemplate && (
							<>
								{spec.workers.machineTemplate.cpu != null && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Worker CPU</dt>
										<dd className="text-neutral-50">{spec.workers.machineTemplate.cpu} cores</dd>
									</div>
								)}
								{spec.workers.machineTemplate.memory && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Worker Memory</dt>
										<dd className="text-neutral-50">{spec.workers.machineTemplate.memory}</dd>
									</div>
								)}
								{spec.workers.machineTemplate.diskSize && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Worker Disk</dt>
										<dd className="text-neutral-50">{spec.workers.machineTemplate.diskSize}</dd>
									</div>
								)}
							</>
						)}
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
						{status?.conditions && (() => {
							const conditions = status.conditions as Array<{type: string; status: string; reason?: string; message?: string}>
							const workersReady = conditions.find((c) => c.type === 'WorkersReady')
							const networkReady = conditions.find((c) => c.type === 'NetworkReady')
							const clusterIsReady = status?.phase === 'Ready'
							return (
								<>
									{workersReady && (
										<div className="flex justify-between">
											<dt className="text-neutral-400">Workers Ready</dt>
											<dd>
												<StatusBadge status={workersReady.status === 'True' || clusterIsReady ? 'Ready' : workersReady.reason === 'WorkersProvisioning' ? 'Provisioning' : 'Pending'} />
											</dd>
										</div>
									)}
									{networkReady && (
										<div className="flex justify-between">
											<dt className="text-neutral-400">Network Ready</dt>
											<dd>
												<StatusBadge status={networkReady.status === 'True' ? 'Ready' : networkReady.status === 'False' ? 'Failed' : 'Pending'} />
											</dd>
										</div>
									)}
								</>
							)
						})()}
					</dl>
				</Card>
			</div>

			{/* Control Plane Resources */}
			{spec.controlPlane?.resources && (
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Control Plane Resources</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{(['apiServer', 'controllerManager', 'scheduler'] as const).map((component) => {
							const res = spec.controlPlane?.resources?.[component]
							if (!res) return null
							return (
								<div key={component} className="p-3 bg-neutral-800/50 rounded-lg">
									<p className="text-xs font-medium text-neutral-400 uppercase mb-2">
										{component === 'apiServer' ? 'API Server' : component === 'controllerManager' ? 'Controller Manager' : 'Scheduler'}
									</p>
									<dl className="space-y-1 text-sm">
										{res.requests?.cpu && (
											<div className="flex justify-between">
												<dt className="text-neutral-500">CPU Request</dt>
												<dd className="text-neutral-300 font-mono">{res.requests.cpu}</dd>
											</div>
										)}
										{res.limits?.cpu && (
											<div className="flex justify-between">
												<dt className="text-neutral-500">CPU Limit</dt>
												<dd className="text-neutral-300 font-mono">{res.limits.cpu}</dd>
											</div>
										)}
										{res.requests?.memory && (
											<div className="flex justify-between">
												<dt className="text-neutral-500">Mem Request</dt>
												<dd className="text-neutral-300 font-mono">{res.requests.memory}</dd>
											</div>
										)}
										{res.limits?.memory && (
											<div className="flex justify-between">
												<dt className="text-neutral-500">Mem Limit</dt>
												<dd className="text-neutral-300 font-mono">{res.limits.memory}</dd>
											</div>
										)}
									</dl>
								</div>
							)
						})}
					</div>
				</Card>
			)}

			{/* Networking */}
			{spec.networking?.loadBalancerPool && (
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Networking</h3>
					<dl className="space-y-3">
						{spec.networking.loadBalancerPool.start && spec.networking.loadBalancerPool.end && (
							<div className="flex justify-between">
								<dt className="text-neutral-400">Load Balancer IP Range</dt>
								<dd className="text-neutral-50 font-mono">
									{spec.networking.loadBalancerPool.start} - {spec.networking.loadBalancerPool.end}
								</dd>
							</div>
						)}
					</dl>
				</Card>
			)}

			{/* Machine Provisioning (only visible when MachineRequests exist) */}
			{machineRequests.length > 0 && (
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">
						Provisioning ({machineRequests.filter(m => m.status?.phase === 'Running').length}/{machineRequests.length} VMs ready)
					</h3>
					<div className="space-y-2">
						{machineRequests.map((machine) => (
							<div key={machine.metadata.name} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
								<div>
									<p className="text-sm text-neutral-200 font-mono">{machine.metadata.name}</p>
									{machine.status?.ipAddress && (
										<p className="text-xs text-neutral-400 mt-0.5">IP: {machine.status.ipAddress}</p>
									)}
								</div>
								<StatusBadge status={machine.status?.phase || 'Pending'} />
							</div>
						))}
					</div>
				</Card>
			)}

			{/* Load Balancer Requests */}
			{loadBalancerRequests.length > 0 && (
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Load Balancer Requests</h3>
					<div className="space-y-3">
						{loadBalancerRequests.map((lb) => (
							<div key={lb.metadata.name} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
								<div>
									<p className="text-sm text-neutral-200 font-mono">{lb.metadata.name}</p>
									{lb.status?.vip && (
										<p className="text-xs text-neutral-400 mt-0.5">VIP: {lb.status.vip}</p>
									)}
								</div>
								<StatusBadge status={lb.status?.phase || 'Pending'} />
							</div>
						))}
					</div>
				</Card>
			)}

			{/* Infrastructure Override */}
			{spec.infrastructureOverride && (
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Infrastructure Override</h3>
					<dl className="space-y-3">
						{spec.infrastructureOverride.harvester && (
							<>
								{spec.infrastructureOverride.harvester.namespace && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Harvester Namespace</dt>
										<dd className="text-neutral-50 font-mono">{spec.infrastructureOverride.harvester.namespace}</dd>
									</div>
								)}
								{spec.infrastructureOverride.harvester.networkName && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Network</dt>
										<dd className="text-neutral-50 font-mono">{spec.infrastructureOverride.harvester.networkName}</dd>
									</div>
								)}
								{spec.infrastructureOverride.harvester.imageName && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Image</dt>
										<dd className="text-neutral-50 font-mono">{spec.infrastructureOverride.harvester.imageName}</dd>
									</div>
								)}
							</>
						)}
						{spec.infrastructureOverride.nutanix && (
							<>
								{spec.infrastructureOverride.nutanix.clusterUUID && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Nutanix Cluster</dt>
										<dd className="text-neutral-50 font-mono text-xs">{spec.infrastructureOverride.nutanix.clusterUUID}</dd>
									</div>
								)}
								{spec.infrastructureOverride.nutanix.subnetUUID && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Subnet</dt>
										<dd className="text-neutral-50 font-mono text-xs">{spec.infrastructureOverride.nutanix.subnetUUID}</dd>
									</div>
								)}
							</>
						)}
					</dl>
				</Card>
			)}

			<NetworkAllocationsCard clusterName={name} clusterNamespace={namespace} />
		</div>
	)
}

function ControlPlaneTab({ tcp }: { tcp: TenantControlPlane | null }) {
	if (!tcp) {
		return (
			<Card className="p-8 text-center">
				<p className="text-neutral-400">Control plane information not available. The cluster may still be provisioning.</p>
			</Card>
		)
	}

	const s = tcp.status

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Control Plane</h3>
					<dl className="space-y-3">
						<div className="flex justify-between">
							<dt className="text-neutral-400">Phase</dt>
							<dd><StatusBadge status={s.phase || 'Unknown'} /></dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-neutral-400">API Server Version</dt>
							<dd className="text-neutral-50 font-mono">{s.version || tcp.specVersion}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-neutral-400">Endpoint</dt>
							<dd className="text-neutral-50 font-mono text-sm">{s.controlPlaneEndpoint || 'N/A'}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-neutral-400">Replicas</dt>
							<dd className="text-neutral-50">{s.readyReplicas}/{s.replicas} ready</dd>
						</div>
						{s.loadBalancerIP && (
							<div className="flex justify-between">
								<dt className="text-neutral-400">LoadBalancer IP</dt>
								<dd className="text-neutral-50 font-mono text-sm">{s.loadBalancerIP}</dd>
							</div>
						)}
						{s.servicePort > 0 && (
							<div className="flex justify-between">
								<dt className="text-neutral-400">Service Port</dt>
								<dd className="text-neutral-50 font-mono">{s.servicePort}</dd>
							</div>
						)}
					</dl>
				</Card>

				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Backend</h3>
					<dl className="space-y-3">
						<div className="flex justify-between">
							<dt className="text-neutral-400">DataStore</dt>
							<dd className="text-neutral-50">{s.dataStoreName || 'N/A'}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-neutral-400">Driver</dt>
							<dd className="text-neutral-50">{s.dataStoreDriver || 'N/A'}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-neutral-400">Konnectivity</dt>
							<dd className="text-neutral-50">{s.konnectivityEnabled ? 'Enabled' : 'Disabled'}</dd>
						</div>
						{s.workerBootstrap?.provider && (
							<>
								<div className="flex justify-between">
									<dt className="text-neutral-400">Bootstrap Provider</dt>
									<dd className="text-neutral-50">{s.workerBootstrap.provider}</dd>
								</div>
								{s.workerBootstrap.endpoint && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Bootstrap Endpoint</dt>
										<dd className="text-neutral-50 font-mono text-sm">{s.workerBootstrap.endpoint}</dd>
									</div>
								)}
							</>
						)}
					</dl>
				</Card>
			</div>

			<Card className="p-5">
				<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Resource Info</h3>
				<dl className="space-y-3">
					<div className="flex justify-between">
						<dt className="text-neutral-400">TCP Name</dt>
						<dd className="text-neutral-50 font-mono text-sm">{tcp.name}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-neutral-400">TCP Namespace</dt>
						<dd className="text-neutral-50 font-mono text-sm">{tcp.namespace}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-neutral-400">Spec Version</dt>
						<dd className="text-neutral-50 font-mono">{tcp.specVersion}</dd>
					</div>
				</dl>
			</Card>
		</div>
	)
}

function NodesTab({ nodes }: { nodes: Node[] }) {
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
