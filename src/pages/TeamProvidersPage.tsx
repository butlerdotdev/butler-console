// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useDocumentTitle } from '@/hooks'
import { providersApi, isCloudProvider, getProviderRegion, getProviderNetwork } from '@/api/providers'
import type { Provider } from '@/api/providers'
import { Card, FadeIn, Spinner, Button, StatusBadge } from '@/components/ui'
import { ProviderIcon } from '@/components/providers/ProviderIcon'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import { ConnectCloudAccountModal } from '@/components/teams/ConnectCloudAccountModal'

const PROVIDER_LABELS: Record<string, string> = {
	aws: 'Amazon Web Services',
	azure: 'Microsoft Azure',
	gcp: 'Google Cloud Platform',
	harvester: 'Harvester',
	nutanix: 'Nutanix',
	proxmox: 'Proxmox',
}

const PROVIDER_SHORT: Record<string, string> = {
	aws: 'AWS',
	azure: 'Azure',
	gcp: 'GCP',
	harvester: 'Harvester',
	nutanix: 'Nutanix',
	proxmox: 'Proxmox',
}

export function TeamProvidersPage() {
	const { currentTeam, currentTeamDisplayName, isTeamAdmin } = useTeamContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Providers` : 'Providers')
	const { success, error: showError } = useToast()

	const [providers, setProviders] = useState<Provider[]>([])
	const [loading, setLoading] = useState(true)
	const [showConnectModal, setShowConnectModal] = useState(false)
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null)
	const [deleting, setDeleting] = useState(false)

	const loadProviders = useCallback(async () => {
		if (!currentTeam) return
		try {
			setLoading(true)
			const data = await providersApi.listTeamProviders(currentTeam)
			setProviders(data.providers || [])
		} catch {
			// Silently handle — empty state will show
		} finally {
			setLoading(false)
		}
	}, [currentTeam])

	useEffect(() => {
		loadProviders()
	}, [loadProviders])

	const handleDelete = async () => {
		if (!deleteTarget || !currentTeam) return
		setDeleting(true)
		try {
			await providersApi.deleteTeamProvider(
				currentTeam,
				deleteTarget.metadata.namespace,
				deleteTarget.metadata.name
			)
			success('Provider Removed', `${deleteTarget.metadata.name} has been disconnected`)
			setProviders((prev) => prev.filter((p) => p.metadata.uid !== deleteTarget.metadata.uid))
			setDeleteTarget(null)
		} catch (err) {
			showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete provider')
		} finally {
			setDeleting(false)
		}
	}

	const handleConnected = () => {
		setShowConnectModal(false)
		loadProviders()
	}

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
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Providers</h1>
						<p className="text-neutral-400 mt-1">
							Infrastructure providers available to this team
						</p>
					</div>
					{isTeamAdmin && (
						<Button onClick={() => setShowConnectModal(true)}>
							Connect Cloud Account
						</Button>
					)}
				</div>

				{/* Provider Grid */}
				{providers.length === 0 ? (
					<Card className="p-12 text-center">
						<div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
							</svg>
						</div>
						<h3 className="text-lg font-medium text-neutral-200 mb-2">No providers configured</h3>
						<p className="text-neutral-500 max-w-md mx-auto">
							{isTeamAdmin
								? 'Connect a cloud account to start deploying clusters, or ask your platform admin to assign a provider.'
								: 'Ask your platform admin to assign a provider or a team admin to connect a cloud account.'}
						</p>
						{isTeamAdmin && (
							<Button className="mt-6" onClick={() => setShowConnectModal(true)}>
								Connect Cloud Account
							</Button>
						)}
					</Card>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
						{providers.map((provider) => (
							<ProviderCard
								key={provider.metadata.uid || provider.metadata.name}
								provider={provider}
								isTeamAdmin={isTeamAdmin}
								onClick={() => setSelectedProvider(provider)}
								onDelete={() => setDeleteTarget(provider)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Provider Detail Modal */}
			<Modal isOpen={!!selectedProvider} onClose={() => setSelectedProvider(null)}>
				{selectedProvider && (
					<ProviderDetailContent provider={selectedProvider} onClose={() => setSelectedProvider(null)} />
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
							<h2 className="text-lg font-semibold text-neutral-100">Disconnect Provider</h2>
							<p className="text-sm text-neutral-400">Remove this cloud account from the team</p>
						</div>
					</div>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-300">
						Are you sure you want to disconnect{' '}
						<span className="font-mono font-semibold text-red-400">{deleteTarget?.metadata.name}</span>?
					</p>
					<p className="text-sm text-neutral-500 mt-2">
						Existing clusters using this provider will not be affected, but no new clusters can be created with it.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleDelete} disabled={deleting}>
						{deleting ? 'Disconnecting...' : 'Disconnect Provider'}
					</Button>
				</ModalFooter>
			</Modal>

			{/* Connect Cloud Account Modal */}
			<ConnectCloudAccountModal
				isOpen={showConnectModal}
				onClose={() => setShowConnectModal(false)}
				onConnected={handleConnected}
				teamName={currentTeam || ''}
			/>
		</FadeIn>
	)
}

function ProviderCard({
	provider,
	isTeamAdmin,
	onClick,
	onDelete,
}: {
	provider: Provider
	isTeamAdmin: boolean
	onClick: () => void
	onDelete: () => void
}) {
	const type = provider.spec.provider
	const isCloud = isCloudProvider(type)
	const region = getProviderRegion(provider)
	const network = getProviderNetwork(provider)
	const scopeType = provider.spec.scope?.type || 'platform'
	const isTeamScoped = scopeType === 'team'
	const isReady = provider.status?.ready
	const networkMode = provider.spec.network?.mode

	return (
		<Card
			className="p-5 hover:border-neutral-700 transition-colors cursor-pointer group"
			onClick={onClick}
		>
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<ProviderIcon type={type} />
					<div>
						<h3 className="text-sm font-semibold text-neutral-100">{provider.metadata.name}</h3>
						<p className="text-xs text-neutral-500">{PROVIDER_LABELS[type] || type}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<StatusBadge status={isReady ? 'Ready' : 'Pending'} />
				</div>
			</div>

			<div className="mt-4 space-y-2">
				{/* Scope Badge */}
				<div className="flex items-center gap-2">
					<span className={`px-2 py-0.5 text-xs font-medium rounded ${
						isTeamScoped
							? 'bg-blue-500/10 text-blue-400'
							: 'bg-green-500/10 text-green-400'
					}`}>
						{isTeamScoped ? 'Team' : 'Platform'}
					</span>
					{networkMode && (
						<span className={`px-2 py-0.5 text-xs font-medium rounded ${
							networkMode === 'cloud'
								? 'bg-purple-500/10 text-purple-400'
								: 'bg-cyan-500/10 text-cyan-400'
						}`}>
							{networkMode === 'cloud' ? 'Cloud Network' : 'IPAM'}
						</span>
					)}
				</div>

				{/* Region + Network */}
				{isCloud && (
					<div className="text-xs text-neutral-400 space-y-1">
						{region && (
							<div className="flex items-center gap-2">
								<span className="text-neutral-500">Region:</span>
								<span className="font-mono">{region}</span>
							</div>
						)}
						{network && (
							<div className="flex items-center gap-2">
								<span className="text-neutral-500">{type === 'aws' ? 'VPC:' : type === 'azure' ? 'VNet:' : 'Network:'}</span>
								<span className="font-mono truncate">{network}</span>
							</div>
						)}
					</div>
				)}

				{/* On-prem capacity */}
				{!isCloud && provider.status?.capacity && (
					<div className="text-xs text-neutral-400">
						<span className="text-neutral-500">Available IPs:</span>{' '}
						{provider.status.capacity.availableIPs?.toLocaleString() || 'N/A'}
					</div>
				)}
			</div>

			{/* Delete button for team-scoped providers */}
			{isTeamScoped && isTeamAdmin && (
				<div className="mt-3 pt-3 border-t border-neutral-800">
					<button
						onClick={(e) => {
							e.stopPropagation()
							onDelete()
						}}
						className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
					>
						Disconnect
					</button>
				</div>
			)}
		</Card>
	)
}

function ProviderDetailContent({ provider, onClose }: { provider: Provider; onClose: () => void }) {
	const type = provider.spec.provider
	const isCloud = isCloudProvider(type)

	return (
		<>
			<ModalHeader>
				<div className="flex items-center gap-3">
					<ProviderIcon type={type} />
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">{provider.metadata.name}</h2>
						<p className="text-sm text-neutral-400">{PROVIDER_LABELS[type] || type}</p>
					</div>
				</div>
			</ModalHeader>
			<ModalBody>
				<div className="space-y-5">
					{/* Status */}
					<div>
						<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Status</h4>
						<div className="flex items-center gap-3">
							<StatusBadge status={provider.status?.ready ? 'Ready' : 'Pending'} />
							<span className={`px-2 py-0.5 text-xs font-medium rounded ${
								provider.spec.scope?.type === 'team'
									? 'bg-blue-500/10 text-blue-400'
									: 'bg-green-500/10 text-green-400'
							}`}>
								{provider.spec.scope?.type === 'team' ? 'Team-Scoped' : 'Platform-Wide'}
							</span>
						</div>
					</div>

					{/* Cloud Config */}
					{type === 'aws' && provider.spec.aws && (
						<div>
							<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">AWS Configuration</h4>
							<dl className="space-y-2">
								<DetailRow label="Region" value={provider.spec.aws.region} />
								<DetailRow label="VPC ID" value={provider.spec.aws.vpcID} mono />
								{provider.spec.aws.subnetIDs && provider.spec.aws.subnetIDs.length > 0 && (
									<DetailRow label="Subnets" value={provider.spec.aws.subnetIDs.join(', ')} mono />
								)}
								{provider.spec.aws.securityGroupIDs && provider.spec.aws.securityGroupIDs.length > 0 && (
									<DetailRow label="Security Groups" value={provider.spec.aws.securityGroupIDs.join(', ')} mono />
								)}
							</dl>
						</div>
					)}

					{type === 'azure' && provider.spec.azure && (
						<div>
							<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Azure Configuration</h4>
							<dl className="space-y-2">
								<DetailRow label="Subscription" value={provider.spec.azure.subscriptionID} mono />
								<DetailRow label="Resource Group" value={provider.spec.azure.resourceGroup} />
								<DetailRow label="Location" value={provider.spec.azure.location} />
								<DetailRow label="VNet" value={provider.spec.azure.vnetName} />
								<DetailRow label="Subnet" value={provider.spec.azure.subnetName} />
							</dl>
						</div>
					)}

					{type === 'gcp' && provider.spec.gcp && (
						<div>
							<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">GCP Configuration</h4>
							<dl className="space-y-2">
								<DetailRow label="Project" value={provider.spec.gcp.projectID} mono />
								<DetailRow label="Region" value={provider.spec.gcp.region} />
								<DetailRow label="Network" value={provider.spec.gcp.network} />
								<DetailRow label="Subnetwork" value={provider.spec.gcp.subnetwork} />
							</dl>
						</div>
					)}

					{/* On-prem Network Config */}
					{!isCloud && provider.spec.network && (
						<div>
							<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Network Configuration</h4>
							<dl className="space-y-2">
								<DetailRow label="Mode" value={provider.spec.network.mode} />
								{provider.spec.network.subnet && <DetailRow label="Subnet" value={provider.spec.network.subnet} />}
								{provider.spec.network.gateway && <DetailRow label="Gateway" value={provider.spec.network.gateway} mono />}
								{provider.spec.network.dnsServers && provider.spec.network.dnsServers.length > 0 && (
									<DetailRow label="DNS" value={provider.spec.network.dnsServers.join(', ')} mono />
								)}
							</dl>
						</div>
					)}

					{/* Limits */}
					{provider.spec.limits && (
						<div>
							<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Limits</h4>
							<dl className="space-y-2">
								{provider.spec.limits.maxClustersPerTeam && (
									<DetailRow label="Max Clusters/Team" value={String(provider.spec.limits.maxClustersPerTeam)} />
								)}
								{provider.spec.limits.maxNodesPerTeam && (
									<DetailRow label="Max Nodes/Team" value={String(provider.spec.limits.maxNodesPerTeam)} />
								)}
							</dl>
						</div>
					)}

					{/* Conditions */}
					{provider.status?.conditions && provider.status.conditions.length > 0 && (
						<div>
							<h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Conditions</h4>
							<div className="space-y-2">
								{provider.status.conditions.map((cond, i) => (
									<div key={i} className="flex items-center justify-between py-1">
										<div className="flex items-center gap-2">
											<StatusBadge status={cond.status === 'True' ? 'Ready' : 'Failed'} />
											<span className="text-sm text-neutral-300">{cond.type}</span>
										</div>
										{cond.message && (
											<span className="text-xs text-neutral-500 truncate max-w-[200px]">{cond.message}</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</ModalBody>
			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>Close</Button>
			</ModalFooter>
		</>
	)
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
	if (!value) return null
	return (
		<div className="flex justify-between">
			<dt className="text-sm text-neutral-400">{label}</dt>
			<dd className={`text-sm text-neutral-100 ${mono ? 'font-mono' : ''}`}>{value}</dd>
		</div>
	)
}

// ProviderIcon is imported from @/components/providers/ProviderIcon
