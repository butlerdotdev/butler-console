// src/pages/CreateProviderPage.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { providersApi, type CreateProviderRequest } from '@/api/providers'
import { Card, Button, FadeIn, Spinner } from '@/components/ui'
import { ProviderIcon } from '@/components/providers/ProviderIcon'
import { useToast } from '@/hooks/useToast'

type ProviderType = 'harvester' | 'nutanix' | 'proxmox' | 'aws' | 'azure' | 'gcp'
const CLOUD_TYPES: ProviderType[] = ['aws', 'azure', 'gcp']
const ON_PREM_TYPES: ProviderType[] = ['harvester', 'nutanix', 'proxmox']

export function CreateProviderPage() {
	useDocumentTitle('Add Provider')
	const navigate = useNavigate()
	const { success, error: showError } = useToast()

	const [providerType, setProviderType] = useState<ProviderType>('harvester')
	const [loading, setLoading] = useState(false)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Common fields
	const [name, setName] = useState('')
	const [namespace, setNamespace] = useState('butler-system')

	// Harvester credentials
	const [kubeconfig, setKubeconfig] = useState('')

	// Nutanix credentials & endpoint
	const [nutanixEndpoint, setNutanixEndpoint] = useState('')
	const [nutanixPort, setNutanixPort] = useState(9440)
	const [nutanixUsername, setNutanixUsername] = useState('')
	const [nutanixPassword, setNutanixPassword] = useState('')
	const [nutanixInsecure, setNutanixInsecure] = useState(false)

	// Proxmox credentials & endpoint
	const [proxmoxEndpoint, setProxmoxEndpoint] = useState('')
	const [proxmoxUsername, setProxmoxUsername] = useState('')
	const [proxmoxPassword, setProxmoxPassword] = useState('')
	const [proxmoxTokenId, setProxmoxTokenId] = useState('')
	const [proxmoxTokenSecret, setProxmoxTokenSecret] = useState('')
	const [proxmoxAuthType, setProxmoxAuthType] = useState<'password' | 'token'>('password')
	const [proxmoxInsecure, setProxmoxInsecure] = useState(false)

	// AWS credentials
	const [awsRegion, setAwsRegion] = useState('')
	const [awsAccessKeyId, setAwsAccessKeyId] = useState('')
	const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('')
	const [awsVpcId, setAwsVpcId] = useState('')
	const [awsSubnetIds, setAwsSubnetIds] = useState<string[]>([''])
	const [awsSecurityGroupIds, setAwsSecurityGroupIds] = useState<string[]>([''])

	// Azure credentials
	const [azureSubscriptionId, setAzureSubscriptionId] = useState('')
	const [azureTenantId, setAzureTenantId] = useState('')
	const [azureClientId, setAzureClientId] = useState('')
	const [azureClientSecret, setAzureClientSecret] = useState('')
	const [azureResourceGroup, setAzureResourceGroup] = useState('')
	const [azureLocation, setAzureLocation] = useState('')
	const [azureVnetName, setAzureVnetName] = useState('')
	const [azureSubnetName, setAzureSubnetName] = useState('')

	// GCP credentials
	const [gcpProjectId, setGcpProjectId] = useState('')
	const [gcpRegion, setGcpRegion] = useState('')
	const [gcpServiceAccount, setGcpServiceAccount] = useState('')
	const [gcpNetwork, setGcpNetwork] = useState('')
	const [gcpSubnetwork, setGcpSubnetwork] = useState('')

	// Network configuration
	const [networkMode, setNetworkMode] = useState<'ipam' | 'cloud' | ''>('')
	const [networkSubnet, setNetworkSubnet] = useState('')
	const [networkGateway, setNetworkGateway] = useState('')
	const [networkDnsServers, setNetworkDnsServers] = useState('')
	const [poolRefs, setPoolRefs] = useState<Array<{ name: string; priority?: number }>>([])
	const [lbDefaultPoolSize, setLbDefaultPoolSize] = useState<number | ''>('')
	const [quotaMaxNodeIPs, setQuotaMaxNodeIPs] = useState<number | ''>('')
	const [quotaMaxLoadBalancerIPs, setQuotaMaxLoadBalancerIPs] = useState<number | ''>('')

	// Scope
	const [scopeType, setScopeType] = useState<'platform' | 'team' | ''>('')
	const [scopeTeamRef, setScopeTeamRef] = useState('')

	// Limits
	const [maxClustersPerTeam, setMaxClustersPerTeam] = useState<number | ''>('')
	const [maxNodesPerTeam, setMaxNodesPerTeam] = useState<number | ''>('')

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			const reader = new FileReader()
			reader.onload = (event) => {
				setKubeconfig(event.target?.result as string)
				setTestResult(null) // Reset test result when credentials change
			}
			reader.readAsText(file)
		}
	}

	const buildRequest = (): CreateProviderRequest | null => {
		if (!name) {
			setError('Provider name is required')
			return null
		}

		// Validate credentials based on provider type
		if (providerType === 'harvester' && !kubeconfig) {
			setError('Kubeconfig is required for Harvester')
			return null
		}
		if (providerType === 'nutanix') {
			if (!nutanixEndpoint) {
				setError('Endpoint is required')
				return null
			}
			if (!nutanixUsername || !nutanixPassword) {
				setError('Username and password are required')
				return null
			}
		}
		if (providerType === 'proxmox') {
			if (!proxmoxEndpoint) {
				setError('Endpoint is required')
				return null
			}
			if (proxmoxAuthType === 'password' && (!proxmoxUsername || !proxmoxPassword)) {
				setError('Username and password are required')
				return null
			}
			if (proxmoxAuthType === 'token' && (!proxmoxTokenId || !proxmoxTokenSecret)) {
				setError('Token ID and secret are required')
				return null
			}
		}
		if (providerType === 'aws') {
			if (!awsRegion) { setError('Region is required'); return null }
			if (!awsAccessKeyId || !awsSecretAccessKey) { setError('AWS credentials are required'); return null }
		}
		if (providerType === 'azure') {
			if (!azureSubscriptionId) { setError('Subscription ID is required'); return null }
			if (!azureTenantId || !azureClientId || !azureClientSecret) { setError('Azure credentials are required'); return null }
		}
		if (providerType === 'gcp') {
			if (!gcpProjectId || !gcpRegion) { setError('Project ID and region are required'); return null }
			if (!gcpServiceAccount) { setError('Service account key is required'); return null }
		}

		const request: CreateProviderRequest = {
			name,
			namespace,
			provider: providerType,
		}

		if (providerType === 'harvester') {
			request.harvesterKubeconfig = kubeconfig
		} else if (providerType === 'nutanix') {
			request.nutanixEndpoint = nutanixEndpoint
			request.nutanixPort = nutanixPort
			request.nutanixUsername = nutanixUsername
			request.nutanixPassword = nutanixPassword
			request.nutanixInsecure = nutanixInsecure
		} else if (providerType === 'proxmox') {
			request.proxmoxEndpoint = proxmoxEndpoint
			request.proxmoxInsecure = proxmoxInsecure
			if (proxmoxAuthType === 'password') {
				request.proxmoxUsername = proxmoxUsername
				request.proxmoxPassword = proxmoxPassword
			} else {
				request.proxmoxTokenId = proxmoxTokenId
				request.proxmoxTokenSecret = proxmoxTokenSecret
			}
		} else if (providerType === 'aws') {
			request.awsRegion = awsRegion
			request.awsAccessKeyId = awsAccessKeyId
			request.awsSecretAccessKey = awsSecretAccessKey
			if (awsVpcId) request.awsVpcId = awsVpcId
			const subnets = awsSubnetIds.filter(s => s.trim())
			if (subnets.length > 0) request.awsSubnetIds = subnets
			const sgs = awsSecurityGroupIds.filter(s => s.trim())
			if (sgs.length > 0) request.awsSecurityGroupIds = sgs
		} else if (providerType === 'azure') {
			request.azureSubscriptionId = azureSubscriptionId
			request.azureTenantId = azureTenantId
			request.azureClientId = azureClientId
			request.azureClientSecret = azureClientSecret
			if (azureResourceGroup) request.azureResourceGroup = azureResourceGroup
			if (azureLocation) request.azureLocation = azureLocation
			if (azureVnetName) request.azureVnetName = azureVnetName
			if (azureSubnetName) request.azureSubnetName = azureSubnetName
		} else if (providerType === 'gcp') {
			request.gcpProjectId = gcpProjectId
			request.gcpRegion = gcpRegion
			request.gcpServiceAccount = gcpServiceAccount
			if (gcpNetwork) request.gcpNetwork = gcpNetwork
			if (gcpSubnetwork) request.gcpSubnetwork = gcpSubnetwork
		}

		// Network configuration
		if (networkMode === 'ipam' || networkMode === 'cloud') {
			request.networkMode = networkMode
		}
		if (networkMode === 'ipam') {
			if (networkSubnet) request.networkSubnet = networkSubnet
			if (networkGateway) request.networkGateway = networkGateway
			if (networkDnsServers.trim()) {
				request.networkDnsServers = networkDnsServers.split(',').map((s) => s.trim()).filter(Boolean)
			}
			if (poolRefs.length > 0) {
				request.poolRefs = poolRefs.filter((p) => p.name.trim())
			}
			if (lbDefaultPoolSize !== '') request.lbDefaultPoolSize = lbDefaultPoolSize
			if (quotaMaxNodeIPs !== '') request.quotaMaxNodeIPs = quotaMaxNodeIPs
			if (quotaMaxLoadBalancerIPs !== '') request.quotaMaxLoadBalancerIPs = quotaMaxLoadBalancerIPs
		}

		// Scope
		if (scopeType === 'platform' || scopeType === 'team') {
			request.scopeType = scopeType
		}
		if (scopeType === 'team' && scopeTeamRef) {
			request.scopeTeamRef = scopeTeamRef
		}

		// Limits
		if (maxClustersPerTeam !== '') request.maxClustersPerTeam = maxClustersPerTeam
		if (maxNodesPerTeam !== '') request.maxNodesPerTeam = maxNodesPerTeam

		return request
	}

	const handleTestConnection = async () => {
		setError(null)
		setTestResult(null)

		const request = buildRequest()
		if (!request) return

		try {
			setTesting(true)
			const result = await providersApi.testConnection(request)
			setTestResult(result)
			if (result.valid) {
				success('Connection Successful', result.message)
			} else {
				showError('Connection Failed', result.message)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Connection test failed'
			setTestResult({ valid: false, message })
			showError('Test Failed', message)
		} finally {
			setTesting(false)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		const request = buildRequest()
		if (!request) return

		try {
			setLoading(true)
			await providersApi.create(request)
			success('Provider Created', `${name} has been created`)
			navigate('/providers')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create provider'
			setError(message)
			showError('Creation Failed', message)
		} finally {
			setLoading(false)
		}
	}

	// Check if we have enough info to test
	const canTest = () => {
		if (providerType === 'harvester') return !!kubeconfig
		if (providerType === 'nutanix') return !!(nutanixEndpoint && nutanixUsername && nutanixPassword)
		if (providerType === 'proxmox') {
			if (!proxmoxEndpoint) return false
			if (proxmoxAuthType === 'password') return !!(proxmoxUsername && proxmoxPassword)
			return !!(proxmoxTokenId && proxmoxTokenSecret)
		}
		if (providerType === 'aws') return !!(awsRegion && awsAccessKeyId && awsSecretAccessKey)
		if (providerType === 'azure') return !!(azureSubscriptionId && azureTenantId && azureClientId && azureClientSecret)
		if (providerType === 'gcp') return !!(gcpProjectId && gcpRegion && gcpServiceAccount)
		return false
	}

	return (
		<FadeIn>
			<div className="max-w-xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-neutral-50">Add Provider</h1>
					<p className="text-neutral-400 mt-1">Configure connection to an infrastructure provider</p>
				</div>

				<form onSubmit={handleSubmit}>
					<Card className="p-6 space-y-6">
						{/* Provider Type Selection */}
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-2">
								On-Premises
							</label>
							<div className="grid grid-cols-3 gap-3 mb-4">
								{ON_PREM_TYPES.map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => {
											setProviderType(type)
											setTestResult(null)
											if (CLOUD_TYPES.includes(providerType as ProviderType)) {
												setNetworkMode('')
											}
										}}
										className={`p-4 rounded-lg border-2 transition-colors ${providerType === type
											? 'border-green-500 bg-green-500/10'
											: 'border-neutral-700 hover:border-neutral-600'
											}`}
									>
										<div className="text-center">
											<ProviderIcon type={type} className="w-8 h-8 mx-auto mb-2" />
											<p className="text-sm font-medium text-neutral-200 capitalize">{type}</p>
										</div>
									</button>
								))}
							</div>
							<label className="block text-sm font-medium text-neutral-400 mb-2">
								Cloud
							</label>
							<div className="grid grid-cols-3 gap-3">
								{CLOUD_TYPES.map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => {
											setProviderType(type)
											setTestResult(null)
											setNetworkMode('cloud')
										}}
										className={`p-4 rounded-lg border-2 transition-colors ${providerType === type
											? 'border-green-500 bg-green-500/10'
											: 'border-neutral-700 hover:border-neutral-600'
											}`}
									>
										<div className="text-center">
											<ProviderIcon type={type} className="w-8 h-8 mx-auto mb-2" />
											<p className="text-sm font-medium text-neutral-200 uppercase">{type}</p>
										</div>
									</button>
								))}
							</div>
						</div>

						{/* Name */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">
									Provider Name *
								</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={`my-${providerType}`}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">
									Namespace
								</label>
								<input
									type="text"
									value={namespace}
									onChange={(e) => setNamespace(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								/>
							</div>
						</div>

						{/* Provider-specific credentials */}
						{providerType === 'harvester' && (
							<HarvesterCredentials
								kubeconfig={kubeconfig}
								setKubeconfig={(v) => { setKubeconfig(v); setTestResult(null) }}
								onFileUpload={handleFileUpload}
							/>
						)}

						{providerType === 'nutanix' && (
							<NutanixCredentials
								endpoint={nutanixEndpoint}
								setEndpoint={(v) => { setNutanixEndpoint(v); setTestResult(null) }}
								port={nutanixPort}
								setPort={setNutanixPort}
								username={nutanixUsername}
								setUsername={(v) => { setNutanixUsername(v); setTestResult(null) }}
								password={nutanixPassword}
								setPassword={(v) => { setNutanixPassword(v); setTestResult(null) }}
								insecure={nutanixInsecure}
								setInsecure={setNutanixInsecure}
							/>
						)}

						{providerType === 'proxmox' && (
							<ProxmoxCredentials
								endpoint={proxmoxEndpoint}
								setEndpoint={(v) => { setProxmoxEndpoint(v); setTestResult(null) }}
								authType={proxmoxAuthType}
								setAuthType={setProxmoxAuthType}
								username={proxmoxUsername}
								setUsername={(v) => { setProxmoxUsername(v); setTestResult(null) }}
								password={proxmoxPassword}
								setPassword={(v) => { setProxmoxPassword(v); setTestResult(null) }}
								tokenId={proxmoxTokenId}
								setTokenId={(v) => { setProxmoxTokenId(v); setTestResult(null) }}
								tokenSecret={proxmoxTokenSecret}
								setTokenSecret={(v) => { setProxmoxTokenSecret(v); setTestResult(null) }}
								insecure={proxmoxInsecure}
								setInsecure={setProxmoxInsecure}
							/>
						)}

						{providerType === 'aws' && (
							<AWSCredentials
								region={awsRegion} setRegion={(v) => { setAwsRegion(v); setTestResult(null) }}
								accessKeyId={awsAccessKeyId} setAccessKeyId={(v) => { setAwsAccessKeyId(v); setTestResult(null) }}
								secretAccessKey={awsSecretAccessKey} setSecretAccessKey={(v) => { setAwsSecretAccessKey(v); setTestResult(null) }}
								vpcId={awsVpcId} setVpcId={setAwsVpcId}
								subnetIds={awsSubnetIds} setSubnetIds={setAwsSubnetIds}
								securityGroupIds={awsSecurityGroupIds} setSecurityGroupIds={setAwsSecurityGroupIds}
							/>
						)}

						{providerType === 'azure' && (
							<AzureCredentials
								subscriptionId={azureSubscriptionId} setSubscriptionId={(v) => { setAzureSubscriptionId(v); setTestResult(null) }}
								tenantId={azureTenantId} setTenantId={(v) => { setAzureTenantId(v); setTestResult(null) }}
								clientId={azureClientId} setClientId={(v) => { setAzureClientId(v); setTestResult(null) }}
								clientSecret={azureClientSecret} setClientSecret={(v) => { setAzureClientSecret(v); setTestResult(null) }}
								resourceGroup={azureResourceGroup} setResourceGroup={setAzureResourceGroup}
								location={azureLocation} setLocation={setAzureLocation}
								vnetName={azureVnetName} setVnetName={setAzureVnetName}
								subnetName={azureSubnetName} setSubnetName={setAzureSubnetName}
							/>
						)}

						{providerType === 'gcp' && (
							<GCPCredentials
								projectId={gcpProjectId} setProjectId={(v) => { setGcpProjectId(v); setTestResult(null) }}
								region={gcpRegion} setRegion={(v) => { setGcpRegion(v); setTestResult(null) }}
								serviceAccount={gcpServiceAccount} setServiceAccount={(v) => { setGcpServiceAccount(v); setTestResult(null) }}
								network={gcpNetwork} setNetwork={setGcpNetwork}
								subnetwork={gcpSubnetwork} setSubnetwork={setGcpSubnetwork}
							/>
						)}

						{/* Network Configuration */}
						<NetworkConfigurationSection
							networkMode={networkMode}
							setNetworkMode={setNetworkMode}
							networkSubnet={networkSubnet}
							setNetworkSubnet={setNetworkSubnet}
							networkGateway={networkGateway}
							setNetworkGateway={setNetworkGateway}
							networkDnsServers={networkDnsServers}
							setNetworkDnsServers={setNetworkDnsServers}
							poolRefs={poolRefs}
							setPoolRefs={setPoolRefs}
							lbDefaultPoolSize={lbDefaultPoolSize}
							setLbDefaultPoolSize={setLbDefaultPoolSize}
							quotaMaxNodeIPs={quotaMaxNodeIPs}
							setQuotaMaxNodeIPs={setQuotaMaxNodeIPs}
							quotaMaxLoadBalancerIPs={quotaMaxLoadBalancerIPs}
							setQuotaMaxLoadBalancerIPs={setQuotaMaxLoadBalancerIPs}
						/>

						{/* Scope */}
						<ScopeSection
							scopeType={scopeType}
							setScopeType={setScopeType}
							scopeTeamRef={scopeTeamRef}
							setScopeTeamRef={setScopeTeamRef}
						/>

						{/* Limits */}
						<LimitsSection
							maxClustersPerTeam={maxClustersPerTeam}
							setMaxClustersPerTeam={setMaxClustersPerTeam}
							maxNodesPerTeam={maxNodesPerTeam}
							setMaxNodesPerTeam={setMaxNodesPerTeam}
						/>

						{/* Test Connection */}
						<div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-neutral-200">Test Connection</p>
									<p className="text-xs text-neutral-500">Verify credentials before saving</p>
								</div>
								<Button
									type="button"
									variant="secondary"
									onClick={handleTestConnection}
									disabled={!canTest() || testing}
								>
									{testing ? (
										<>
											<Spinner size="sm" className="mr-2" />
											Testing...
										</>
									) : (
										'Test Connection'
									)}
								</Button>
							</div>
							{testResult && (
								<div className={`mt-3 p-3 rounded-lg ${testResult.valid
									? 'bg-green-500/10 border border-green-500/20'
									: 'bg-red-500/10 border border-red-500/20'
									}`}>
									<div className="flex items-center gap-2">
										{testResult.valid ? (
											<svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
										) : (
											<svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										)}
										<span className={`text-sm ${testResult.valid ? 'text-green-400' : 'text-red-400'}`}>
											{testResult.message}
										</span>
									</div>
								</div>
							)}
						</div>

						{/* Info box */}
						<div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
							<p className="text-sm text-blue-400">
								<strong>Note:</strong> Infrastructure settings like subnets, images, and storage are configured per-cluster when you create a TenantCluster.
							</p>
						</div>

						{/* Error */}
						{error && (
							<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
								<p className="text-red-400 text-sm">{error}</p>
							</div>
						)}

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
							<Button type="button" variant="secondary" onClick={() => navigate('/providers')}>
								Cancel
							</Button>
							<Button type="submit" disabled={loading}>
								{loading ? 'Creating...' : 'Create Provider'}
							</Button>
						</div>
					</Card>
				</form>
			</div>
		</FadeIn>
	)
}

function HarvesterCredentials({
	kubeconfig,
	setKubeconfig,
	onFileUpload,
}: {
	kubeconfig: string
	setKubeconfig: (v: string) => void
	onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
	return (
		<div>
			<h3 className="text-lg font-medium text-neutral-50 mb-4">Harvester Credentials</h3>
			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-1">
						Kubeconfig *
					</label>
					<p className="text-xs text-neutral-500 mb-2">
						Upload your Harvester cluster kubeconfig file or paste the contents below
					</p>
					<div className="flex gap-2 mb-2">
						<label className="flex-1">
							<input
								type="file"
								onChange={onFileUpload}
								className="hidden"
							/>
							<div className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-neutral-200 cursor-pointer text-center transition-colors">
								Upload kubeconfig file
							</div>
						</label>
					</div>
					<textarea
						value={kubeconfig}
						onChange={(e) => setKubeconfig(e.target.value)}
						placeholder="Paste kubeconfig contents here..."
						rows={8}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				</div>
			</div>
		</div>
	)
}

function NutanixCredentials({
	endpoint,
	setEndpoint,
	port,
	setPort,
	username,
	setUsername,
	password,
	setPassword,
	insecure,
	setInsecure,
}: {
	endpoint: string
	setEndpoint: (v: string) => void
	port: number
	setPort: (v: number) => void
	username: string
	setUsername: (v: string) => void
	password: string
	setPassword: (v: string) => void
	insecure: boolean
	setInsecure: (v: boolean) => void
}) {
	return (
		<div>
			<h3 className="text-lg font-medium text-neutral-50 mb-4">Nutanix Connection</h3>
			<div className="space-y-4">
				<div className="grid grid-cols-3 gap-4">
					<div className="col-span-2">
						<label className="block text-sm font-medium text-neutral-400 mb-1">
							Prism Central Endpoint *
						</label>
						<input
							type="text"
							value={endpoint}
							onChange={(e) => setEndpoint(e.target.value)}
							placeholder="https://prism.example.com"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">
							Port
						</label>
						<input
							type="number"
							value={port}
							onChange={(e) => setPort(parseInt(e.target.value) || 9440)}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">
							Username *
						</label>
						<input
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="admin@example.com"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">
							Password *
						</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>
				</div>
				<label className="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={insecure}
						onChange={(e) => setInsecure(e.target.checked)}
						className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-green-500 focus:ring-green-500"
					/>
					<span className="text-sm text-neutral-400">Allow insecure TLS (skip certificate verification)</span>
				</label>
			</div>
		</div>
	)
}

function ProxmoxCredentials({
	endpoint,
	setEndpoint,
	authType,
	setAuthType,
	username,
	setUsername,
	password,
	setPassword,
	tokenId,
	setTokenId,
	tokenSecret,
	setTokenSecret,
	insecure,
	setInsecure,
}: {
	endpoint: string
	setEndpoint: (v: string) => void
	authType: 'password' | 'token'
	setAuthType: (v: 'password' | 'token') => void
	username: string
	setUsername: (v: string) => void
	password: string
	setPassword: (v: string) => void
	tokenId: string
	setTokenId: (v: string) => void
	tokenSecret: string
	setTokenSecret: (v: string) => void
	insecure: boolean
	setInsecure: (v: boolean) => void
}) {
	return (
		<div>
			<h3 className="text-lg font-medium text-neutral-50 mb-4">Proxmox Connection</h3>
			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-1">
						Proxmox Endpoint *
					</label>
					<input
						type="text"
						value={endpoint}
						onChange={(e) => setEndpoint(e.target.value)}
						placeholder="https://pve.example.com:8006"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				</div>

				{/* Auth type toggle */}
				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-2">
						Authentication Method
					</label>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setAuthType('password')}
							className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${authType === 'password'
								? 'bg-green-500/20 text-green-400 border border-green-500'
								: 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
								}`}
						>
							Username/Password
						</button>
						<button
							type="button"
							onClick={() => setAuthType('token')}
							className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${authType === 'token'
								? 'bg-green-500/20 text-green-400 border border-green-500'
								: 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
								}`}
						>
							API Token
						</button>
					</div>
				</div>

				{authType === 'password' ? (
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Username *
							</label>
							<input
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="root@pam"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Password *
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Token ID *
							</label>
							<input
								type="text"
								value={tokenId}
								onChange={(e) => setTokenId(e.target.value)}
								placeholder="user@pam!tokenname"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Token Secret *
							</label>
							<input
								type="password"
								value={tokenSecret}
								onChange={(e) => setTokenSecret(e.target.value)}
								placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>
				)}

				<label className="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={insecure}
						onChange={(e) => setInsecure(e.target.checked)}
						className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-green-500 focus:ring-green-500"
					/>
					<span className="text-sm text-neutral-400">Allow insecure TLS (skip certificate verification)</span>
				</label>
			</div>
		</div>
	)
}

function NetworkConfigurationSection({
	networkMode,
	setNetworkMode,
	networkSubnet,
	setNetworkSubnet,
	networkGateway,
	setNetworkGateway,
	networkDnsServers,
	setNetworkDnsServers,
	poolRefs,
	setPoolRefs,
	lbDefaultPoolSize,
	setLbDefaultPoolSize,
	quotaMaxNodeIPs,
	setQuotaMaxNodeIPs,
	quotaMaxLoadBalancerIPs,
	setQuotaMaxLoadBalancerIPs,
}: {
	networkMode: 'ipam' | 'cloud' | ''
	setNetworkMode: (v: 'ipam' | 'cloud' | '') => void
	networkSubnet: string
	setNetworkSubnet: (v: string) => void
	networkGateway: string
	setNetworkGateway: (v: string) => void
	networkDnsServers: string
	setNetworkDnsServers: (v: string) => void
	poolRefs: Array<{ name: string; priority?: number }>
	setPoolRefs: (v: Array<{ name: string; priority?: number }>) => void
	lbDefaultPoolSize: number | ''
	setLbDefaultPoolSize: (v: number | '') => void
	quotaMaxNodeIPs: number | ''
	setQuotaMaxNodeIPs: (v: number | '') => void
	quotaMaxLoadBalancerIPs: number | ''
	setQuotaMaxLoadBalancerIPs: (v: number | '') => void
}) {
	const [expanded, setExpanded] = useState(false)

	const addPoolRef = () => {
		setPoolRefs([...poolRefs, { name: '', priority: undefined }])
	}

	const removePoolRef = (index: number) => {
		setPoolRefs(poolRefs.filter((_, i) => i !== index))
	}

	const updatePoolRef = (index: number, field: 'name' | 'priority', value: string | number) => {
		const updated = [...poolRefs]
		if (field === 'name') {
			updated[index] = { ...updated[index], name: value as string }
		} else {
			updated[index] = { ...updated[index], priority: value === '' ? undefined : Number(value) }
		}
		setPoolRefs(updated)
	}

	return (
		<div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 w-full text-left"
			>
				<svg
					className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
				</svg>
				<h3 className="text-lg font-medium text-neutral-50">Network Configuration</h3>
				<span className="text-xs text-neutral-500 ml-2">Optional</span>
			</button>

			{expanded && (
				<div className="mt-4 space-y-4 pl-6">
					{/* Network Mode */}
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-2">
							Network Mode
						</label>
						<div className="flex gap-2">
							{(['', 'ipam', 'cloud'] as const).map((mode) => (
								<button
									key={mode || 'none'}
									type="button"
									onClick={() => setNetworkMode(mode)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${networkMode === mode
										? 'bg-green-500/20 text-green-400 border border-green-500'
										: 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
										}`}
								>
									{mode === '' ? 'Not Set' : mode === 'ipam' ? 'IPAM' : 'Cloud'}
								</button>
							))}
						</div>
						<p className="text-xs text-neutral-500 mt-1">
							{networkMode === 'ipam'
								? 'On-prem pool-based IP address management'
								: networkMode === 'cloud'
									? 'IPs managed by cloud provider'
									: 'Select a network mode to configure IP management'}
						</p>
					</div>

					{networkMode === 'ipam' && (
						<div className="space-y-4">
							{/* Pool References */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<label className="block text-sm font-medium text-neutral-400">
										Pool References
									</label>
									<button
										type="button"
										onClick={addPoolRef}
										className="text-xs text-green-400 hover:text-green-300 transition-colors"
									>
										+ Add Pool
									</button>
								</div>
								{poolRefs.length === 0 && (
									<p className="text-xs text-neutral-500">No pool references configured.</p>
								)}
								{poolRefs.map((pool, index) => (
									<div key={index} className="flex gap-2 mb-2 items-center">
										<input
											type="text"
											value={pool.name}
											onChange={(e) => updatePoolRef(index, 'name', e.target.value)}
											placeholder="Pool name"
											className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
										/>
										<input
											type="number"
											value={pool.priority ?? ''}
											onChange={(e) => updatePoolRef(index, 'priority', e.target.value)}
											placeholder="Priority"
											className="w-24 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
										/>
										<button
											type="button"
											onClick={() => removePoolRef(index)}
											className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
											aria-label="Remove pool reference"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								))}
							</div>

							{/* Subnet and Gateway */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Subnet
									</label>
									<input
										type="text"
										value={networkSubnet}
										onChange={(e) => setNetworkSubnet(e.target.value)}
										placeholder="10.40.0.0/16"
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Gateway
									</label>
									<input
										type="text"
										value={networkGateway}
										onChange={(e) => setNetworkGateway(e.target.value)}
										placeholder="10.40.0.1"
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
							</div>

							{/* DNS Servers */}
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">
									DNS Servers
								</label>
								<input
									type="text"
									value={networkDnsServers}
									onChange={(e) => setNetworkDnsServers(e.target.value)}
									placeholder="8.8.8.8, 8.8.4.4"
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								/>
								<p className="text-xs text-neutral-500 mt-1">Comma-separated list of DNS server addresses</p>
							</div>

							{/* LB Default Pool Size */}
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">
									LB Default Pool Size
								</label>
								<input
									type="number"
									value={lbDefaultPoolSize}
									onChange={(e) => setLbDefaultPoolSize(e.target.value === '' ? '' : parseInt(e.target.value))}
									placeholder="e.g. 8"
									min={0}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								/>
							</div>

							{/* Quotas */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Quota: Max Node IPs
									</label>
									<input
										type="number"
										value={quotaMaxNodeIPs}
										onChange={(e) => setQuotaMaxNodeIPs(e.target.value === '' ? '' : parseInt(e.target.value))}
										placeholder="e.g. 50"
										min={0}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Quota: Max LB IPs
									</label>
									<input
										type="number"
										value={quotaMaxLoadBalancerIPs}
										onChange={(e) => setQuotaMaxLoadBalancerIPs(e.target.value === '' ? '' : parseInt(e.target.value))}
										placeholder="e.g. 10"
										min={0}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
							</div>
						</div>
					)}

					{networkMode === 'cloud' && (
						<div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg">
							<p className="text-sm text-neutral-400">
								IPs managed by cloud provider. No additional network configuration is needed.
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

function ScopeSection({
	scopeType,
	setScopeType,
	scopeTeamRef,
	setScopeTeamRef,
}: {
	scopeType: 'platform' | 'team' | ''
	setScopeType: (v: 'platform' | 'team' | '') => void
	scopeTeamRef: string
	setScopeTeamRef: (v: string) => void
}) {
	const [expanded, setExpanded] = useState(false)

	return (
		<div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 w-full text-left"
			>
				<svg
					className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
				</svg>
				<h3 className="text-lg font-medium text-neutral-50">Scope</h3>
				<span className="text-xs text-neutral-500 ml-2">Optional</span>
			</button>

			{expanded && (
				<div className="mt-4 space-y-4 pl-6">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-2">
							Scope Type
						</label>
						<div className="flex gap-2">
							{(['', 'platform', 'team'] as const).map((type) => (
								<button
									key={type || 'none'}
									type="button"
									onClick={() => setScopeType(type)}
									className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scopeType === type
										? 'bg-green-500/20 text-green-400 border border-green-500'
										: 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
										}`}
								>
									{type === '' ? 'Not Set' : type === 'platform' ? 'Platform' : 'Team'}
								</button>
							))}
						</div>
						<p className="text-xs text-neutral-500 mt-1">
							{scopeType === 'platform'
								? 'Available to all teams on the platform'
								: scopeType === 'team'
									? 'Restricted to a specific team'
									: 'Select a scope to control provider visibility'}
						</p>
					</div>

					{scopeType === 'team' && (
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Team Name
							</label>
							<input
								type="text"
								value={scopeTeamRef}
								onChange={(e) => setScopeTeamRef(e.target.value)}
								placeholder="e.g. engineering"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

function LimitsSection({
	maxClustersPerTeam,
	setMaxClustersPerTeam,
	maxNodesPerTeam,
	setMaxNodesPerTeam,
}: {
	maxClustersPerTeam: number | ''
	setMaxClustersPerTeam: (v: number | '') => void
	maxNodesPerTeam: number | ''
	setMaxNodesPerTeam: (v: number | '') => void
}) {
	const [expanded, setExpanded] = useState(false)

	return (
		<div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 w-full text-left"
			>
				<svg
					className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
				</svg>
				<h3 className="text-lg font-medium text-neutral-50">Limits</h3>
				<span className="text-xs text-neutral-500 ml-2">Optional</span>
			</button>

			{expanded && (
				<div className="mt-4 space-y-4 pl-6">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Max Clusters per Team
							</label>
							<input
								type="number"
								value={maxClustersPerTeam}
								onChange={(e) => setMaxClustersPerTeam(e.target.value === '' ? '' : parseInt(e.target.value))}
								placeholder="No limit"
								min={0}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">
								Max Nodes per Team
							</label>
							<input
								type="number"
								value={maxNodesPerTeam}
								onChange={(e) => setMaxNodesPerTeam(e.target.value === '' ? '' : parseInt(e.target.value))}
								placeholder="No limit"
								min={0}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>
					<p className="text-xs text-neutral-500">
						Limits the number of clusters and nodes each team can create using this provider.
						Leave empty for no limit.
					</p>
				</div>
			)}
		</div>
	)
}

function DynamicListField({ label, values, setValues, placeholder }: {
	label: string
	values: string[]
	setValues: (v: string[]) => void
	placeholder: string
}) {
	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<label className="block text-sm font-medium text-neutral-400">{label}</label>
				<button type="button" onClick={() => setValues([...values, ''])} className="text-xs text-green-400 hover:text-green-300">+ Add</button>
			</div>
			{values.map((val, i) => (
				<div key={i} className="flex gap-2 mb-2">
					<input
						type="text"
						value={val}
						onChange={(e) => { const updated = [...values]; updated[i] = e.target.value; setValues(updated) }}
						placeholder={placeholder}
						className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
					{values.length > 1 && (
						<button type="button" onClick={() => setValues(values.filter((_, j) => j !== i))} className="p-2 text-neutral-500 hover:text-red-400">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					)}
				</div>
			))}
		</div>
	)
}

function AWSCredentials({ region, setRegion, accessKeyId, setAccessKeyId, secretAccessKey, setSecretAccessKey, vpcId, setVpcId, subnetIds, setSubnetIds, securityGroupIds, setSecurityGroupIds }: {
	region: string; setRegion: (v: string) => void
	accessKeyId: string; setAccessKeyId: (v: string) => void
	secretAccessKey: string; setSecretAccessKey: (v: string) => void
	vpcId: string; setVpcId: (v: string) => void
	subnetIds: string[]; setSubnetIds: (v: string[]) => void
	securityGroupIds: string[]; setSecurityGroupIds: (v: string[]) => void
}) {
	return (
		<div>
			<h3 className="text-lg font-medium text-neutral-50 mb-4">AWS Configuration</h3>
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Region *</label>
						<input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">VPC ID</label>
						<input type="text" value={vpcId} onChange={(e) => setVpcId(e.target.value)} placeholder="vpc-0123456789abcdef0"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Access Key ID *</label>
						<input type="text" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder="AKIA..."
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Secret Access Key *</label>
						<input type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder="••••••••"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
				<DynamicListField label="Subnet IDs" values={subnetIds} setValues={setSubnetIds} placeholder="subnet-0123456789abcdef0" />
				<DynamicListField label="Security Group IDs" values={securityGroupIds} setValues={setSecurityGroupIds} placeholder="sg-0123456789abcdef0" />
			</div>
		</div>
	)
}

function AzureCredentials({ subscriptionId, setSubscriptionId, tenantId, setTenantId, clientId, setClientId, clientSecret, setClientSecret, resourceGroup, setResourceGroup, location, setLocation, vnetName, setVnetName, subnetName, setSubnetName }: {
	subscriptionId: string; setSubscriptionId: (v: string) => void
	tenantId: string; setTenantId: (v: string) => void
	clientId: string; setClientId: (v: string) => void
	clientSecret: string; setClientSecret: (v: string) => void
	resourceGroup: string; setResourceGroup: (v: string) => void
	location: string; setLocation: (v: string) => void
	vnetName: string; setVnetName: (v: string) => void
	subnetName: string; setSubnetName: (v: string) => void
}) {
	return (
		<div>
			<h3 className="text-lg font-medium text-neutral-50 mb-4">Azure Configuration</h3>
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Subscription ID *</label>
						<input type="text" value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Tenant ID *</label>
						<input type="text" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Client ID *</label>
						<input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Client Secret *</label>
						<input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Resource Group</label>
						<input type="text" value={resourceGroup} onChange={(e) => setResourceGroup(e.target.value)} placeholder="my-resource-group"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Location</label>
						<input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="eastus"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">VNet Name</label>
						<input type="text" value={vnetName} onChange={(e) => setVnetName(e.target.value)} placeholder="my-vnet"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Subnet Name</label>
						<input type="text" value={subnetName} onChange={(e) => setSubnetName(e.target.value)} placeholder="default"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
			</div>
		</div>
	)
}

function GCPCredentials({ projectId, setProjectId, region, setRegion, serviceAccount, setServiceAccount, network, setNetwork, subnetwork, setSubnetwork }: {
	projectId: string; setProjectId: (v: string) => void
	region: string; setRegion: (v: string) => void
	serviceAccount: string; setServiceAccount: (v: string) => void
	network: string; setNetwork: (v: string) => void
	subnetwork: string; setSubnetwork: (v: string) => void
}) {
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			const reader = new FileReader()
			reader.onload = (event) => setServiceAccount(event.target?.result as string)
			reader.readAsText(file)
		}
	}

	return (
		<div>
			<h3 className="text-lg font-medium text-neutral-50 mb-4">GCP Configuration</h3>
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Project ID *</label>
						<input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="my-project-123"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Region *</label>
						<input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-central1"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-1">Service Account Key (JSON) *</label>
					<div className="flex gap-2 mb-2">
						<label className="flex-1">
							<input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
							<div className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-neutral-200 cursor-pointer text-center transition-colors">
								Upload JSON key file
							</div>
						</label>
					</div>
					<textarea
						value={serviceAccount}
						onChange={(e) => setServiceAccount(e.target.value)}
						placeholder='{"type": "service_account", ...}'
						rows={6}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">VPC Network</label>
						<input type="text" value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="default"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-400 mb-1">Subnetwork</label>
						<input type="text" value={subnetwork} onChange={(e) => setSubnetwork(e.target.value)} placeholder="default"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
					</div>
				</div>
			</div>
		</div>
	)
}

// ProviderIcon is imported from @/components/providers/ProviderIcon
