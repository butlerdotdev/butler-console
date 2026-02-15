// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { providersApi, type Provider, type ValidateResponse, type NetworkInfo } from '@/api/providers'
import { Card, Spinner, Button, FadeIn } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'

export function ProvidersPage() {
	useDocumentTitle('Providers')
	const { success, error: showError } = useToast()

	const [providers, setProviders] = useState<Provider[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [validating, setValidating] = useState<string | null>(null)
	const [validationResults, setValidationResults] = useState<Record<string, ValidateResponse>>({})
	const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null)
	const [deleting, setDeleting] = useState(false)
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

	useEffect(() => {
		loadProviders()
	}, [])

	const loadProviders = async () => {
		try {
			setLoading(true)
			const response = await providersApi.list()
			setProviders(response.providers || [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load providers')
		} finally {
			setLoading(false)
		}
	}

	const handleValidate = async (provider: Provider, e?: React.MouseEvent) => {
		e?.stopPropagation()
		const key = `${provider.metadata.namespace}/${provider.metadata.name}`
		setValidating(key)

		try {
			const result = await providersApi.validate(provider.metadata.namespace, provider.metadata.name)
			setValidationResults((prev) => ({ ...prev, [key]: result }))
			if (result.valid) {
				success('Connection Valid', result.message)
			} else {
				showError('Connection Failed', result.message)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Validation failed'
			showError('Validation Error', message)
			setValidationResults((prev) => ({ ...prev, [key]: { valid: false, message } }))
		} finally {
			setValidating(null)
		}
	}

	const handleDelete = async () => {
		if (!deleteTarget) return

		setDeleting(true)
		try {
			await providersApi.delete(deleteTarget.metadata.namespace, deleteTarget.metadata.name)
			success('Provider Deleted', `${deleteTarget.metadata.name} has been deleted`)
			setProviders((prev) => prev.filter(
				(p) => p.metadata.uid !== deleteTarget.metadata.uid
			))
			setDeleteTarget(null)
		} catch (err) {
			showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete provider')
		} finally {
			setDeleting(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">{error}</p>
				<button onClick={loadProviders} className="mt-2 text-sm text-red-400 hover:text-red-300 underline">
					Retry
				</button>
			</div>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Providers</h1>
						<p className="text-neutral-400 mt-1">Infrastructure provider configurations for cluster provisioning</p>
					</div>
					<Link to="/providers/create">
						<Button>
							<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Add Provider
						</Button>
					</Link>
				</div>

				{providers.length === 0 ? (
					<Card className="p-8 text-center">
						<div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
							<svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
							</svg>
						</div>
						<h3 className="text-lg font-medium text-neutral-200 mb-2">No Providers</h3>
						<p className="text-neutral-400 mb-4">Get started by adding your first infrastructure provider.</p>
						<Link to="/providers/create">
							<Button>Add Provider</Button>
						</Link>
					</Card>
				) : (
					<div className="grid gap-4">
						{providers.map((provider) => (
							<ProviderCard
								key={provider.metadata.uid || `${provider.metadata.namespace}/${provider.metadata.name}`}
								provider={provider}
								onValidate={(e) => handleValidate(provider, e)}
								onDelete={(e) => { e.stopPropagation(); setDeleteTarget(provider) }}
								onClick={() => setSelectedProvider(provider)}
								isValidating={validating === `${provider.metadata.namespace}/${provider.metadata.name}`}
								validationResult={validationResults[`${provider.metadata.namespace}/${provider.metadata.name}`]}
							/>
						))}
					</div>
				)}
			</div>

			{/* Provider Detail Modal */}
			<Modal isOpen={!!selectedProvider} onClose={() => setSelectedProvider(null)} size="lg">
				{selectedProvider && (
					<>
						<ModalHeader>
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
									<ProviderLogo provider={selectedProvider.spec.provider} />
								</div>
								<div>
									<h2 className="text-lg font-semibold text-neutral-100">{selectedProvider.metadata.name}</h2>
									<p className="text-sm text-neutral-400">{selectedProvider.metadata.namespace}</p>
								</div>
							</div>
						</ModalHeader>
						<ModalBody>
							<ProviderDetail
								provider={selectedProvider}
								validationResult={validationResults[`${selectedProvider.metadata.namespace}/${selectedProvider.metadata.name}`]}
								onValidate={() => handleValidate(selectedProvider)}
								isValidating={validating === `${selectedProvider.metadata.namespace}/${selectedProvider.metadata.name}`}
							/>
						</ModalBody>
						<ModalFooter>
							<Button variant="secondary" onClick={() => setSelectedProvider(null)}>
								Close
							</Button>
							<Button
								variant="danger"
								onClick={() => { setSelectedProvider(null); setDeleteTarget(selectedProvider) }}
							>
								Delete
							</Button>
						</ModalFooter>
					</>
				)}
			</Modal>

			{/* Delete Confirmation Modal */}
			<Modal isOpen={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
				<ModalHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
							<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</div>
						<div>
							<h2 className="text-lg font-semibold text-neutral-100">Delete Provider</h2>
							<p className="text-sm text-neutral-400">This action cannot be undone</p>
						</div>
					</div>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-300">
						Are you sure you want to delete provider{' '}
						<span className="font-mono font-semibold text-red-400">{deleteTarget?.metadata.name}</span>?
					</p>
					<p className="text-sm text-neutral-500 mt-2">
						This will also delete the associated credentials secret. Any clusters using this provider will not be affected.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleDelete} disabled={deleting}>
						{deleting ? 'Deleting...' : 'Delete Provider'}
					</Button>
				</ModalFooter>
			</Modal>
		</FadeIn>
	)
}

interface ProviderCardProps {
	provider: Provider
	onValidate: (e: React.MouseEvent) => void
	onDelete: (e: React.MouseEvent) => void
	onClick: () => void
	isValidating: boolean
	validationResult?: ValidateResponse
}

function ProviderCard({ provider, onValidate, onDelete, onClick, isValidating, validationResult }: ProviderCardProps) {
	const name = provider.metadata.name
	const namespace = provider.metadata.namespace
	const type = provider.spec.provider || 'unknown'

	const getEndpoint = () => {
		if (provider.spec.credentialsRef?.name) {
			return `Secret: ${provider.spec.credentialsRef.name}`
		}
		if (provider.spec.nutanix?.endpoint) {
			const port = provider.spec.nutanix?.port || 9440
			return `${provider.spec.nutanix.endpoint}:${port}`
		}
		if (provider.spec.proxmox?.endpoint) return provider.spec.proxmox.endpoint
		return 'N/A'
	}

	const createdAt = provider.metadata.creationTimestamp
	const [age] = useState(() => {
		if (!createdAt) return 'Unknown'
		const created = new Date(createdAt)
		const diffMs = Date.now() - created.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
		if (diffDays > 0) return `${diffDays}d ago`
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
		if (diffHours > 0) return `${diffHours}h ago`
		return 'Just now'
	})

	return (
		<Card
			className="p-5 cursor-pointer hover:bg-neutral-800/50 transition-colors"
			onClick={onClick}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
						<ProviderLogo provider={type} />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<p className="font-medium text-neutral-50">{name}</p>
							<span className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded capitalize">
								{type}
							</span>
							{provider.spec.scope?.type && (
								<span className={`px-2 py-0.5 text-xs font-medium rounded ${
									provider.spec.scope.type === 'platform'
										? 'bg-blue-500/10 text-blue-400'
										: 'bg-amber-500/10 text-amber-400'
								}`}>
									{provider.spec.scope.type === 'platform'
										? 'Platform'
										: `Team: ${provider.spec.scope.teamRef?.name || 'unknown'}`}
								</span>
							)}
							{provider.spec.network?.mode && (
								<span className={`px-2 py-0.5 text-xs font-medium rounded ${
									provider.spec.network.mode === 'ipam'
										? 'bg-green-500/10 text-green-400'
										: 'bg-blue-500/10 text-blue-400'
								}`}>
									{provider.spec.network.mode === 'ipam' ? 'IPAM' : 'Cloud'}
								</span>
							)}
						</div>
						<p className="text-sm text-neutral-400">{namespace}</p>
					</div>
				</div>

				<div className="flex items-center gap-6">
					<div className="text-right hidden md:block">
						<p className="text-xs text-neutral-500 uppercase tracking-wide">Endpoint</p>
						<p className="text-sm text-neutral-200 font-mono truncate max-w-[200px]">{getEndpoint()}</p>
					</div>
					<div className="text-right">
						<p className="text-xs text-neutral-500 uppercase tracking-wide">Age</p>
						<p className="text-sm text-neutral-200">{age}</p>
					</div>
					{validationResult && (
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Status</p>
							<p className={`text-sm ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
								{validationResult.valid ? 'Valid' : 'Invalid'}
							</p>
						</div>
					)}
					{provider.status?.capacity?.availableIPs !== undefined && (
						<div className="text-right hidden lg:block">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Available IPs</p>
							<p className="text-sm text-neutral-200">{provider.status.capacity.availableIPs}</p>
						</div>
					)}
					{provider.status?.capacity?.estimatedTenants !== undefined && (
						<div className="text-right hidden lg:block">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Est. Tenants</p>
							<p className="text-sm text-neutral-200">{provider.status.capacity.estimatedTenants}</p>
						</div>
					)}
					<div className="flex items-center gap-2">
						<Button variant="secondary" onClick={onValidate} disabled={isValidating}>
							{isValidating ? 'Testing...' : 'Test'}
						</Button>
						<button
							onClick={onDelete}
							className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
							title="Delete provider"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</div>
				</div>
			</div>
		</Card>
	)
}

function ProviderDetail({
	provider,
	validationResult,
	onValidate,
	isValidating
}: {
	provider: Provider
	validationResult?: ValidateResponse
	onValidate: () => void
	isValidating: boolean
}) {
	const type = provider.spec.provider
	const [networks, setNetworks] = useState<NetworkInfo[]>([])
	const [networksLoading, setNetworksLoading] = useState(false)
	const [networksError, setNetworksError] = useState<string | null>(null)

	useEffect(() => {
		const loadNetworks = async () => {
			setNetworksLoading(true)
			setNetworksError(null)
			try {
				const response = await providersApi.listNetworks(
					provider.metadata.namespace,
					provider.metadata.name
				)
				setNetworks(response.networks || [])
			} catch (err) {
				setNetworksError(err instanceof Error ? err.message : 'Failed to load networks')
			} finally {
				setNetworksLoading(false)
			}
		}
		loadNetworks()
	}, [provider.metadata.namespace, provider.metadata.name])

	const hasNetwork = !!provider.spec.network
	const hasScope = !!provider.spec.scope?.type
	const hasLimits = !!(provider.spec.limits?.maxClustersPerTeam !== undefined || provider.spec.limits?.maxNodesPerTeam !== undefined)
	const hasCapacity = !!(provider.status?.capacity?.availableIPs !== undefined || provider.status?.capacity?.estimatedTenants !== undefined)

	return (
		<div className="space-y-6">
			{/* Connection Status */}
			<div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-neutral-200">Connection Status</p>
						{validationResult ? (
							<p className={`text-sm ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
								{validationResult.message}
							</p>
						) : (
							<p className="text-sm text-neutral-500">Not tested</p>
						)}
					</div>
					<Button variant="secondary" onClick={onValidate} disabled={isValidating}>
						{isValidating ? 'Testing...' : 'Test Connection'}
					</Button>
				</div>
			</div>

			{/* Provider Info */}
			<div>
				<h4 className="text-sm font-medium text-neutral-400 mb-3">Provider Details</h4>
				<div className="grid grid-cols-2 gap-4">
					<InfoRow label="Type" value={type} />
					<InfoRow label="Namespace" value={provider.metadata.namespace} />
					<InfoRow label="Created" value={provider.metadata.creationTimestamp ? new Date(provider.metadata.creationTimestamp).toLocaleString() : 'Unknown'} />
					<InfoRow label="Credentials" value={provider.spec.credentialsRef?.name || 'None'} />
				</div>
			</div>

			{/* Provider-specific details */}
			{type === 'nutanix' && provider.spec.nutanix && (
				<div>
					<h4 className="text-sm font-medium text-neutral-400 mb-3">Nutanix Configuration</h4>
					<div className="grid grid-cols-2 gap-4">
						<InfoRow label="Endpoint" value={provider.spec.nutanix.endpoint || 'N/A'} />
						<InfoRow label="Port" value={String(provider.spec.nutanix.port || 9440)} />
						<InfoRow label="Insecure TLS" value={provider.spec.nutanix.insecure ? 'Yes' : 'No'} />
					</div>
				</div>
			)}

			{type === 'proxmox' && provider.spec.proxmox && (
				<div>
					<h4 className="text-sm font-medium text-neutral-400 mb-3">Proxmox Configuration</h4>
					<div className="grid grid-cols-2 gap-4">
						<InfoRow label="Endpoint" value={provider.spec.proxmox.endpoint || 'N/A'} />
						<InfoRow label="Insecure TLS" value={provider.spec.proxmox.insecure ? 'Yes' : 'No'} />
					</div>
				</div>
			)}

			{type === 'harvester' && (
				<div>
					<h4 className="text-sm font-medium text-neutral-400 mb-3">Harvester Configuration</h4>
					<p className="text-sm text-neutral-500">Connection via kubeconfig</p>
				</div>
			)}

			{/* Network Configuration */}
			{hasNetwork && (
				<div>
					<h4 className="text-sm font-medium text-neutral-400 mb-3">Network Configuration</h4>
					<div className="grid grid-cols-2 gap-4">
						<InfoRow label="Mode" value={provider.spec.network!.mode === 'ipam' ? 'IPAM' : 'Cloud'} />
						{provider.spec.network!.mode === 'ipam' && (
							<>
								{provider.spec.network!.subnet && (
									<InfoRow label="Subnet" value={provider.spec.network!.subnet} />
								)}
								{provider.spec.network!.gateway && (
									<InfoRow label="Gateway" value={provider.spec.network!.gateway} />
								)}
								{provider.spec.network!.dnsServers && provider.spec.network!.dnsServers.length > 0 && (
									<InfoRow label="DNS Servers" value={provider.spec.network!.dnsServers.join(', ')} />
								)}
								{provider.spec.network!.loadBalancer?.defaultPoolSize !== undefined && (
									<InfoRow label="LB Default Pool Size" value={String(provider.spec.network!.loadBalancer.defaultPoolSize)} />
								)}
								{provider.spec.network!.quotaPerTenant?.maxNodeIPs !== undefined && (
									<InfoRow label="Quota: Max Node IPs" value={String(provider.spec.network!.quotaPerTenant.maxNodeIPs)} />
								)}
								{provider.spec.network!.quotaPerTenant?.maxLoadBalancerIPs !== undefined && (
									<InfoRow label="Quota: Max LB IPs" value={String(provider.spec.network!.quotaPerTenant.maxLoadBalancerIPs)} />
								)}
							</>
						)}
					</div>
					{provider.spec.network!.mode === 'ipam' && provider.spec.network!.poolRefs && provider.spec.network!.poolRefs.length > 0 && (
						<div className="mt-4">
							<p className="text-xs text-neutral-500 mb-2">Pool References</p>
							<div className="space-y-1">
								{provider.spec.network!.poolRefs.map((pool) => (
									<div key={pool.name} className="flex items-center gap-2 text-sm text-neutral-200 font-mono">
										<span>{pool.name}</span>
										{pool.priority !== undefined && (
											<span className="text-xs text-neutral-500">(priority: {pool.priority})</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Scope & Limits */}
			{(hasScope || hasLimits) && (
				<div>
					<h4 className="text-sm font-medium text-neutral-400 mb-3">Scope & Limits</h4>
					<div className="grid grid-cols-2 gap-4">
						{hasScope && (
							<InfoRow label="Scope Type" value={provider.spec.scope!.type === 'platform' ? 'Platform' : 'Team'} />
						)}
						{provider.spec.scope?.type === 'team' && provider.spec.scope.teamRef?.name && (
							<InfoRow label="Team Ref" value={provider.spec.scope.teamRef.name} />
						)}
						{provider.spec.limits?.maxClustersPerTeam !== undefined && (
							<InfoRow label="Max Clusters per Team" value={String(provider.spec.limits.maxClustersPerTeam)} />
						)}
						{provider.spec.limits?.maxNodesPerTeam !== undefined && (
							<InfoRow label="Max Nodes per Team" value={String(provider.spec.limits.maxNodesPerTeam)} />
						)}
					</div>
				</div>
			)}

			{/* Capacity */}
			{hasCapacity && (
				<div>
					<h4 className="text-sm font-medium text-neutral-400 mb-3">Capacity</h4>
					<div className="grid grid-cols-2 gap-4">
						{provider.status?.capacity?.availableIPs !== undefined && (
							<InfoRow label="Available IPs" value={String(provider.status.capacity.availableIPs)} />
						)}
						{provider.status?.capacity?.estimatedTenants !== undefined && (
							<InfoRow label="Estimated Tenants" value={String(provider.status.capacity.estimatedTenants)} />
						)}
					</div>
				</div>
			)}

			{/* Provider Networks (legacy) */}
			<div>
				<h4 className="text-sm font-medium text-neutral-400 mb-3">Provider Networks</h4>
				{networksLoading ? (
					<div className="flex items-center gap-2 text-sm text-neutral-500">
						<Spinner size="sm" />
						<span>Loading networks...</span>
					</div>
				) : networksError ? (
					<p className="text-sm text-neutral-500">{networksError}</p>
				) : networks.length === 0 ? (
					<p className="text-sm text-neutral-500">No networks found</p>
				) : (
					<div className="space-y-2">
						{networks.map((network) => (
							<div
								key={network.id || network.name}
								className="flex items-center justify-between p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg"
							>
								<div>
									<p className="text-sm text-neutral-200 font-mono">{network.name}</p>
									{network.description && (
										<p className="text-xs text-neutral-500">{network.description}</p>
									)}
								</div>
								{network.vlan !== undefined && (
									<span className="px-2 py-0.5 text-xs font-medium bg-neutral-700 text-neutral-300 rounded">
										VLAN {network.vlan}
									</span>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs text-neutral-500">{label}</p>
			<p className="text-sm text-neutral-200 font-mono">{value}</p>
		</div>
	)
}

function ProviderLogo({ provider }: { provider: string }) {
	switch (provider.toLowerCase()) {
		case 'harvester':
			return (
				<svg viewBox="0 0 24 24" className="w-6 h-6">
					<rect x="2" y="4" width="20" height="16" rx="3" fill="#00875a" />
					<path d="M5 8h14M5 12h14M5 16h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
				</svg>
			)
		case 'nutanix':
			return (
				<svg viewBox="0 0 24 24" className="w-6 h-6">
					<polygon points="12,2 22,7 22,17 12,22 2,17 2,7" fill="#024DA1" />
					<polygon points="12,6 17,8.5 17,15.5 12,18 7,15.5 7,8.5" fill="#69BE28" />
				</svg>
			)
		case 'proxmox':
			return (
				<svg viewBox="0 0 24 24" className="w-6 h-6">
					<rect x="2" y="2" width="20" height="20" rx="2" fill="#E57000" />
					<path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
				</svg>
			)
		default:
			return (
				<svg viewBox="0 0 24 24" className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
				</svg>
			)
	}
}
