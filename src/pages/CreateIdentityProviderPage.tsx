// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import {
	identityProvidersApi,
	PROVIDER_PRESETS,
	type ProviderPresetKey,
	type CreateIdentityProviderRequest,
	type TestDiscoveryResponse,
} from '@/api/identity-providers'
import { Card, Button, Input, FadeIn } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

// Provider icons (same as in list page)
function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
		</svg>
	)
}

function MicrosoftIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 21 21" fill="currentColor">
			<rect x="1" y="1" width="9" height="9" fill="#f25022" />
			<rect x="11" y="1" width="9" height="9" fill="#7fba00" />
			<rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
			<rect x="11" y="11" width="9" height="9" fill="#ffb900" />
		</svg>
	)
}

function OktaIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 0C5.389 0 0 5.389 0 12s5.389 12 12 12 12-5.389 12-12S18.611 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" fill="#007DC1" />
		</svg>
	)
}

function KeyIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
		</svg>
	)
}

type PresetOption = ProviderPresetKey | 'custom'

interface PresetConfig {
	key: PresetOption
	name: string
	icon: React.ReactNode
	description: string
}

const PRESET_OPTIONS: PresetConfig[] = [
	{
		key: 'google',
		name: 'Google Workspace',
		icon: <GoogleIcon className="w-6 h-6" />,
		description: 'Sign in with Google accounts',
	},
	{
		key: 'microsoft',
		name: 'Microsoft Entra ID',
		icon: <MicrosoftIcon className="w-6 h-6" />,
		description: 'Sign in with Microsoft/Azure AD',
	},
	{
		key: 'okta',
		name: 'Okta',
		icon: <OktaIcon className="w-6 h-6" />,
		description: 'Sign in with Okta',
	},
	{
		key: 'custom',
		name: 'Custom OIDC',
		icon: <KeyIcon className="w-6 h-6 text-blue-400" />,
		description: 'Any OIDC-compliant provider',
	},
]

export function CreateIdentityProviderPage() {
	useDocumentTitle('Add Identity Provider')
	const navigate = useNavigate()
	const toast = useToast()

	// Form state
	const [selectedPreset, setSelectedPreset] = useState<PresetOption | null>(null)
	const [name, setName] = useState('')
	const [displayName, setDisplayName] = useState('')
	const [issuerURL, setIssuerURL] = useState('')
	const [clientID, setClientID] = useState('')
	const [clientSecret, setClientSecret] = useState('')
	const [redirectURL, setRedirectURL] = useState('')
	const [hostedDomain, setHostedDomain] = useState('')
	const [showAdvanced, setShowAdvanced] = useState(false)
	const [scopes, setScopes] = useState('')
	const [groupsClaim, setGroupsClaim] = useState('')
	const [emailClaim, setEmailClaim] = useState('')

	// UI state
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<TestDiscoveryResponse | null>(null)
	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	function handlePresetSelect(preset: PresetOption) {
		setSelectedPreset(preset)
		setTestResult(null)
		setError(null)

		if (preset !== 'custom' && preset in PROVIDER_PRESETS) {
			const config = PROVIDER_PRESETS[preset as ProviderPresetKey]
			setDisplayName(config.name)
			setIssuerURL(config.issuerURL)
			setScopes(config.scopes.join(', '))
			setGroupsClaim(config.groupsClaim)
			setEmailClaim(config.emailClaim)
		} else {
			setDisplayName('')
			setIssuerURL('')
			setScopes('openid, email, profile')
			setGroupsClaim('groups')
			setEmailClaim('email')
		}
	}

	async function handleTestDiscovery() {
		if (!issuerURL) {
			setError('Issuer URL is required')
			return
		}

		try {
			setTesting(true)
			setError(null)
			setTestResult(null)

			const result = await identityProvidersApi.testDiscovery(issuerURL)
			setTestResult(result)

			if (!result.valid) {
				setError(result.message)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Discovery failed')
			setTestResult({ valid: false, message: 'Discovery failed' })
		} finally {
			setTesting(false)
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError(null)

		// Validate
		if (!name) {
			setError('Name is required')
			return
		}
		if (!issuerURL) {
			setError('Issuer URL is required')
			return
		}
		if (!clientID) {
			setError('Client ID is required')
			return
		}
		if (!clientSecret) {
			setError('Client Secret is required')
			return
		}
		if (!redirectURL) {
			setError('Redirect URL is required')
			return
		}

		// Validate name format (must be DNS-safe)
		if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
			setError('Name must be lowercase alphanumeric with hyphens (e.g., "google-workspace")')
			return
		}

		try {
			setCreating(true)

			const request: CreateIdentityProviderRequest = {
				name,
				displayName: displayName || undefined,
				issuerURL,
				clientID,
				clientSecret,
				redirectURL,
				hostedDomain: hostedDomain || undefined,
				scopes: scopes ? scopes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
				groupsClaim: groupsClaim || undefined,
				emailClaim: emailClaim || undefined,
			}

			await identityProvidersApi.create(request)
			toast.success(`Created identity provider "${displayName || name}"`, 'success')
			navigate('/admin/identity-providers')
		} catch (err: unknown) {
			// Extract user-friendly error message
			let message = 'Failed to create identity provider'
			if (err && typeof err === 'object' && 'message' in err) {
				message = (err as Error).message
			}
			// Add helpful hint for conflict errors
			if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 409) {
				message += ' You can delete it from the Identity Providers list page.'
			}
			setError(message)
		} finally {
			setCreating(false)
		}
	}

	// Step 1: Select preset
	if (!selectedPreset) {
		return (
			<FadeIn>
				<div className="max-w-2xl mx-auto space-y-6">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Add Identity Provider</h1>
						<p className="text-neutral-400 mt-1">
							Select the type of identity provider you want to configure
						</p>
					</div>

					<div className="grid gap-3">
						{PRESET_OPTIONS.map((preset) => (
							<button
								key={preset.key}
								onClick={() => handlePresetSelect(preset.key)}
								className="flex items-center gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-violet-500/50 hover:bg-neutral-800/50 transition-all text-left"
							>
								<div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center flex-shrink-0">
									{preset.icon}
								</div>
								<div>
									<p className="font-medium text-neutral-100">{preset.name}</p>
									<p className="text-sm text-neutral-500">{preset.description}</p>
								</div>
								<svg
									className="w-5 h-5 text-neutral-600 ml-auto"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</button>
						))}
					</div>

					<div className="flex justify-start">
						<Button variant="secondary" onClick={() => navigate('/admin/identity-providers')}>
							Cancel
						</Button>
					</div>
				</div>
			</FadeIn>
		)
	}

	// Step 2: Configure provider
	const presetConfig = selectedPreset !== 'custom' ? PRESET_OPTIONS.find(p => p.key === selectedPreset) : PRESET_OPTIONS.find(p => p.key === 'custom')

	return (
		<FadeIn>
			<div className="max-w-2xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<button
						onClick={() => setSelectedPreset(null)}
						className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
					>
						<svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center">
							{presetConfig?.icon}
						</div>
						<div>
							<h1 className="text-xl font-semibold text-neutral-50">Configure {presetConfig?.name}</h1>
							<p className="text-sm text-neutral-500">Enter your OIDC configuration details</p>
						</div>
					</div>
				</div>

				{/* Error */}
				{error && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				{/* Form */}
				<form onSubmit={handleSubmit}>
					<Card className="p-6 space-y-6">
						{/* Basic Info */}
						<div className="space-y-4">
							<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">Basic Information</h3>

							<div>
								<Input
									label="Name"
									value={name}
									onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
									placeholder="google-workspace"
									required
								/>
								<p className="mt-1 text-xs text-neutral-500">Unique identifier (lowercase, alphanumeric, hyphens only)</p>
							</div>

							<div>
								<Input
									label="Display Name"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									placeholder="Google Workspace"
								/>
								<p className="mt-1 text-xs text-neutral-500">Shown on the login button</p>
							</div>
						</div>

						{/* OIDC Configuration */}
						<div className="space-y-4">
							<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">OIDC Configuration</h3>

							<div className="space-y-2">
								<div>
									<Input
										label="Issuer URL"
										value={issuerURL}
										onChange={(e) => {
											setIssuerURL(e.target.value)
											setTestResult(null)
										}}
										placeholder="https://accounts.google.com"
										required
									/>
									<p className="mt-1 text-xs text-neutral-500">
										{selectedPreset === 'microsoft'
											? 'Replace {tenant} with your Azure tenant ID'
											: selectedPreset === 'okta'
												? 'Replace {domain} with your Okta domain'
												: 'The OIDC issuer URL (must support .well-known/openid-configuration)'}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={handleTestDiscovery}
										disabled={!issuerURL || testing}
									>
										{testing ? 'Testing...' : 'Test Discovery'}
									</Button>
									{testResult && (
										<span className={`text-sm ${testResult.valid ? 'text-green-400' : 'text-red-400'}`}>
											{testResult.valid ? '✓ Discovery successful' : '✗ Discovery failed'}
										</span>
									)}
								</div>
							</div>

							<div>
								<Input
									label="Client ID"
									value={clientID}
									onChange={(e) => setClientID(e.target.value)}
									placeholder="your-client-id"
									required
								/>
								<p className="mt-1 text-xs text-neutral-500">OAuth2 Client ID from your identity provider</p>
							</div>

							<div>
								<Input
									label="Client Secret"
									type="password"
									value={clientSecret}
									onChange={(e) => setClientSecret(e.target.value)}
									placeholder="••••••••••••••••"
									required
								/>
								<p className="mt-1 text-xs text-neutral-500">OAuth2 Client Secret (stored securely as a Kubernetes Secret)</p>
							</div>

							<div>
								<Input
									label="Redirect URL"
									value={redirectURL}
									onChange={(e) => setRedirectURL(e.target.value)}
									placeholder="https://butler.example.com/api/auth/callback"
									required
								/>
								<p className="mt-1 text-xs text-neutral-500">Must match the redirect URI in your identity provider settings</p>
							</div>

							{selectedPreset === 'google' && (
								<div>
									<Input
										label="Hosted Domain (Optional)"
										value={hostedDomain}
										onChange={(e) => setHostedDomain(e.target.value)}
										placeholder="example.com"
									/>
									<p className="mt-1 text-xs text-neutral-500">Restrict login to a specific Google Workspace domain</p>
								</div>
							)}
						</div>

						{/* Advanced Options */}
						<div>
							<button
								type="button"
								onClick={() => setShowAdvanced(!showAdvanced)}
								className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
							>
								<svg
									className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
								Advanced Options
							</button>

							{showAdvanced && (
								<div className="mt-4 space-y-4 pl-6 border-l border-neutral-800">
									<div>
										<Input
											label="Scopes"
											value={scopes}
											onChange={(e) => setScopes(e.target.value)}
											placeholder="openid, email, profile"
										/>
										<p className="mt-1 text-xs text-neutral-500">Comma-separated OAuth2 scopes to request</p>
									</div>

									<div>
										<Input
											label="Groups Claim"
											value={groupsClaim}
											onChange={(e) => setGroupsClaim(e.target.value)}
											placeholder="groups"
										/>
										<p className="mt-1 text-xs text-neutral-500">JWT claim containing group memberships (leave empty to disable)</p>
									</div>

									<div>
										<Input
											label="Email Claim"
											value={emailClaim}
											onChange={(e) => setEmailClaim(e.target.value)}
											placeholder="email"
										/>
										<p className="mt-1 text-xs text-neutral-500">JWT claim containing the user's email</p>
									</div>
								</div>
							)}
						</div>

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								variant="secondary"
								onClick={() => navigate('/admin/identity-providers')}
								disabled={creating}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={creating}>
								{creating ? 'Creating...' : 'Create Provider'}
							</Button>
						</div>
					</Card>
				</form>
			</div>
		</FadeIn>
	)
}
