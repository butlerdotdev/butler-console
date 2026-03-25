// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import { Card, Button, FadeIn, Spinner, Input } from '@/components/ui'
import { configApi } from '@/api/config'
import type {
	ButlerConfigResponse,
	UpdateConfigRequest,
	AddonVersionsInfo,
	TeamLimitsInfo,
	CPResourcesInfo,
	ImageFactoryInfo,
	ControlPlaneExposureInfo,
} from '@/api/config'

export function SettingsPage() {
	useDocumentTitle('Platform Settings')
	const toast = useToast()

	const [config, setConfig] = useState<ButlerConfigResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Per-section saving state
	const [savingGeneral, setSavingGeneral] = useState(false)
	const [savingExposure, setSavingExposure] = useState(false)
	const [savingAddons, setSavingAddons] = useState(false)
	const [savingLimits, setSavingLimits] = useState(false)
	const [savingResources, setSavingResources] = useState(false)
	const [savingFactory, setSavingFactory] = useState(false)
	const [savingSSH, setSavingSSH] = useState(false)

	// Editable form state
	const [multiTenancyMode, setMultiTenancyMode] = useState('')
	const [defaultNamespace, setDefaultNamespace] = useState('')
	const [defaultProviderName, setDefaultProviderName] = useState('')

	const [exposureMode, setExposureMode] = useState('')
	const [exposureHostname, setExposureHostname] = useState('')
	const [exposureIngressClass, setExposureIngressClass] = useState('')
	const [exposureControllerType, setExposureControllerType] = useState('')
	const [exposureGatewayRef, setExposureGatewayRef] = useState('')

	const [addonVersions, setAddonVersions] = useState<AddonVersionsInfo>({})

	const [teamLimits, setTeamLimits] = useState<TeamLimitsInfo>({})

	const [cpResources, setCPResources] = useState<CPResourcesInfo>({})

	const [factoryURL, setFactoryURL] = useState('')
	const [factoryCredRef, setFactoryCredRef] = useState('')
	const [factorySchematicID, setFactorySchematicID] = useState('')
	const [factoryAutoSync, setFactoryAutoSync] = useState(true)

	const [sshKey, setSSHKey] = useState('')

	const populateFormState = useCallback((data: ButlerConfigResponse) => {
		setMultiTenancyMode(data.multiTenancy?.mode || 'Disabled')
		setDefaultNamespace(data.defaultNamespace || '')
		setDefaultProviderName(data.defaultProviderRef?.name || '')

		setExposureMode(data.controlPlaneExposure?.mode || 'LoadBalancer')
		setExposureHostname(data.controlPlaneExposure?.hostname || '')
		setExposureIngressClass(data.controlPlaneExposure?.ingressClassName || '')
		setExposureControllerType(data.controlPlaneExposure?.controllerType || '')
		setExposureGatewayRef(data.controlPlaneExposure?.gatewayRef || '')

		setAddonVersions(data.defaultAddonVersions || {})
		setTeamLimits(data.defaultTeamLimits || {})
		setCPResources(data.defaultControlPlaneResources || {})

		setFactoryURL(data.imageFactory?.url || '')
		setFactoryCredRef(data.imageFactory?.credentialsRef || '')
		setFactorySchematicID(data.imageFactory?.defaultSchematicID || '')
		setFactoryAutoSync(data.imageFactory?.autoSync !== false)

		setSSHKey(data.sshAuthorizedKey || '')
	}, [])

	const loadConfig = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const data = await configApi.getConfig()
			setConfig(data)
			populateFormState(data)
		} catch {
			setError('Failed to load platform configuration')
		} finally {
			setLoading(false)
		}
	}, [populateFormState])

	useEffect(() => {
		loadConfig()
	}, [loadConfig])

	const saveSection = async (
		data: UpdateConfigRequest,
		setSaving: (v: boolean) => void,
		sectionName: string
	) => {
		try {
			setSaving(true)
			const updated = await configApi.updateConfig(data)
			setConfig(updated)
			populateFormState(updated)
			toast.success(`${sectionName} saved`)
		} catch {
			toast.error(`Failed to save ${sectionName.toLowerCase()}`)
		} finally {
			setSaving(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error || !config) {
		return (
			<FadeIn>
				<div className="max-w-4xl space-y-6">
					<h1 className="text-2xl font-semibold text-neutral-50">Platform Settings</h1>
					<Card className="p-6">
						<p className="text-red-400">{error || 'Failed to load configuration'}</p>
						<Button className="mt-4" onClick={loadConfig}>Retry</Button>
					</Card>
				</div>
			</FadeIn>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6 max-w-4xl">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Platform Settings</h1>
						<p className="text-neutral-400 mt-1">
							Configure platform-wide Butler settings
						</p>
					</div>
					<div className="text-sm text-neutral-500 space-x-4">
						<span>{config.status.teamCount} teams</span>
						<span>{config.status.clusterCount} clusters</span>
					</div>
				</div>

				{/* General Settings */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">General Settings</h2>
						<Button
							size="sm"
							onClick={() =>
								saveSection(
									{
										multiTenancy: { mode: multiTenancyMode },
										defaultNamespace: defaultNamespace,
										defaultProviderRef: { name: defaultProviderName },
									},
									setSavingGeneral,
									'General settings'
								)
							}
							disabled={savingGeneral}
						>
							{savingGeneral ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Multi-Tenancy Mode
							</label>
							<select
								value={multiTenancyMode}
								onChange={(e) => setMultiTenancyMode(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
							>
								<option value="Disabled">Disabled</option>
								<option value="Optional">Optional</option>
								<option value="Enforced">Enforced</option>
							</select>
							<p className="text-xs text-neutral-500 mt-1">
								Enforced: all clusters must belong to a team. Optional: teams available but not
								required. Disabled: no teams.
							</p>
						</div>
						<Input
							label="Default Namespace"
							value={defaultNamespace}
							onChange={(e) => setDefaultNamespace(e.target.value)}
							placeholder="butler-tenants"
						/>
						<Input
							label="Default Provider"
							value={defaultProviderName}
							onChange={(e) => setDefaultProviderName(e.target.value)}
							placeholder="ProviderConfig name (e.g. harvester-prod)"
						/>
					</div>
				</Card>

				{/* Control Plane Exposure */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">Control Plane Exposure</h2>
						<Button
							size="sm"
							onClick={() => {
								const exposure: ControlPlaneExposureInfo = {
									mode: exposureMode,
									hostname: exposureHostname,
									ingressClassName: exposureIngressClass,
									controllerType: exposureControllerType,
									gatewayRef: exposureGatewayRef,
								}
								saveSection(
									{ controlPlaneExposure: exposure },
									setSavingExposure,
									'Control plane exposure'
								)
							}}
							disabled={savingExposure}
						>
							{savingExposure ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Exposure Mode
							</label>
							<select
								value={exposureMode}
								onChange={(e) => setExposureMode(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
							>
								<option value="LoadBalancer">LoadBalancer (1 IP per tenant)</option>
								<option value="Ingress">Ingress (shared IP, SNI routing)</option>
								<option value="Gateway">Gateway API (shared IP, TLSRoute)</option>
							</select>
						</div>
						{(exposureMode === 'Ingress' || exposureMode === 'Gateway') && (
							<Input
								label="Hostname Pattern"
								value={exposureHostname}
								onChange={(e) => setExposureHostname(e.target.value)}
								placeholder="*.k8s.platform.example.com"
							/>
						)}
						{exposureMode === 'Ingress' && (
							<>
								<Input
									label="Ingress Class Name"
									value={exposureIngressClass}
									onChange={(e) => setExposureIngressClass(e.target.value)}
									placeholder="haproxy"
								/>
								<div>
									<label className="block text-sm font-medium text-neutral-300 mb-1">
										Controller Type
									</label>
									<select
										value={exposureControllerType}
										onChange={(e) => setExposureControllerType(e.target.value)}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
									>
										<option value="">Select controller type</option>
										<option value="haproxy">HAProxy</option>
										<option value="nginx">NGINX</option>
										<option value="traefik">Traefik</option>
										<option value="generic">Generic</option>
									</select>
								</div>
							</>
						)}
						{exposureMode === 'Gateway' && (
							<Input
								label="Gateway Reference"
								value={exposureGatewayRef}
								onChange={(e) => setExposureGatewayRef(e.target.value)}
								placeholder="namespace/gateway-name"
							/>
						)}
						{config.status.tcpProxyRequired && (
							<p className="text-xs text-amber-400">
								TCP proxy is auto-enabled for all tenants in {exposureMode} mode.
							</p>
						)}
					</div>
				</Card>

				{/* Default Addon Versions */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">Default Addon Versions</h2>
						<Button
							size="sm"
							onClick={() =>
								saveSection(
									{ defaultAddonVersions: addonVersions },
									setSavingAddons,
									'Addon versions'
								)
							}
							disabled={savingAddons}
						>
							{savingAddons ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<p className="text-xs text-neutral-500 mb-4">
						Default versions used when tenant clusters don't specify their own.
					</p>
					<div className="grid grid-cols-2 gap-4">
						<Input
							label="Cilium"
							value={addonVersions.cilium || ''}
							onChange={(e) =>
								setAddonVersions({ ...addonVersions, cilium: e.target.value })
							}
							placeholder="1.16.1"
						/>
						<Input
							label="MetalLB"
							value={addonVersions.metallb || ''}
							onChange={(e) =>
								setAddonVersions({ ...addonVersions, metallb: e.target.value })
							}
							placeholder="0.14.8"
						/>
						<Input
							label="cert-manager"
							value={addonVersions.certManager || ''}
							onChange={(e) =>
								setAddonVersions({ ...addonVersions, certManager: e.target.value })
							}
							placeholder="1.15.3"
						/>
						<Input
							label="Longhorn"
							value={addonVersions.longhorn || ''}
							onChange={(e) =>
								setAddonVersions({ ...addonVersions, longhorn: e.target.value })
							}
							placeholder="1.7.2"
						/>
						<Input
							label="Traefik"
							value={addonVersions.traefik || ''}
							onChange={(e) =>
								setAddonVersions({ ...addonVersions, traefik: e.target.value })
							}
							placeholder="31.1.1"
						/>
						<Input
							label="FluxCD"
							value={addonVersions.fluxcd || ''}
							onChange={(e) =>
								setAddonVersions({ ...addonVersions, fluxcd: e.target.value })
							}
							placeholder="2.14.0"
						/>
					</div>
				</Card>

				{/* Default Team Limits */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">Default Team Limits</h2>
						<Button
							size="sm"
							onClick={() =>
								saveSection(
									{ defaultTeamLimits: teamLimits },
									setSavingLimits,
									'Team limits'
								)
							}
							disabled={savingLimits}
						>
							{savingLimits ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<p className="text-xs text-neutral-500 mb-4">
						Default resource limits applied to new teams. Can be overridden per team.
					</p>
					<div className="grid grid-cols-2 gap-4">
						<Input
							label="Max Clusters"
							type="number"
							value={teamLimits.maxClusters ?? ''}
							onChange={(e) =>
								setTeamLimits({
									...teamLimits,
									maxClusters: e.target.value ? Number(e.target.value) : undefined,
								})
							}
							placeholder="10"
						/>
						<Input
							label="Max Workers Per Cluster"
							type="number"
							value={teamLimits.maxWorkersPerCluster ?? ''}
							onChange={(e) =>
								setTeamLimits({
									...teamLimits,
									maxWorkersPerCluster: e.target.value
										? Number(e.target.value)
										: undefined,
								})
							}
							placeholder="20"
						/>
						<Input
							label="Max Total CPU"
							value={teamLimits.maxTotalCPU || ''}
							onChange={(e) =>
								setTeamLimits({ ...teamLimits, maxTotalCPU: e.target.value })
							}
							placeholder="100 (cores)"
						/>
						<Input
							label="Max Total Memory"
							value={teamLimits.maxTotalMemory || ''}
							onChange={(e) =>
								setTeamLimits({ ...teamLimits, maxTotalMemory: e.target.value })
							}
							placeholder="256Gi"
						/>
						<Input
							label="Max Total Storage"
							value={teamLimits.maxTotalStorage || ''}
							onChange={(e) =>
								setTeamLimits({ ...teamLimits, maxTotalStorage: e.target.value })
							}
							placeholder="1Ti"
						/>
					</div>
				</Card>

				{/* Default Control Plane Resources */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">
							Default Control Plane Resources
						</h2>
						<Button
							size="sm"
							onClick={() =>
								saveSection(
									{ defaultControlPlaneResources: cpResources },
									setSavingResources,
									'Control plane resources'
								)
							}
							disabled={savingResources}
						>
							{savingResources ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<p className="text-xs text-neutral-500 mb-4">
						Default resource requests/limits for tenant control plane components. Applied to new
						clusters without per-cluster overrides. Leave blank for BestEffort QoS.
					</p>
					<div className="space-y-6">
						<CPResourceRow
							label="API Server"
							value={cpResources.apiServer}
							onChange={(v) => setCPResources({ ...cpResources, apiServer: v })}
						/>
						<CPResourceRow
							label="Controller Manager"
							value={cpResources.controllerManager}
							onChange={(v) => setCPResources({ ...cpResources, controllerManager: v })}
						/>
						<CPResourceRow
							label="Scheduler"
							value={cpResources.scheduler}
							onChange={(v) => setCPResources({ ...cpResources, scheduler: v })}
						/>
					</div>
				</Card>

				{/* Image Factory */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">Image Factory</h2>
						<Button
							size="sm"
							onClick={() => {
								const factory: ImageFactoryInfo = {
									url: factoryURL,
									credentialsRef: factoryCredRef,
									defaultSchematicID: factorySchematicID,
									autoSync: factoryAutoSync,
								}
								saveSection({ imageFactory: factory }, setSavingFactory, 'Image factory')
							}}
							disabled={savingFactory}
						>
							{savingFactory ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<div className="space-y-4">
						<Input
							label="Factory URL"
							value={factoryURL}
							onChange={(e) => setFactoryURL(e.target.value)}
							placeholder="https://factory.butlerlabs.dev"
						/>
						<Input
							label="Credentials Secret"
							value={factoryCredRef}
							onChange={(e) => setFactoryCredRef(e.target.value)}
							placeholder="Secret name containing API key"
						/>
						<Input
							label="Default Schematic ID"
							value={factorySchematicID}
							onChange={(e) => setFactorySchematicID(e.target.value)}
							placeholder="SHA-256 hex string"
						/>
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-neutral-200">Auto Sync</p>
								<p className="text-xs text-neutral-500">
									Automatically sync images when a cluster references an unavailable image
								</p>
							</div>
							<label className="relative inline-flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={factoryAutoSync}
									onChange={(e) => setFactoryAutoSync(e.target.checked)}
									className="sr-only peer"
								/>
								<div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
							</label>
						</div>
					</div>
				</Card>

				{/* SSH Authorized Key */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">SSH Authorized Key</h2>
						<Button
							size="sm"
							onClick={() =>
								saveSection({ sshAuthorizedKey: sshKey }, setSavingSSH, 'SSH key')
							}
							disabled={savingSSH}
						>
							{savingSSH ? 'Saving...' : 'Save'}
						</Button>
					</div>
					<p className="text-xs text-neutral-500 mb-4">
						Default SSH public key injected into non-Talos worker nodes for diagnostic access. Can
						be overridden per cluster.
					</p>
					<textarea
						value={sshKey}
						onChange={(e) => setSSHKey(e.target.value)}
						rows={3}
						placeholder="ssh-ed25519 AAAA..."
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm resize-none"
					/>
				</Card>
			</div>
		</FadeIn>
	)
}

// --- Sub-component for CP resource rows ---

interface CPResourceRowProps {
	label: string
	value?: {
		requests?: { cpu?: string; memory?: string }
		limits?: { cpu?: string; memory?: string }
	}
	onChange: (value: {
		requests?: { cpu?: string; memory?: string }
		limits?: { cpu?: string; memory?: string }
	}) => void
}

function CPResourceRow({ label, value, onChange }: CPResourceRowProps) {
	const requests = value?.requests || {}
	const limits = value?.limits || {}

	return (
		<div>
			<h3 className="text-sm font-medium text-neutral-300 mb-2">{label}</h3>
			<div className="grid grid-cols-4 gap-3">
				<Input
					label="Request CPU"
					value={requests.cpu || ''}
					onChange={(e) =>
						onChange({
							...value,
							requests: { ...requests, cpu: e.target.value },
						})
					}
					placeholder="100m"
				/>
				<Input
					label="Request Memory"
					value={requests.memory || ''}
					onChange={(e) =>
						onChange({
							...value,
							requests: { ...requests, memory: e.target.value },
						})
					}
					placeholder="256Mi"
				/>
				<Input
					label="Limit CPU"
					value={limits.cpu || ''}
					onChange={(e) =>
						onChange({
							...value,
							limits: { ...limits, cpu: e.target.value },
						})
					}
					placeholder="2"
				/>
				<Input
					label="Limit Memory"
					value={limits.memory || ''}
					onChange={(e) =>
						onChange({
							...value,
							limits: { ...limits, memory: e.target.value },
						})
					}
					placeholder="1Gi"
				/>
			</div>
		</div>
	)
}
