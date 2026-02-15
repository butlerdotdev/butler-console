// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, providersApi, type Provider, type ImageInfo, type NetworkInfo, isCloudProvider, getProviderRegion, getProviderNetwork } from '@/api'
import { Card, Button, FadeIn, Spinner } from '@/components/ui'
import { parseQuantity } from '@/components/ui/ResourceUsageBar'
import { useToast } from '@/hooks/useToast'
import { useTeamContext } from '@/hooks/useTeamContext'

interface TeamResourceLimits {
	maxClusters?: number
	maxTotalNodes?: number
	maxNodesPerCluster?: number
	maxCPUCores?: string
	maxMemory?: string
	maxStorage?: string
}

interface TeamResourceUsage {
	clusters: number
	totalNodes: number
	totalCPU?: string
	totalMemory?: string
	totalStorage?: string
}

interface QuotaWarning {
	resource: string
	message: string
	severity: 'warning' | 'error'
}

export function CreateClusterPage() {
	useDocumentTitle('Create Cluster')
	const navigate = useNavigate()
	const { success, error: showError } = useToast()
	const { currentTeam, currentTeamNamespace, currentTeamDisplayName, buildPath } = useTeamContext()

	// Providers
	const [providers, setProviders] = useState<Provider[]>([])
	const [loadingProviders, setLoadingProviders] = useState(true)
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

	// Images
	const [images, setImages] = useState<ImageInfo[]>([])
	const [loadingImages, setLoadingImages] = useState(false)

	// Networks
	const [networks, setNetworks] = useState<NetworkInfo[]>([])
	const [loadingNetworks, setLoadingNetworks] = useState(false)

	// Determine namespace based on team context
	// If in team context, use team namespace; otherwise default to butler-tenants
	const defaultNamespace = currentTeamNamespace || 'butler-tenants'

	// Form state
	const [form, setForm] = useState({
		name: '',
		namespace: defaultNamespace,
		kubernetesVersion: 'v1.30.2',
		providerConfigRef: '',
		workerReplicas: 1,
		workerCPU: 4,
		workerMemory: '8Gi',
		workerDiskSize: '50Gi',
		loadBalancerStart: '',
		loadBalancerEnd: '',
		lbPoolSize: '',
		// Harvester-specific
		harvesterNamespace: 'default',
		harvesterNetworkName: '',
		harvesterImageName: '',
		// Nutanix-specific
		nutanixClusterUUID: '',
		nutanixSubnetUUID: '',
		nutanixImageUUID: '',
		nutanixStorageContainerUUID: '',
		// Proxmox-specific
		proxmoxNode: '',
		proxmoxStorage: '',
		proxmoxTemplateID: '',
		// Cloud-specific
		awsSubnet: '',
	})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [useManualIPs, setUseManualIPs] = useState(false)

	// Resource quota state
	const [resourceUsage, setResourceUsage] = useState<TeamResourceUsage | null>(null)
	const [resourceLimits, setResourceLimits] = useState<TeamResourceLimits | null>(null)

	// Fetch team resource usage/limits
	useEffect(() => {
		if (!currentTeam) return
		const fetchQuota = async () => {
			try {
				const response = await fetch(`/api/teams/${currentTeam}`, {
					credentials: 'include',
				})
				if (response.ok) {
					const data = await response.json()
					const team = data.team || data
					const usage = team.resourceUsage || team.status?.resourceUsage
					const limits = team.resourceLimits || team.spec?.resourceLimits
					if (usage) setResourceUsage(usage)
					if (limits) setResourceLimits(limits)
				}
			} catch {
				// Non-critical - quota warnings just won't show
			}
		}
		fetchQuota()
	}, [currentTeam])

	// Compute quota warnings based on current form values and team limits
	const quotaWarnings = useMemo<QuotaWarning[]>(() => {
		if (!resourceLimits || !resourceUsage) return []
		const warnings: QuotaWarning[] = []

		// Cluster count check
		if (resourceLimits.maxClusters != null) {
			const afterCreate = resourceUsage.clusters + 1
			if (afterCreate > resourceLimits.maxClusters) {
				warnings.push({
					resource: 'Clusters',
					message: `Creating this cluster would exceed your limit of ${resourceLimits.maxClusters} clusters (currently using ${resourceUsage.clusters}).`,
					severity: 'error',
				})
			} else {
				const remaining = resourceLimits.maxClusters - afterCreate
				if (remaining <= 1) {
					warnings.push({
						resource: 'Clusters',
						message: `After creating this cluster, you will have ${remaining} cluster${remaining === 1 ? '' : 's'} remaining (limit: ${resourceLimits.maxClusters}).`,
						severity: 'warning',
					})
				}
			}
		}

		const requestedNodes = Number(form.workerReplicas) || 1

		// Total nodes check
		if (resourceLimits.maxTotalNodes != null) {
			const afterCreate = resourceUsage.totalNodes + requestedNodes
			if (afterCreate > resourceLimits.maxTotalNodes) {
				warnings.push({
					resource: 'Total Nodes',
					message: `Adding ${requestedNodes} node${requestedNodes > 1 ? 's' : ''} would exceed your limit of ${resourceLimits.maxTotalNodes} total nodes (currently using ${resourceUsage.totalNodes}).`,
					severity: 'error',
				})
			} else {
				const remaining = resourceLimits.maxTotalNodes - afterCreate
				if (remaining <= 2) {
					warnings.push({
						resource: 'Total Nodes',
						message: `After this cluster, you can allocate ${remaining} more node${remaining === 1 ? '' : 's'} (limit: ${resourceLimits.maxTotalNodes}).`,
						severity: 'warning',
					})
				}
			}
		}

		// Nodes per cluster check
		if (resourceLimits.maxNodesPerCluster != null && requestedNodes > resourceLimits.maxNodesPerCluster) {
			warnings.push({
				resource: 'Nodes per Cluster',
				message: `Requesting ${requestedNodes} nodes exceeds the per-cluster limit of ${resourceLimits.maxNodesPerCluster}.`,
				severity: 'error',
			})
		}

		// CPU check
		if (resourceLimits.maxCPUCores) {
			const limitCPU = parseQuantity(resourceLimits.maxCPUCores)
			const usedCPU = parseQuantity(resourceUsage.totalCPU || '0')
			const requestedCPU = requestedNodes * (Number(form.workerCPU) || 4)
			const afterCreate = usedCPU + requestedCPU
			if (limitCPU > 0 && afterCreate > limitCPU) {
				warnings.push({
					resource: 'CPU',
					message: `Adding ${requestedCPU} CPU cores would exceed your limit of ${resourceLimits.maxCPUCores} (currently using ${resourceUsage.totalCPU || '0'}).`,
					severity: 'error',
				})
			} else if (limitCPU > 0) {
				const remaining = limitCPU - afterCreate
				const pct = Math.round((afterCreate / limitCPU) * 100)
				if (pct >= 80) {
					warnings.push({
						resource: 'CPU',
						message: `After this cluster, you can allocate ${Math.floor(remaining)} more CPU cores (${pct}% of limit used).`,
						severity: 'warning',
					})
				}
			}
		}

		// Memory check
		if (resourceLimits.maxMemory) {
			const limitMem = parseQuantity(resourceLimits.maxMemory)
			const usedMem = parseQuantity(resourceUsage.totalMemory || '0')
			const requestedMem = requestedNodes * parseQuantity(form.workerMemory || '8Gi')
			const afterCreate = usedMem + requestedMem
			if (limitMem > 0 && afterCreate > limitMem) {
				warnings.push({
					resource: 'Memory',
					message: `Adding ${form.workerMemory} x ${requestedNodes} nodes would exceed your memory limit of ${resourceLimits.maxMemory} (currently using ${resourceUsage.totalMemory || '0'}).`,
					severity: 'error',
				})
			} else if (limitMem > 0) {
				const pct = Math.round((afterCreate / limitMem) * 100)
				if (pct >= 80) {
					warnings.push({
						resource: 'Memory',
						message: `This cluster would bring your memory usage to ${pct}% of the limit.`,
						severity: 'warning',
					})
				}
			}
		}

		// Storage check
		if (resourceLimits.maxStorage) {
			const limitStorage = parseQuantity(resourceLimits.maxStorage)
			const usedStorage = parseQuantity(resourceUsage.totalStorage || '0')
			const requestedStorage = requestedNodes * parseQuantity(form.workerDiskSize || '50Gi')
			const afterCreate = usedStorage + requestedStorage
			if (limitStorage > 0 && afterCreate > limitStorage) {
				warnings.push({
					resource: 'Storage',
					message: `Adding ${form.workerDiskSize} x ${requestedNodes} nodes would exceed your storage limit of ${resourceLimits.maxStorage} (currently using ${resourceUsage.totalStorage || '0'}).`,
					severity: 'error',
				})
			} else if (limitStorage > 0) {
				const pct = Math.round((afterCreate / limitStorage) * 100)
				if (pct >= 80) {
					warnings.push({
						resource: 'Storage',
						message: `This cluster would bring your storage usage to ${pct}% of the limit.`,
						severity: 'warning',
					})
				}
			}
		}

		return warnings
	}, [resourceUsage, resourceLimits, form.workerReplicas, form.workerCPU, form.workerMemory, form.workerDiskSize])

	const hasQuotaErrors = quotaWarnings.some(w => w.severity === 'error')

	// Update namespace when team context changes
	useEffect(() => {
		setForm(prev => ({
			...prev,
			namespace: currentTeamNamespace || 'butler-tenants'
		}))
	}, [currentTeamNamespace])

	const loadProviders = useCallback(async () => {
		try {
			const response = await providersApi.list()
			setProviders(response.providers || [])
			// Auto-select first provider
			if (response.providers?.length > 0) {
				const first = response.providers[0]
				setSelectedProvider(first)
				setForm(prev => ({ ...prev, providerConfigRef: first.metadata.name }))
			}
		} catch {
			showError('Error', 'Failed to load providers')
		} finally {
			setLoadingProviders(false)
		}
	}, [showError])

	useEffect(() => {
		loadProviders()
	}, [loadProviders])

	// Fetch images and networks when provider changes
	useEffect(() => {
		if (!selectedProvider) {
			setImages([])
			setNetworks([])
			return
		}

		const ns = selectedProvider.metadata.namespace || 'butler-system'
		const providerType = selectedProvider.spec.provider

		// Cloud providers don't need image/network listings from the provider
		if (isCloudProvider(providerType)) return

		// Fetch images
		const fetchImages = async () => {
			setLoadingImages(true)
			try {
				const response = await providersApi.listImages(ns, selectedProvider.metadata.name)
				setImages(response.images || [])

				// Auto-select first non-Talos image for tenant clusters
				const defaultImage = response.images?.find(i => i.os && i.os !== 'talos') || response.images?.[0]
				if (defaultImage) {
					if (providerType === 'harvester') {
						setForm(prev => ({ ...prev, harvesterImageName: defaultImage.id }))
					} else if (providerType === 'nutanix') {
						setForm(prev => ({ ...prev, nutanixImageUUID: defaultImage.id }))
					}
				}
			} catch (err) {
				console.error('Failed to fetch images:', err)
			} finally {
				setLoadingImages(false)
			}
		}

		// Fetch networks
		const fetchNetworks = async () => {
			setLoadingNetworks(true)
			try {
				const response = await providersApi.listNetworks(ns, selectedProvider.metadata.name)
				setNetworks(response.networks || [])

				// Auto-select first network
				if (response.networks?.length > 0) {
					const defaultNetwork = response.networks[0]
					if (providerType === 'harvester') {
						setForm(prev => ({ ...prev, harvesterNetworkName: defaultNetwork.id }))
					} else if (providerType === 'nutanix') {
						setForm(prev => ({ ...prev, nutanixSubnetUUID: defaultNetwork.id }))
					}
				}
			} catch (err) {
				console.error('Failed to fetch networks:', err)
			} finally {
				setLoadingNetworks(false)
			}
		}

		fetchImages()
		fetchNetworks()
	}, [selectedProvider])

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target
		setForm(prev => ({ ...prev, [name]: value }))
	}

	const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const providerName = e.target.value
		const provider = providers.find(p => p.metadata.name === providerName) || null
		setSelectedProvider(provider)
		setUseManualIPs(false)
		setForm(prev => ({
			...prev,
			providerConfigRef: providerName,
			// Reset provider-specific fields when provider changes
			harvesterImageName: '',
			harvesterNetworkName: '',
			nutanixImageUUID: '',
			nutanixSubnetUUID: '',
			awsSubnet: '',
		}))
	}

	const providerType = selectedProvider?.spec.provider || ''
	const isIpamMode = selectedProvider?.spec.network?.mode === 'ipam'
	const isCloudMode = selectedProvider?.spec.network?.mode === 'cloud'

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		if (!form.name) {
			setError('Cluster name is required')
			return
		}
		if (!form.providerConfigRef) {
			setError('Provider is required')
			return
		}
		// Validate LB IPs based on networking mode
		const needsManualIPs = !isCloudMode && (!isIpamMode || useManualIPs)
		if (needsManualIPs && (!form.loadBalancerStart || !form.loadBalancerEnd)) {
			setError('Load balancer IP range is required')
			return
		}

		// Validate provider-specific fields
		if (providerType === 'harvester') {
			if (!form.harvesterNetworkName) {
				setError('Network is required for Harvester')
				return
			}
			if (!form.harvesterImageName) {
				setError('OS Image is required for Harvester')
				return
			}
		}
		if (providerType === 'nutanix') {
			if (!form.nutanixClusterUUID || !form.nutanixSubnetUUID) {
				setError('Cluster UUID and Subnet are required for Nutanix')
				return
			}
		}
		if (providerType === 'proxmox') {
			if (!form.proxmoxNode || !form.proxmoxStorage) {
				setError('Node and Storage are required for Proxmox')
				return
			}
		}

		try {
			setLoading(true)

			const payload: Record<string, unknown> = {
				name: form.name,
				namespace: form.namespace,
				kubernetesVersion: form.kubernetesVersion,
				providerConfigRef: form.providerConfigRef,
				workerReplicas: Number(form.workerReplicas),
				workerCPU: Number(form.workerCPU),
				workerMemory: form.workerMemory,
				workerDiskSize: form.workerDiskSize,
			}

			// Include LB IPs for manual mode or IPAM with BYO override
			if (!isCloudMode && (!isIpamMode || (useManualIPs && form.loadBalancerStart && form.loadBalancerEnd))) {
				if (!isIpamMode || useManualIPs) {
					payload.loadBalancerStart = form.loadBalancerStart
					payload.loadBalancerEnd = form.loadBalancerEnd
				}
			}
			if (isIpamMode && form.lbPoolSize) {
				payload.lbPoolSize = Number(form.lbPoolSize)
			}

			// If in team context, include teamRef
			if (currentTeam) {
				payload.teamRef = currentTeam // currentTeam is the team name string
			}

			// Add provider-specific fields
			if (providerType === 'harvester') {
				payload.harvesterNamespace = form.harvesterNamespace
				payload.harvesterNetworkName = form.harvesterNetworkName
				payload.harvesterImageName = form.harvesterImageName
			} else if (providerType === 'nutanix') {
				payload.nutanixClusterUUID = form.nutanixClusterUUID
				payload.nutanixSubnetUUID = form.nutanixSubnetUUID
				if (form.nutanixImageUUID) payload.nutanixImageUUID = form.nutanixImageUUID
				if (form.nutanixStorageContainerUUID) payload.nutanixStorageContainerUUID = form.nutanixStorageContainerUUID
			} else if (providerType === 'proxmox') {
				payload.proxmoxNode = form.proxmoxNode
				payload.proxmoxStorage = form.proxmoxStorage
				if (form.proxmoxTemplateID) payload.proxmoxTemplateID = Number(form.proxmoxTemplateID)
			} else if (isCloudProvider(providerType)) {
				payload.cloudProvider = providerType
				if (form.awsSubnet) payload.awsSubnet = form.awsSubnet
			}

			await clustersApi.create(payload as unknown as Parameters<typeof clustersApi.create>[0])
			success('Cluster Created', `${form.name} is being provisioned`)
			navigate(buildPath(`/clusters/${form.namespace}/${form.name}`))
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create cluster'
			setError(message)
			showError('Creation Failed', message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<FadeIn>
			<div className="max-w-2xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-neutral-50">Create Cluster</h1>
					<p className="text-neutral-400 mt-1">
						Deploy a new tenant Kubernetes cluster
						{currentTeam && (
							<span className="text-green-500"> for {currentTeamDisplayName || currentTeam}</span>
						)}
					</p>
				</div>

				<form onSubmit={handleSubmit}>
					<Card className="p-6 space-y-6">
						{/* Basic Info */}
						<div>
							<h3 className="text-lg font-medium text-neutral-50 mb-4">Basic Information</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Cluster Name *
									</label>
									<input
										type="text"
										name="name"
										value={form.name}
										onChange={handleChange}
										placeholder="my-cluster"
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Namespace
										{currentTeam && <span className="text-xs text-neutral-500 ml-1">(from team)</span>}
									</label>
									<input
										type="text"
										name="namespace"
										value={form.namespace}
										onChange={handleChange}
										disabled={!!currentTeam} // Disable if in team context
										className={`w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 ${currentTeam ? 'opacity-60 cursor-not-allowed' : ''
											}`}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Kubernetes Version
									</label>
									<select
										name="kubernetesVersion"
										value={form.kubernetesVersion}
										onChange={handleChange}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									>
										<option value="v1.30.2">v1.30.2</option>
										<option value="v1.29.6">v1.29.6</option>
										<option value="v1.28.11">v1.28.11</option>
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Provider *
									</label>
									{loadingProviders ? (
										<div className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center">
											<Spinner size="sm" className="mr-2" />
											<span className="text-neutral-400">Loading...</span>
										</div>
									) : providers.length === 0 ? (
										<div className="text-sm text-red-400">
											No providers configured.{' '}
											<a href="/admin/providers/create" className="underline">Add one</a>
										</div>
									) : (
										<select
											value={form.providerConfigRef}
											onChange={handleProviderChange}
											className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
										>
											{providers.map((p) => (
												<option key={p.metadata.uid || p.metadata.name} value={p.metadata.name}>
													{p.metadata.name} ({p.spec.provider})
												</option>
											))}
										</select>
									)}
								</div>
							</div>
						</div>

						{/* Provider-specific Infrastructure Settings */}
						{selectedProvider && (
							<div>
								<h3 className="text-lg font-medium text-neutral-50 mb-4">
									Infrastructure ({isCloudProvider(providerType) ? providerType.toUpperCase() : providerType})
								</h3>

								{providerType === 'harvester' && (
									<HarvesterFields
										form={form}
										onChange={handleChange}
										images={images}
										loadingImages={loadingImages}
										networks={networks}
										loadingNetworks={loadingNetworks}
									/>
								)}

								{providerType === 'nutanix' && (
									<NutanixFields
										form={form}
										onChange={handleChange}
										images={images}
										loadingImages={loadingImages}
										networks={networks}
										loadingNetworks={loadingNetworks}
									/>
								)}

								{providerType === 'proxmox' && (
									<ProxmoxFields form={form} onChange={handleChange} provider={selectedProvider} />
								)}

								{isCloudProvider(providerType) && (
									<CloudProviderFields form={form} onChange={handleChange} provider={selectedProvider} />
								)}
							</div>
						)}

						{/* Worker Nodes */}
						<div>
							<h3 className="text-lg font-medium text-neutral-50 mb-4">Worker Nodes</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Replicas
									</label>
									<input
										type="number"
										name="workerReplicas"
										value={form.workerReplicas}
										onChange={handleChange}
										min={1}
										max={10}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										CPU (cores)
									</label>
									<input
										type="number"
										name="workerCPU"
										value={form.workerCPU}
										onChange={handleChange}
										min={1}
										max={32}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Memory
									</label>
									<select
										name="workerMemory"
										value={form.workerMemory}
										onChange={handleChange}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									>
										<option value="4Gi">4 GB</option>
										<option value="8Gi">8 GB</option>
										<option value="16Gi">16 GB</option>
										<option value="32Gi">32 GB</option>
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Disk Size
									</label>
									<select
										name="workerDiskSize"
										value={form.workerDiskSize}
										onChange={handleChange}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									>
										<option value="25Gi">25 GB</option>
										<option value="50Gi">50 GB</option>
										<option value="100Gi">100 GB</option>
										<option value="200Gi">200 GB</option>
									</select>
								</div>
							</div>
						</div>

						{/* Networking */}
						<div>
							<h3 className="text-lg font-medium text-neutral-50 mb-4">Networking</h3>
							{isCloudMode ? (
								<div className="space-y-3">
									<div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
										<p className="text-sm text-blue-400">
											This provider uses cloud-native networking. Load balancers and IP addresses are managed by {providerType.toUpperCase()} automatically.
										</p>
									</div>
									{selectedProvider && (
										<div className="grid grid-cols-2 gap-3">
											{getProviderRegion(selectedProvider) && (
												<div className="p-3 bg-neutral-800/50 rounded-lg">
													<p className="text-xs text-neutral-500">Region</p>
													<p className="text-sm text-neutral-200 font-mono">{getProviderRegion(selectedProvider)}</p>
												</div>
											)}
											{getProviderNetwork(selectedProvider) && (
												<div className="p-3 bg-neutral-800/50 rounded-lg">
													<p className="text-xs text-neutral-500">{providerType === 'aws' ? 'VPC' : providerType === 'azure' ? 'VNet' : 'Network'}</p>
													<p className="text-sm text-neutral-200 font-mono">{getProviderNetwork(selectedProvider)}</p>
												</div>
											)}
										</div>
									)}
								</div>
							) : isIpamMode ? (
								<div className="space-y-4">
									{!useManualIPs ? (
										<>
											<div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
												<p className="text-sm text-green-400">
													This provider uses IPAM mode. Node and load balancer IPs will be automatically allocated from network pools.
												</p>
											</div>
											<div>
												<label className="block text-sm font-medium text-neutral-400 mb-1">
													LB Pool Size Override
												</label>
												<input
													type="number"
													name="lbPoolSize"
													value={form.lbPoolSize}
													onChange={handleChange}
													placeholder="Uses provider default"
													min={1}
													className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
												/>
												<p className="text-xs text-neutral-500 mt-1">
													Number of load balancer IPs to allocate. Leave empty to use the provider default.
												</p>
											</div>
											<button
												type="button"
												onClick={() => setUseManualIPs(true)}
												className="text-sm text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
											>
												Need to specify IPs manually?
											</button>
										</>
									) : (
										<>
											<div>
												<label className="block text-sm font-medium text-neutral-400 mb-1">
													LB Pool Size Override
												</label>
												<input
													type="number"
													name="lbPoolSize"
													value={form.lbPoolSize}
													onChange={handleChange}
													placeholder="Uses provider default"
													min={1}
													className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
												/>
												<p className="text-xs text-neutral-500 mt-1">
													Number of load balancer IPs to allocate. Leave empty to use the provider default.
												</p>
											</div>
											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-medium text-neutral-400 mb-1">
														Load Balancer Start IP *
													</label>
													<input
														type="text"
														name="loadBalancerStart"
														value={form.loadBalancerStart}
														onChange={handleChange}
														placeholder="10.40.1.100"
														className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-neutral-400 mb-1">
														Load Balancer End IP *
													</label>
													<input
														type="text"
														name="loadBalancerEnd"
														value={form.loadBalancerEnd}
														onChange={handleChange}
														placeholder="10.40.1.150"
														className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
													/>
												</div>
											</div>
											<button
												type="button"
												onClick={() => setUseManualIPs(false)}
												className="text-sm text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
											>
												Use automatic IPAM allocation
											</button>
										</>
									)}
								</div>
							) : (
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-neutral-400 mb-1">
											Load Balancer Start IP *
										</label>
										<input
											type="text"
											name="loadBalancerStart"
											value={form.loadBalancerStart}
											onChange={handleChange}
											placeholder="10.40.1.100"
											className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-neutral-400 mb-1">
											Load Balancer End IP *
										</label>
										<input
											type="text"
											name="loadBalancerEnd"
											value={form.loadBalancerEnd}
											onChange={handleChange}
											placeholder="10.40.1.150"
											className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
										/>
									</div>
								</div>
							)}
						</div>

						{/* Quota Warnings */}
						{quotaWarnings.length > 0 && (
							<div className="space-y-2">
								{quotaWarnings.filter(w => w.severity === 'error').map((w) => (
									<div key={w.resource} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
										<svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
										</svg>
										<div>
											<p className="text-red-400 text-sm font-medium">{w.resource} limit exceeded</p>
											<p className="text-red-400/80 text-sm">{w.message}</p>
										</div>
									</div>
								))}
								{quotaWarnings.filter(w => w.severity === 'warning').map((w) => (
									<div key={w.resource} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
										<svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<div>
											<p className="text-amber-400 text-sm font-medium">{w.resource} approaching limit</p>
											<p className="text-amber-400/80 text-sm">{w.message}</p>
										</div>
									</div>
								))}
							</div>
						)}

						{/* Error */}
						{error && (
							<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
								<p className="text-red-400 text-sm">{error}</p>
							</div>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
							<Button type="button" variant="secondary" onClick={() => navigate(buildPath('/clusters'))}>
								Cancel
							</Button>
							<Button type="submit" disabled={loading || providers.length === 0 || hasQuotaErrors}>
								{loading ? 'Creating...' : 'Create Cluster'}
							</Button>
						</div>
					</Card>
				</form>
			</div>
		</FadeIn>
	)
}

interface FieldProps {
	form: Record<string, unknown>
	onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

interface FieldPropsWithResources extends FieldProps {
	images: ImageInfo[]
	loadingImages: boolean
	networks: NetworkInfo[]
	loadingNetworks: boolean
}

function HarvesterFields({ form, onChange, images, loadingImages, networks, loadingNetworks }: FieldPropsWithResources) {
	return (
		<div className="grid grid-cols-2 gap-4">
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Harvester Namespace
				</label>
				<input
					type="text"
					name="harvesterNamespace"
					value={form.harvesterNamespace as string}
					onChange={onChange}
					placeholder="default"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Network *
				</label>
				{loadingNetworks ? (
					<div className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center">
						<Spinner size="sm" className="mr-2" />
						<span className="text-neutral-400">Loading networks...</span>
					</div>
				) : networks.length > 0 ? (
					<select
						name="harvesterNetworkName"
						value={form.harvesterNetworkName as string}
						onChange={onChange}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						<option value="">Select network...</option>
						{networks.map((net) => (
							<option key={net.id} value={net.id}>
								{net.name} {net.vlan ? `(VLAN ${net.vlan})` : ''}
							</option>
						))}
					</select>
				) : (
					<input
						type="text"
						name="harvesterNetworkName"
						value={form.harvesterNetworkName as string}
						onChange={onChange}
						placeholder="default/vlan40-workloads"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				)}
				<p className="text-xs text-neutral-500 mt-1">VM network for worker nodes</p>
			</div>
			<div className="col-span-2">
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					OS Image *
				</label>
				{loadingImages ? (
					<div className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center">
						<Spinner size="sm" className="mr-2" />
						<span className="text-neutral-400">Loading images...</span>
					</div>
				) : images.length > 0 ? (
					<select
						name="harvesterImageName"
						value={form.harvesterImageName as string}
						onChange={onChange}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						<option value="">Select image...</option>
						{images.map((img) => (
							<option key={img.id} value={img.id}>
								{img.name} {img.os && `(${img.os})`}
							</option>
						))}
					</select>
				) : (
					<input
						type="text"
						name="harvesterImageName"
						value={form.harvesterImageName as string}
						onChange={onChange}
						placeholder="default/rocky-9.4"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				)}
				<p className="text-xs text-neutral-500 mt-1">
					Select Rocky Linux or Ubuntu for tenant clusters (not Talos)
				</p>
			</div>
		</div>
	)
}

function NutanixFields({ form, onChange, images, loadingImages, networks, loadingNetworks }: FieldPropsWithResources) {
	return (
		<div className="grid grid-cols-2 gap-4">
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Cluster UUID *
				</label>
				<input
					type="text"
					name="nutanixClusterUUID"
					value={form.nutanixClusterUUID as string}
					onChange={onChange}
					placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Subnet *
				</label>
				{loadingNetworks ? (
					<div className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center">
						<Spinner size="sm" className="mr-2" />
						<span className="text-neutral-400">Loading subnets...</span>
					</div>
				) : networks.length > 0 ? (
					<select
						name="nutanixSubnetUUID"
						value={form.nutanixSubnetUUID as string}
						onChange={onChange}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						<option value="">Select subnet...</option>
						{networks.map((net) => (
							<option key={net.id} value={net.id}>
								{net.name} {net.vlan ? `(VLAN ${net.vlan})` : ''}
							</option>
						))}
					</select>
				) : (
					<input
						type="text"
						name="nutanixSubnetUUID"
						value={form.nutanixSubnetUUID as string}
						onChange={onChange}
						placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				)}
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Image
				</label>
				{loadingImages ? (
					<div className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center">
						<Spinner size="sm" className="mr-2" />
						<span className="text-neutral-400">Loading images...</span>
					</div>
				) : images.length > 0 ? (
					<select
						name="nutanixImageUUID"
						value={form.nutanixImageUUID as string}
						onChange={onChange}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						<option value="">Select image (optional)...</option>
						{images.map((img) => (
							<option key={img.id} value={img.id}>
								{img.name} {img.os && `(${img.os})`}
							</option>
						))}
					</select>
				) : (
					<input
						type="text"
						name="nutanixImageUUID"
						value={form.nutanixImageUUID as string}
						onChange={onChange}
						placeholder="Optional, uses provider default"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				)}
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Storage Container UUID
				</label>
				<input
					type="text"
					name="nutanixStorageContainerUUID"
					value={form.nutanixStorageContainerUUID as string}
					onChange={onChange}
					placeholder="Optional"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
		</div>
	)
}

function CloudProviderFields({ form, onChange, provider }: FieldProps & { provider: Provider }) {
	const cloudType = provider.spec.provider
	const region = getProviderRegion(provider)
	const network = getProviderNetwork(provider)
	const awsSubnets = provider.spec.aws?.subnetIDs || []
	const awsSecurityGroups = provider.spec.aws?.securityGroupIDs || []

	return (
		<div className="space-y-4">
			{/* Cloud provider info card */}
			<div className="p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg space-y-3">
				<div className="flex items-center gap-2">
					{cloudType === 'aws' && (
						<span className="text-[#FF9900] font-semibold text-sm">AWS</span>
					)}
					{cloudType === 'azure' && (
						<span className="text-[#0078D4] font-semibold text-sm">Azure</span>
					)}
					{cloudType === 'gcp' && (
						<span className="text-[#4285F4] font-semibold text-sm">GCP</span>
					)}
					<span className="text-neutral-400 text-sm">Cloud Infrastructure</span>
				</div>
				<div className="grid grid-cols-2 gap-3">
					{region && (
						<div>
							<p className="text-xs text-neutral-500">Region</p>
							<p className="text-sm text-neutral-200 font-mono">{region}</p>
						</div>
					)}
					{network && (
						<div>
							<p className="text-xs text-neutral-500">
								{cloudType === 'aws' ? 'VPC' : cloudType === 'azure' ? 'VNet' : 'VPC Network'}
							</p>
							<p className="text-sm text-neutral-200 font-mono">{network}</p>
						</div>
					)}
					{cloudType === 'azure' && provider.spec.azure?.resourceGroup && (
						<div>
							<p className="text-xs text-neutral-500">Resource Group</p>
							<p className="text-sm text-neutral-200 font-mono">{provider.spec.azure.resourceGroup}</p>
						</div>
					)}
					{cloudType === 'azure' && provider.spec.azure?.subscriptionID && (
						<div>
							<p className="text-xs text-neutral-500">Subscription</p>
							<p className="text-sm text-neutral-200 font-mono truncate">{provider.spec.azure.subscriptionID}</p>
						</div>
					)}
					{cloudType === 'gcp' && provider.spec.gcp?.projectID && (
						<div>
							<p className="text-xs text-neutral-500">Project</p>
							<p className="text-sm text-neutral-200 font-mono">{provider.spec.gcp.projectID}</p>
						</div>
					)}
				</div>
				{awsSecurityGroups.length > 0 && (
					<div>
						<p className="text-xs text-neutral-500 mb-1">Security Groups</p>
						<div className="flex flex-wrap gap-1">
							{awsSecurityGroups.map(sg => (
								<span key={sg} className="text-xs font-mono bg-neutral-700/50 text-neutral-300 px-2 py-0.5 rounded">{sg}</span>
							))}
						</div>
					</div>
				)}
			</div>

			{/* AWS subnet selection when multiple subnets available */}
			{cloudType === 'aws' && awsSubnets.length > 1 && (
				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-1">
						Subnet
					</label>
					<select
						name="awsSubnet"
						value={form.awsSubnet as string}
						onChange={onChange}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						<option value="">Auto-select (provider default)</option>
						{awsSubnets.map(subnet => (
							<option key={subnet} value={subnet}>{subnet}</option>
						))}
					</select>
					<p className="text-xs text-neutral-500 mt-1">
						Select a specific subnet or let the provider choose automatically.
					</p>
				</div>
			)}

			{/* GCP subnetwork selection */}
			{cloudType === 'gcp' && provider.spec.gcp?.subnetwork && (
				<div>
					<p className="text-xs text-neutral-500">Subnetwork</p>
					<p className="text-sm text-neutral-200 font-mono">{provider.spec.gcp.subnetwork}</p>
				</div>
			)}

			{/* Azure subnet */}
			{cloudType === 'azure' && provider.spec.azure?.subnetName && (
				<div>
					<p className="text-xs text-neutral-500">Subnet</p>
					<p className="text-sm text-neutral-200 font-mono">{provider.spec.azure.subnetName}</p>
				</div>
			)}
		</div>
	)
}

function ProxmoxFields({ form, onChange, provider }: FieldProps & { provider: Provider }) {
	// If provider has nodes defined, show as dropdown
	const nodes = provider.spec.proxmox?.nodes || []

	return (
		<div className="grid grid-cols-2 gap-4">
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Node *
				</label>
				{nodes.length > 0 ? (
					<select
						name="proxmoxNode"
						value={form.proxmoxNode as string}
						onChange={onChange}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						<option value="">Select node...</option>
						{nodes.map((node) => (
							<option key={node} value={node}>{node}</option>
						))}
					</select>
				) : (
					<input
						type="text"
						name="proxmoxNode"
						value={form.proxmoxNode as string}
						onChange={onChange}
						placeholder="pve1"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				)}
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Storage *
				</label>
				<input
					type="text"
					name="proxmoxStorage"
					value={form.proxmoxStorage as string}
					onChange={onChange}
					placeholder="local-lvm"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Template ID
				</label>
				<input
					type="number"
					name="proxmoxTemplateID"
					value={form.proxmoxTemplateID as string}
					onChange={onChange}
					placeholder="9000 (optional)"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
		</div>
	)
}
