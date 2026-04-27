// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, providersApi, apiClient, type Provider, type ImageInfo, type NetworkInfo, type ClusterInfo, type StorageContainerInfo, isCloudProvider, getProviderRegion, getProviderNetwork } from '@/api'
import { Card, Button, FadeIn, Spinner } from '@/components/ui'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/SearchableSelect'
import { parseQuantity } from '@/components/ui/ResourceUsageBar'
import { useToast } from '@/hooks/useToast'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useEnvContext } from '@/hooks/useEnvContext'
import { useAuth } from '@/hooks/useAuth'
import { SUPPORTED_K8S_VERSIONS } from '@/lib/versions'
import { ENVIRONMENT_LABEL } from '@/types/environments'
import { extractWebhookDenial } from '@/lib/webhookError'

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
	const [searchParams] = useSearchParams()
	const returnTo = searchParams.get('returnTo')
	const { success, error: showError } = useToast()
	const { currentTeam, currentTeamNamespace, currentTeamDisplayName, buildPath } = useTeamContext()
	const { currentEnv, availableEnvs } = useEnvContext()

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

	// Nutanix clusters
	const [nutanixClusters, setNutanixClusters] = useState<ClusterInfo[]>([])
	const [loadingClusters, setLoadingClusters] = useState(false)

	// Nutanix storage containers
	const [storageContainers, setStorageContainers] = useState<StorageContainerInfo[]>([])
	const [loadingStorageContainers, setLoadingStorageContainers] = useState(false)

	// Determine namespace based on team context
	// If in team context, use team namespace; otherwise default to butler-tenants
	const defaultNamespace = currentTeamNamespace || 'butler-tenants'

	// Form state
	const [form, setForm] = useState({
		name: '',
		namespace: defaultNamespace,
		kubernetesVersion: SUPPORTED_K8S_VERSIONS[0],
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
		// Image schematic (optional)
		schematicID: '',
		// NTP time servers (optional, comma-separated)
		timeServers: '',
		// Control plane resources (optional)
		cpApiServerCpuReq: '',
		cpApiServerMemReq: '',
		cpApiServerCpuLim: '',
		cpApiServerMemLim: '',
		cpCMCpuReq: '',
		cpCMMemReq: '',
		cpCMCpuLim: '',
		cpCMMemLim: '',
		cpSchedulerCpuReq: '',
		cpSchedulerMemReq: '',
		cpSchedulerCpuLim: '',
		cpSchedulerMemLim: '',
	})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [envFieldError, setEnvFieldError] = useState<string | null>(null)
	const [useManualIPs, setUseManualIPs] = useState(false)
	const [showAdvancedCP, setShowAdvancedCP] = useState(false)

	// Environment selector state. Required when the team defines any env;
	// hidden otherwise. Default is the current env from the switcher if
	// set, else the first alphabetical env on the team. availableEnvs is
	// already sorted alphabetically by EnvProvider.
	const [selectedEnv, setSelectedEnv] = useState<string>('')
	useEffect(() => {
		if (availableEnvs.length === 0) {
			setSelectedEnv('')
			return
		}
		if (currentEnv && availableEnvs.some((e) => e.name === currentEnv)) {
			setSelectedEnv(currentEnv)
			return
		}
		setSelectedEnv((prev) => (prev && availableEnvs.some((e) => e.name === prev) ? prev : availableEnvs[0].name))
	}, [availableEnvs, currentEnv])
	const envRequired = availableEnvs.length > 0

	// Per-member cap visibility. When the selected env has
	// maxClustersPerMember > 0, fetch the team's clusters and count the
	// ones this user already owns in this env so we can tell them
	// before they submit. The webhook is still the authoritative gate.
	const { user } = useAuth()
	const sessionEmail = (user?.email ?? '').toLowerCase()
	const [ownedInEnv, setOwnedInEnv] = useState<number | null>(null)
	useEffect(() => {
		setOwnedInEnv(null)
		if (!currentTeam || !selectedEnv || !sessionEmail) return
		const envDef = availableEnvs.find((e) => e.name === selectedEnv)
		if (!envDef?.limits?.maxClustersPerMember) return
		let cancelled = false
		void (async () => {
			try {
				const res = await fetch(`/api/teams/${encodeURIComponent(currentTeam)}/clusters`, {
					credentials: 'include',
				})
				if (!res.ok) return
				const data: { clusters?: Array<{ metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> } }> } = await res.json()
				if (cancelled) return
				const count = (data.clusters ?? []).filter((c) => {
					if (c.metadata?.labels?.[ENVIRONMENT_LABEL] !== selectedEnv) return false
					const owner = (
						c.metadata?.annotations?.['butler.butlerlabs.dev/owner'] ??
						c.metadata?.annotations?.['butler.butlerlabs.dev/creator-email'] ??
						''
					).toLowerCase()
					return owner === sessionEmail
				}).length
				setOwnedInEnv(count)
			} catch {
				setOwnedInEnv(null)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [currentTeam, selectedEnv, availableEnvs, sessionEmail])

	const selectedEnvPerMemberCap =
		availableEnvs.find((e) => e.name === selectedEnv)?.limits?.maxClustersPerMember ?? null
	const atPerMemberCap =
		selectedEnvPerMemberCap != null &&
		ownedInEnv != null &&
		ownedInEnv >= selectedEnvPerMemberCap

	// Resource quota state
	const [resourceUsage, setResourceUsage] = useState<TeamResourceUsage | null>(null)
	const [resourceLimits, setResourceLimits] = useState<TeamResourceLimits | null>(null)

	// Team-level clusterDefaults. Merged with env.clusterDefaults below
	// to pre-fill the worker / k8s-version fields on the form.
	const [teamDefaults, setTeamDefaults] = useState<Record<string, unknown> | null>(null)

	// Fetch team resource usage/limits + cluster defaults
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
					const defs = team.clusterDefaults || team.spec?.clusterDefaults
					if (usage) setResourceUsage(usage)
					if (limits) setResourceLimits(limits)
					if (defs) setTeamDefaults(defs)
				}
			} catch {
				// Non-critical; quota warnings and defaults fall back.
			}
		}
		fetchQuota()
	}, [currentTeam])

	// Merge env.clusterDefaults over team.clusterDefaults. Used to
	// pre-fill form fields and tag each with its source for the UI hint.
	const defaultsSource = useMemo(() => {
		const source: Record<string, 'env' | 'team'> = {}
		const envDef = availableEnvs.find((e) => e.name === selectedEnv)?.clusterDefaults
		const merged: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(teamDefaults ?? {})) {
			if (v == null || v === '') continue
			merged[k] = v
			source[k] = 'team'
		}
		for (const [k, v] of Object.entries(envDef ?? {})) {
			if (v == null || v === '') continue
			merged[k] = v
			source[k] = 'env'
		}
		return { merged, source }
	}, [teamDefaults, availableEnvs, selectedEnv])

	// Apply the merged defaults to the form, but only for fields whose
	// current value matches the previously-applied default (so we don't
	// clobber user edits). appliedDefaults tracks the last-applied set.
	const [appliedDefaults, setAppliedDefaults] = useState<Record<string, unknown>>({})
	useEffect(() => {
		const next = defaultsSource.merged
		setForm((prev) => {
			const out = { ...prev }
			const mapping: Record<string, keyof typeof prev> = {
				kubernetesVersion: 'kubernetesVersion',
				workerCount: 'workerReplicas',
				workerCPU: 'workerCPU',
			}
			for (const [defKey, formKey] of Object.entries(mapping) as [string, keyof typeof prev][]) {
				if (!(defKey in next)) continue
				const nextVal = next[defKey]
				const prevDefault = appliedDefaults[defKey]
				const currentFormVal = prev[formKey]
				const matchesPrev =
					prevDefault !== undefined && String(currentFormVal) === String(prevDefault)
				const isInitial = prevDefault === undefined
				if (matchesPrev || isInitial) {
					// Safe to overwrite: either first apply, or user has
					// not changed this field since the last apply.
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					;(out as any)[formKey] = typeof nextVal === 'number' ? nextVal : String(nextVal ?? '')
				}
			}
			// workerMemoryGi / workerDiskGi land as "<N>Gi" in the form.
			for (const [defKey, formKey] of [
				['workerMemoryGi', 'workerMemory'],
				['workerDiskGi', 'workerDiskSize'],
			] as const) {
				if (!(defKey in next)) continue
				const nextVal = next[defKey]
				const prevDefault = appliedDefaults[defKey]
				const currentFormVal = prev[formKey]
				const prevFormatted = prevDefault !== undefined ? `${prevDefault}Gi` : undefined
				const matchesPrev = prevFormatted !== undefined && currentFormVal === prevFormatted
				const isInitial = prevDefault === undefined
				if (matchesPrev || isInitial) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					;(out as any)[formKey] = `${nextVal}Gi`
				}
			}
			return out
		})
		setAppliedDefaults(next)
		// appliedDefaults intentionally not in deps — we read it but
		// its updates are caused by this same effect; including it
		// would cause a feedback loop.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [defaultsSource])

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
			setNutanixClusters([])
			setStorageContainers([])
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

		// Fetch Nutanix-specific resources
		if (providerType === 'nutanix') {
			const fetchClusters = async () => {
				setLoadingClusters(true)
				try {
					const response = await providersApi.listClusters(ns, selectedProvider.metadata.name)
					setNutanixClusters(response.clusters || [])
				} catch (err) {
					console.error('Failed to fetch Nutanix clusters:', err)
				} finally {
					setLoadingClusters(false)
				}
			}

			const fetchStorageContainers = async () => {
				setLoadingStorageContainers(true)
				try {
					const response = await providersApi.listStorageContainers(ns, selectedProvider.metadata.name)
					setStorageContainers(response.storageContainers || [])
				} catch (err) {
					console.error('Failed to fetch storage containers:', err)
				} finally {
					setLoadingStorageContainers(false)
				}
			}

			fetchClusters()
			fetchStorageContainers()
		}
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
			awsSubnet: '',
			// Pre-fill Nutanix fields from ProviderConfig defaults
			nutanixClusterUUID: provider?.spec.nutanix?.clusterUUID || '',
			nutanixSubnetUUID: provider?.spec.nutanix?.subnetUUID || '',
			nutanixImageUUID: provider?.spec.nutanix?.imageUUID || '',
			nutanixStorageContainerUUID: provider?.spec.nutanix?.storageContainerUUID || '',
		}))
	}

	const providerType = selectedProvider?.spec.provider || ''
	const isIpamMode = selectedProvider?.spec.network?.mode === 'ipam'
	const isCloudMode = selectedProvider?.spec.network?.mode === 'cloud'

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setEnvFieldError(null)

		if (!form.name) {
			setError('Cluster name is required')
			return
		}
		if (!form.providerConfigRef) {
			setError('Provider is required')
			return
		}
		if (envRequired && !selectedEnv) {
			setEnvFieldError('Environment is required')
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

			// Derive OS type from the selected image
			const selectedImageId = providerType === 'harvester' ? form.harvesterImageName
				: providerType === 'nutanix' ? form.nutanixImageUUID
				: ''
			if (selectedImageId) {
				const selectedImage = images.find(img => img.id === selectedImageId)
				if (selectedImage?.os) {
					payload.osType = selectedImage.os
				}
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

			// Add control plane resources if any are set
			const cpResources: Record<string, unknown> = {}
			const apiServerRes: Record<string, unknown> = {}
			const apiServerReq: Record<string, string> = {}
			const apiServerLim: Record<string, string> = {}
			if (form.cpApiServerCpuReq) apiServerReq.cpu = form.cpApiServerCpuReq
			if (form.cpApiServerMemReq) apiServerReq.memory = form.cpApiServerMemReq
			if (form.cpApiServerCpuLim) apiServerLim.cpu = form.cpApiServerCpuLim
			if (form.cpApiServerMemLim) apiServerLim.memory = form.cpApiServerMemLim
			if (Object.keys(apiServerReq).length > 0) apiServerRes.requests = apiServerReq
			if (Object.keys(apiServerLim).length > 0) apiServerRes.limits = apiServerLim
			if (Object.keys(apiServerRes).length > 0) cpResources.apiServer = apiServerRes

			const cmRes: Record<string, unknown> = {}
			const cmReq: Record<string, string> = {}
			const cmLim: Record<string, string> = {}
			if (form.cpCMCpuReq) cmReq.cpu = form.cpCMCpuReq
			if (form.cpCMMemReq) cmReq.memory = form.cpCMMemReq
			if (form.cpCMCpuLim) cmLim.cpu = form.cpCMCpuLim
			if (form.cpCMMemLim) cmLim.memory = form.cpCMMemLim
			if (Object.keys(cmReq).length > 0) cmRes.requests = cmReq
			if (Object.keys(cmLim).length > 0) cmRes.limits = cmLim
			if (Object.keys(cmRes).length > 0) cpResources.controllerManager = cmRes

			const schedRes: Record<string, unknown> = {}
			const schedReq: Record<string, string> = {}
			const schedLim: Record<string, string> = {}
			if (form.cpSchedulerCpuReq) schedReq.cpu = form.cpSchedulerCpuReq
			if (form.cpSchedulerMemReq) schedReq.memory = form.cpSchedulerMemReq
			if (form.cpSchedulerCpuLim) schedLim.cpu = form.cpSchedulerCpuLim
			if (form.cpSchedulerMemLim) schedLim.memory = form.cpSchedulerMemLim
			if (Object.keys(schedReq).length > 0) schedRes.requests = schedReq
			if (Object.keys(schedLim).length > 0) schedRes.limits = schedLim
			if (Object.keys(schedRes).length > 0) cpResources.scheduler = schedRes

			if (Object.keys(cpResources).length > 0) {
				payload.controlPlaneResources = cpResources
			}

			// Add schematic ID if specified
			if (form.schematicID) {
				payload.schematicID = form.schematicID
			}

			if (form.timeServers.trim()) {
				payload.timeServers = form.timeServers.split(',').map((s: string) => s.trim()).filter(Boolean)
			}

			// Ensure the X-Butler-Environment header carries the form's env
			// choice on this request even if the URL does not. Restore the
			// context-driven env after the call so the switcher stays the
			// source of truth for subsequent reads.
			const priorEnv = apiClient.getEnvironment()
			if (envRequired) {
				apiClient.setEnvironment(selectedEnv)
			}
			try {
				await clustersApi.create(payload as unknown as Parameters<typeof clustersApi.create>[0])
			} finally {
				apiClient.setEnvironment(priorEnv)
			}
			success('Cluster Created', `${form.name} is being provisioned`)
			if (returnTo) {
				navigate(`${returnTo}?newCluster=${encodeURIComponent(`${form.namespace}/${form.name}`)}`)
			} else {
				navigate(buildPath(`/clusters/${form.namespace}/${form.name}`))
			}
		} catch (err) {
			const denial = extractWebhookDenial(err)
			if (denial) {
				// Per step-7 spec: if the webhook denial references the env
				// label/env surface, render inline on the env field;
				// otherwise render inline near the submit button.
				const f = denial.field.toLowerCase()
				if (f.includes('environment')) {
					setEnvFieldError(denial.message)
				} else {
					setError(denial.message)
				}
			} else {
				const message = err instanceof Error ? err.message : 'Failed to create cluster'
				setError(message)
				showError('Creation Failed', message)
			}
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
										Control Plane Version
									</label>
									<select
										name="kubernetesVersion"
										value={form.kubernetesVersion}
										onChange={handleChange}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									>
										{SUPPORTED_K8S_VERSIONS.map(v => (
											<option key={v} value={v}>{v}</option>
										))}
									</select>
									<p className="text-xs text-neutral-500 mt-1">Worker kubelet version is determined by the OS image.</p>
									<DefaultSourceHint source={defaultsSource.source.kubernetesVersion} />
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

						{/* Environment (only when the team defines envs) */}
						{envRequired && (
							<div>
								<h3 className="text-lg font-medium text-neutral-50 mb-4">Environment</h3>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Target environment *
									</label>
									<select
										value={selectedEnv}
										onChange={(e) => {
											setSelectedEnv(e.target.value)
											setEnvFieldError(null)
										}}
										className={`w-full px-3 py-2 bg-neutral-800 border rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 ${
											envFieldError ? 'border-red-500' : 'border-neutral-700'
										}`}
									>
										<option value="">Select an environment</option>
										{availableEnvs.map((env) => (
											<option key={env.name} value={env.name}>
												{env.name}
												{env.limits?.maxClusters != null ? ` (max ${env.limits.maxClusters})` : ''}
												{env.limits?.maxClustersPerMember != null
													? `, ${env.limits.maxClustersPerMember}/member`
													: ''}
											</option>
										))}
									</select>
									<p className="text-xs text-neutral-500 mt-1">
										Env-level quota applies on top of the team total.
									</p>
									{selectedEnvPerMemberCap != null && ownedInEnv != null && (
										<div
											className={`mt-2 p-2 rounded-md text-xs ${
												atPerMemberCap
													? 'bg-red-500/10 text-red-300 border border-red-500/20'
													: 'bg-neutral-800 text-neutral-300 border border-neutral-700'
											}`}
										>
											You own {ownedInEnv} of {selectedEnvPerMemberCap} clusters in {selectedEnv}
											{atPerMemberCap
												? ' — at per-member cap. Creating another in this env will be rejected.'
												: '.'}
										</div>
									)}
									{envFieldError && (
										<div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
											<p className="text-red-400 text-sm whitespace-pre-wrap">{envFieldError}</p>
										</div>
									)}
								</div>
							</div>
						)}

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
										setForm={setForm}
										onChange={handleChange}
										images={images}
										loadingImages={loadingImages}
										networks={networks}
										loadingNetworks={loadingNetworks}
										clusters={nutanixClusters}
										loadingClusters={loadingClusters}
										storageContainers={storageContainers}
										loadingStorageContainers={loadingStorageContainers}
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
									<DefaultSourceHint source={defaultsSource.source.workerCount} />
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
									<DefaultSourceHint source={defaultsSource.source.workerCPU} />
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Memory
									</label>
									<input
										type="text"
										name="workerMemory"
										value={form.workerMemory}
										onChange={handleChange}
										placeholder="16Gi"
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
									/>
									<DefaultSourceHint source={defaultsSource.source.workerMemoryGi} />
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Disk Size
									</label>
									<input
										type="text"
										name="workerDiskSize"
										value={form.workerDiskSize}
										onChange={handleChange}
										placeholder="100Gi"
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
									/>
									<DefaultSourceHint source={defaultsSource.source.workerDiskGi} />
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

						{/* Advanced Options */}
								<div className="space-y-4">
									<button
										type="button"
										onClick={() => setShowAdvancedCP(!showAdvancedCP)}
										className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200"
									>
										<svg className={`w-4 h-4 transition-transform ${showAdvancedCP ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
										Advanced Options
									</button>
									{showAdvancedCP && (
										<div className="space-y-4 pl-6 border-l-2 border-neutral-700">
											{/* Schematic ID */}
											<div>
												<label className="block text-sm font-medium text-neutral-400 mb-1">Schematic ID</label>
												<input
													type="text"
													name="schematicID"
													value={form.schematicID}
													onChange={handleChange}
													placeholder="e.g., ce4c980550dd2ab1b17bbf2b08801c7eb59418ea..."
													className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
												/>
												<p className="text-xs text-neutral-500 mt-1">
													Image Factory schematic hash. Leave empty to use the provider default image.
												</p>
											</div>

											{/* NTP Time Servers */}
											<div>
												<label className="block text-sm font-medium text-neutral-400 mb-1">NTP Servers</label>
												<input
													type="text"
													name="timeServers"
													value={form.timeServers}
													onChange={handleChange}
													placeholder="e.g., ntp01.example.com, ntp02.example.com"
													className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
												/>
												<p className="text-xs text-neutral-500 mt-1">
													Comma-separated NTP server hostnames. Leave empty to use the provider default.
													Required on networks where the Talos default (time.cloudflare.com) is unreachable.
												</p>
											</div>

											<p className="text-xs text-neutral-500">
												Override platform defaults for tenant control plane components. Leave empty to use ButlerConfig defaults or BestEffort QoS.
											</p>

											{/* API Server */}
											<div>
												<h4 className="text-sm font-medium text-neutral-300 mb-2">API Server</h4>
												<div className="grid grid-cols-2 gap-4">
													<div>
														<label className="block text-xs text-neutral-500 mb-1">CPU Request</label>
														<input type="text" name="cpApiServerCpuReq" value={form.cpApiServerCpuReq} onChange={handleChange} placeholder="e.g., 100m" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">Memory Request</label>
														<input type="text" name="cpApiServerMemReq" value={form.cpApiServerMemReq} onChange={handleChange} placeholder="e.g., 256Mi" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">CPU Limit</label>
														<input type="text" name="cpApiServerCpuLim" value={form.cpApiServerCpuLim} onChange={handleChange} placeholder="e.g., 2" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">Memory Limit</label>
														<input type="text" name="cpApiServerMemLim" value={form.cpApiServerMemLim} onChange={handleChange} placeholder="e.g., 1Gi" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
												</div>
											</div>

											{/* Controller Manager */}
											<div>
												<h4 className="text-sm font-medium text-neutral-300 mb-2">Controller Manager</h4>
												<div className="grid grid-cols-2 gap-4">
													<div>
														<label className="block text-xs text-neutral-500 mb-1">CPU Request</label>
														<input type="text" name="cpCMCpuReq" value={form.cpCMCpuReq} onChange={handleChange} placeholder="e.g., 50m" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">Memory Request</label>
														<input type="text" name="cpCMMemReq" value={form.cpCMMemReq} onChange={handleChange} placeholder="e.g., 64Mi" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">CPU Limit</label>
														<input type="text" name="cpCMCpuLim" value={form.cpCMCpuLim} onChange={handleChange} placeholder="e.g., 1" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">Memory Limit</label>
														<input type="text" name="cpCMMemLim" value={form.cpCMMemLim} onChange={handleChange} placeholder="e.g., 512Mi" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
												</div>
											</div>

											{/* Scheduler */}
											<div>
												<h4 className="text-sm font-medium text-neutral-300 mb-2">Scheduler</h4>
												<div className="grid grid-cols-2 gap-4">
													<div>
														<label className="block text-xs text-neutral-500 mb-1">CPU Request</label>
														<input type="text" name="cpSchedulerCpuReq" value={form.cpSchedulerCpuReq} onChange={handleChange} placeholder="e.g., 25m" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">Memory Request</label>
														<input type="text" name="cpSchedulerMemReq" value={form.cpSchedulerMemReq} onChange={handleChange} placeholder="e.g., 32Mi" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">CPU Limit</label>
														<input type="text" name="cpSchedulerCpuLim" value={form.cpSchedulerCpuLim} onChange={handleChange} placeholder="e.g., 500m" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
													<div>
														<label className="block text-xs text-neutral-500 mb-1">Memory Limit</label>
														<input type="text" name="cpSchedulerMemLim" value={form.cpSchedulerMemLim} onChange={handleChange} placeholder="e.g., 256Mi" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
													</div>
												</div>
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
							<Button type="submit" disabled={loading || providers.length === 0 || hasQuotaErrors || atPerMemberCap}>
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

interface NutanixFieldProps extends FieldPropsWithResources {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setForm: React.Dispatch<React.SetStateAction<any>>
	clusters: ClusterInfo[]
	loadingClusters: boolean
	storageContainers: StorageContainerInfo[]
	loadingStorageContainers: boolean
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
					OS image for worker nodes
				</p>
			</div>
		</div>
	)
}

function NutanixFields({
	form,
	setForm,
	images,
	loadingImages,
	networks,
	loadingNetworks,
	clusters,
	loadingClusters,
	storageContainers,
	loadingStorageContainers,
}: NutanixFieldProps) {
	const clusterOptions: SearchableSelectOption[] = clusters.map((c) => ({
		value: c.id,
		label: c.name,
		suffix: c.id.slice(0, 8) + '...',
	}))

	const subnetOptions: SearchableSelectOption[] = networks.map((net) => ({
		value: net.id,
		label: net.name,
		suffix: net.vlan ? `VLAN ${net.vlan}` : undefined,
	}))

	const imageOptions: SearchableSelectOption[] = images.map((img) => ({
		value: img.id,
		label: img.name,
		suffix: img.os ? `(${img.os})` : undefined,
	}))

	const storageOptions: SearchableSelectOption[] = storageContainers.map((sc) => ({
		value: sc.id,
		label: sc.name,
	}))

	return (
		<div className="grid grid-cols-2 gap-4">
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Cluster *
				</label>
				<SearchableSelect
					value={form.nutanixClusterUUID as string}
					onChange={(val) => setForm((prev: Record<string, unknown>) => ({ ...prev, nutanixClusterUUID: val }))}
					options={clusterOptions}
					placeholder="Select cluster..."
					loading={loadingClusters}
					loadingText="Loading clusters..."
				/>
				<p className="text-xs text-neutral-500 mt-1">
					Prism Element cluster for VM placement
				</p>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Subnet *
				</label>
				<SearchableSelect
					value={form.nutanixSubnetUUID as string}
					onChange={(val) => setForm((prev: Record<string, unknown>) => ({ ...prev, nutanixSubnetUUID: val }))}
					options={subnetOptions}
					placeholder="Select subnet..."
					loading={loadingNetworks}
					loadingText="Loading subnets..."
				/>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Image
				</label>
				<SearchableSelect
					value={form.nutanixImageUUID as string}
					onChange={(val) => setForm((prev: Record<string, unknown>) => ({ ...prev, nutanixImageUUID: val }))}
					options={imageOptions}
					placeholder="Select image (optional)..."
					loading={loadingImages}
					loadingText="Loading images..."
				/>
				<p className="text-xs text-neutral-500 mt-1">
					OS image for worker nodes (uses provider default if not set)
				</p>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Storage Container
				</label>
				<SearchableSelect
					value={form.nutanixStorageContainerUUID as string}
					onChange={(val) => setForm((prev: Record<string, unknown>) => ({ ...prev, nutanixStorageContainerUUID: val }))}
					options={storageOptions}
					placeholder="Select storage container (optional)..."
					loading={loadingStorageContainers}
					loadingText="Loading storage containers..."
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

function DefaultSourceHint({ source }: { source?: 'env' | 'team' }) {
	if (!source) return null
	return (
		<p className={`text-xs mt-1 ${source === 'env' ? 'text-blue-400' : 'text-neutral-500'}`}>
			{source === 'env' ? 'from env default' : 'from team default'}
		</p>
	)
}
