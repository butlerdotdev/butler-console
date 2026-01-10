// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, providersApi, type Provider } from '@/api'
import { Card, Button, FadeIn, Spinner } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'

export function CreateClusterPage() {
	useDocumentTitle('Create Cluster')
	const navigate = useNavigate()
	const { success, error: showError } = useToast()

	// Providers
	const [providers, setProviders] = useState<Provider[]>([])
	const [loadingProviders, setLoadingProviders] = useState(true)
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

	// Form state
	const [form, setForm] = useState({
		name: '',
		namespace: 'butler-tenants',
		kubernetesVersion: 'v1.30.2',
		providerConfigRef: '',
		workerReplicas: 1,
		workerCPU: 4,
		workerMemory: '8Gi',
		workerDiskSize: '50Gi',
		loadBalancerStart: '',
		loadBalancerEnd: '',
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
	})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		loadProviders()
	}, [])

	const loadProviders = async () => {
		try {
			const response = await providersApi.list()
			setProviders(response.providers || [])
			// Auto-select first provider
			if (response.providers?.length > 0) {
				const first = response.providers[0]
				setSelectedProvider(first)
				setForm(prev => ({ ...prev, providerConfigRef: first.metadata.name }))
			}
		} catch (err) {
			showError('Error', 'Failed to load providers')
		} finally {
			setLoadingProviders(false)
		}
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target
		setForm(prev => ({ ...prev, [name]: value }))
	}

	const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const providerName = e.target.value
		const provider = providers.find(p => p.metadata.name === providerName) || null
		setSelectedProvider(provider)
		setForm(prev => ({ ...prev, providerConfigRef: providerName }))
	}

	const providerType = selectedProvider?.spec.provider || ''

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
		if (!form.loadBalancerStart || !form.loadBalancerEnd) {
			setError('Load balancer IP range is required')
			return
		}

		// Validate provider-specific fields
		if (providerType === 'harvester' && !form.harvesterNetworkName) {
			setError('Network name is required for Harvester')
			return
		}
		if (providerType === 'nutanix') {
			if (!form.nutanixClusterUUID || !form.nutanixSubnetUUID) {
				setError('Cluster UUID and Subnet UUID are required for Nutanix')
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
				loadBalancerStart: form.loadBalancerStart,
				loadBalancerEnd: form.loadBalancerEnd,
			}

			// Add provider-specific fields
			if (providerType === 'harvester') {
				payload.harvesterNamespace = form.harvesterNamespace
				payload.harvesterNetworkName = form.harvesterNetworkName
				if (form.harvesterImageName) payload.harvesterImageName = form.harvesterImageName
			} else if (providerType === 'nutanix') {
				payload.nutanixClusterUUID = form.nutanixClusterUUID
				payload.nutanixSubnetUUID = form.nutanixSubnetUUID
				if (form.nutanixImageUUID) payload.nutanixImageUUID = form.nutanixImageUUID
				if (form.nutanixStorageContainerUUID) payload.nutanixStorageContainerUUID = form.nutanixStorageContainerUUID
			} else if (providerType === 'proxmox') {
				payload.proxmoxNode = form.proxmoxNode
				payload.proxmoxStorage = form.proxmoxStorage
				if (form.proxmoxTemplateID) payload.proxmoxTemplateID = Number(form.proxmoxTemplateID)
			}

			await clustersApi.create(payload as Parameters<typeof clustersApi.create>[0])
			success('Cluster Created', `${form.name} is being provisioned`)
			navigate(`/clusters/${form.namespace}/${form.name}`)
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
					<p className="text-neutral-400 mt-1">Deploy a new tenant Kubernetes cluster</p>
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
									</label>
									<input
										type="text"
										name="namespace"
										value={form.namespace}
										onChange={handleChange}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
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
											<a href="/providers/create" className="underline">Add one</a>
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
									Infrastructure ({providerType})
								</h3>

								{providerType === 'harvester' && (
									<HarvesterFields form={form} onChange={handleChange} />
								)}

								{providerType === 'nutanix' && (
									<NutanixFields form={form} onChange={handleChange} />
								)}

								{providerType === 'proxmox' && (
									<ProxmoxFields form={form} onChange={handleChange} provider={selectedProvider} />
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
						</div>

						{/* Error */}
						{error && (
							<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
								<p className="text-red-400 text-sm">{error}</p>
							</div>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
							<Button type="button" variant="secondary" onClick={() => navigate('/clusters')}>
								Cancel
							</Button>
							<Button type="submit" disabled={loading || providers.length === 0}>
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

function HarvesterFields({ form, onChange }: FieldProps) {
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
					Network Name *
				</label>
				<input
					type="text"
					name="harvesterNetworkName"
					value={form.harvesterNetworkName as string}
					onChange={onChange}
					placeholder="default/vlan40-workloads"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
				<p className="text-xs text-neutral-500 mt-1">Format: namespace/name</p>
			</div>
			<div className="col-span-2">
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Image Name
				</label>
				<input
					type="text"
					name="harvesterImageName"
					value={form.harvesterImageName as string}
					onChange={onChange}
					placeholder="default/ubuntu-22.04 (optional, uses provider default)"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
		</div>
	)
}

function NutanixFields({ form, onChange }: FieldProps) {
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
					Subnet UUID *
				</label>
				<input
					type="text"
					name="nutanixSubnetUUID"
					value={form.nutanixSubnetUUID as string}
					onChange={onChange}
					placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
			</div>
			<div>
				<label className="block text-sm font-medium text-neutral-400 mb-1">
					Image UUID
				</label>
				<input
					type="text"
					name="nutanixImageUUID"
					value={form.nutanixImageUUID as string}
					onChange={onChange}
					placeholder="Optional, uses provider default"
					className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
				/>
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
