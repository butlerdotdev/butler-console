// src/pages/CreateProviderPage.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { providersApi, type CreateProviderRequest } from '@/api/providers'
import { Card, Button, FadeIn, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

type ProviderType = 'harvester' | 'nutanix' | 'proxmox'

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
		}

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
							<label className="block text-sm font-medium text-neutral-400 mb-3">
								Provider Type
							</label>
							<div className="grid grid-cols-3 gap-3">
								{(['harvester', 'nutanix', 'proxmox'] as ProviderType[]).map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => {
											setProviderType(type)
											setTestResult(null)
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

function ProviderIcon({ type, className }: { type: string; className?: string }) {
	return (
		<div className={`flex items-center justify-center ${className}`}>
			{type === 'harvester' && (
				<svg viewBox="0 0 24 24" className="w-full h-full">
					<rect x="2" y="4" width="20" height="16" rx="3" fill="#00875a" />
					<path d="M5 8h14M5 12h14M5 16h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
				</svg>
			)}
			{type === 'nutanix' && (
				<svg viewBox="0 0 24 24" className="w-full h-full">
					<polygon points="12,2 22,7 22,17 12,22 2,17 2,7" fill="#024DA1" />
					<polygon points="12,6 17,8.5 17,15.5 12,18 7,15.5 7,8.5" fill="#69BE28" />
				</svg>
			)}
			{type === 'proxmox' && (
				<svg viewBox="0 0 24 24" className="w-full h-full">
					<rect x="2" y="2" width="20" height="20" rx="2" fill="#E57000" />
					<path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
				</svg>
			)}
		</div>
	)
}
