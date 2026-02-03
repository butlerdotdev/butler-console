// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { identityProvidersApi, type IdentityProvider, type TestDiscoveryResponse } from '@/api/identity-providers'
import { Card, Button, StatusBadge, FadeIn, Spinner, Modal } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

// Provider icons
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

function getProviderIcon(issuerURL?: string) {
	if (!issuerURL) return <KeyIcon className="w-6 h-6 text-neutral-400" />

	const url = issuerURL.toLowerCase()
	if (url.includes('google')) return <GoogleIcon className="w-6 h-6" />
	if (url.includes('microsoft') || url.includes('login.microsoftonline')) return <MicrosoftIcon className="w-6 h-6" />
	if (url.includes('okta')) return <OktaIcon className="w-6 h-6" />

	return <KeyIcon className="w-6 h-6 text-blue-400" />
}

function getProviderType(issuerURL?: string): string {
	if (!issuerURL) return 'OIDC'

	const url = issuerURL.toLowerCase()
	if (url.includes('google')) return 'Google'
	if (url.includes('microsoft') || url.includes('login.microsoftonline')) return 'Microsoft'
	if (url.includes('okta')) return 'Okta'
	if (url.includes('auth0')) return 'Auth0'
	if (url.includes('keycloak')) return 'Keycloak'

	return 'OIDC'
}

function formatAge(timestamp?: string): string {
	if (!timestamp) return '-'

	const created = new Date(timestamp)
	const now = new Date()
	const diffMs = now.getTime() - created.getTime()
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

	if (diffDays === 0) return 'Today'
	if (diffDays === 1) return '1 day ago'
	if (diffDays < 30) return `${diffDays} days ago`
	if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
	return `${Math.floor(diffDays / 365)} years ago`
}

interface ProviderDetailModalProps {
	provider: IdentityProvider | null
	isOpen: boolean
	onClose: () => void
	onValidate: (name: string) => void
	validating: boolean
}

function ProviderDetailModal({ provider, isOpen, onClose, onValidate, validating }: ProviderDetailModalProps) {
	if (!provider) return null

	const issuerURL = provider.spec.oidc?.issuerURL || ''
	const displayName = provider.spec.displayName || provider.metadata.name
	const phase = provider.status?.phase || 'Active'

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<div className="space-y-4">
				{/* Header */}
				<div className="flex items-center gap-3">
					<div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center">
						{getProviderIcon(issuerURL)}
					</div>
					<div>
						<h3 className="text-lg font-medium text-neutral-100">{displayName}</h3>
						<p className="text-sm text-neutral-500">@{provider.metadata.name}</p>
					</div>
					<div className="ml-auto">
						<StatusBadge status={phase} />
					</div>
				</div>

				{/* Configuration */}
				<div className="bg-neutral-800/50 rounded-lg p-4 space-y-3">
					<h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">Configuration</h4>

					<div className="grid grid-cols-2 gap-3 text-sm">
						<div>
							<p className="text-neutral-500">Type</p>
							<p className="text-neutral-200">{getProviderType(issuerURL)}</p>
						</div>
						<div>
							<p className="text-neutral-500">Created</p>
							<p className="text-neutral-200">{formatAge(provider.metadata.creationTimestamp)}</p>
						</div>
					</div>

					<div>
						<p className="text-neutral-500 text-sm">Issuer URL</p>
						<p className="text-neutral-200 text-sm font-mono break-all">{issuerURL}</p>
					</div>

					<div>
						<p className="text-neutral-500 text-sm">Client ID</p>
						<p className="text-neutral-200 text-sm font-mono break-all">{provider.spec.oidc?.clientID || '-'}</p>
					</div>

					<div>
						<p className="text-neutral-500 text-sm">Redirect URL</p>
						<p className="text-neutral-200 text-sm font-mono break-all">{provider.spec.oidc?.redirectURL || '-'}</p>
					</div>

					{provider.spec.oidc?.hostedDomain && (
						<div>
							<p className="text-neutral-500 text-sm">Hosted Domain</p>
							<p className="text-neutral-200 text-sm">{provider.spec.oidc.hostedDomain}</p>
						</div>
					)}

					{provider.spec.oidc?.scopes && provider.spec.oidc.scopes.length > 0 && (
						<div>
							<p className="text-neutral-500 text-sm">Scopes</p>
							<div className="flex flex-wrap gap-1 mt-1">
								{provider.spec.oidc.scopes.map((scope) => (
									<span key={scope} className="px-2 py-0.5 bg-neutral-700 rounded text-xs text-neutral-300">
										{scope}
									</span>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Discovered Endpoints */}
				{provider.status?.discoveredEndpoints && (
					<div className="bg-neutral-800/50 rounded-lg p-4 space-y-3">
						<h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">Discovered Endpoints</h4>

						{provider.status.discoveredEndpoints.authorizationEndpoint && (
							<div>
								<p className="text-neutral-500 text-xs">Authorization</p>
								<p className="text-neutral-300 text-xs font-mono break-all">
									{provider.status.discoveredEndpoints.authorizationEndpoint}
								</p>
							</div>
						)}
						{provider.status.discoveredEndpoints.tokenEndpoint && (
							<div>
								<p className="text-neutral-500 text-xs">Token</p>
								<p className="text-neutral-300 text-xs font-mono break-all">
									{provider.status.discoveredEndpoints.tokenEndpoint}
								</p>
							</div>
						)}
					</div>
				)}

				{/* Status Message */}
				{provider.status?.message && (
					<div className={`p-3 rounded-lg ${phase === 'Failed' ? 'bg-red-500/10 border border-red-500/20' : 'bg-neutral-800/50'}`}>
						<p className={`text-sm ${phase === 'Failed' ? 'text-red-400' : 'text-neutral-400'}`}>
							{provider.status.message}
						</p>
					</div>
				)}

				{/* Actions */}
				<div className="flex justify-end gap-3 pt-2">
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
					<Button
						onClick={() => onValidate(provider.metadata.name)}
						disabled={validating}
					>
						{validating ? 'Validating...' : 'Test Connection'}
					</Button>
				</div>
			</div>
		</Modal>
	)
}

interface DeleteModalProps {
	provider: IdentityProvider | null
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	deleting: boolean
}

function DeleteModal({ provider, isOpen, onClose, onConfirm, deleting }: DeleteModalProps) {
	if (!provider) return null

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<div className="space-y-4">
				<p className="text-neutral-300">
					Are you sure you want to delete the identity provider{' '}
					<span className="font-semibold text-neutral-100">{provider.spec.displayName || provider.metadata.name}</span>?
				</p>
				<p className="text-sm text-neutral-500">
					This will remove the SSO configuration. Users authenticating via this provider will no longer be able to log in.
				</p>
				<div className="flex justify-end gap-3 pt-2">
					<Button variant="secondary" onClick={onClose} disabled={deleting}>
						Cancel
					</Button>
					<Button variant="danger" onClick={onConfirm} disabled={deleting}>
						{deleting ? 'Deleting...' : 'Delete Provider'}
					</Button>
				</div>
			</div>
		</Modal>
	)
}

export function IdentityProvidersPage() {
	useDocumentTitle('Identity Providers')
	const toast = useToast()

	const [providers, setProviders] = useState<IdentityProvider[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Modal state
	const [selectedProvider, setSelectedProvider] = useState<IdentityProvider | null>(null)
	const [detailModalOpen, setDetailModalOpen] = useState(false)
	const [deleteModalOpen, setDeleteModalOpen] = useState(false)
	const [validating, setValidating] = useState(false)
	const [deleting, setDeleting] = useState(false)

	// Fetch providers
	useEffect(() => {
		fetchProviders()
	}, [])

	async function fetchProviders() {
		try {
			setLoading(true)
			setError(null)
			const response = await identityProvidersApi.list()
			setProviders(response.identityProviders || [])
		} catch (err) {
			console.error('Failed to fetch identity providers:', err)
			setError(err instanceof Error ? err.message : 'Failed to load identity providers')
		} finally {
			setLoading(false)
		}
	}

	async function handleValidate(name: string) {
		try {
			setValidating(true)
			const result: TestDiscoveryResponse = await identityProvidersApi.validate(name)
			if (result.valid) {
				toast.success('OIDC discovery successful')
			} else {
				toast.error(result.message || 'Validation failed')
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Validation failed')
		} finally {
			setValidating(false)
		}
	}

	async function handleDelete() {
		if (!selectedProvider) return

		try {
			setDeleting(true)
			const result = await identityProvidersApi.delete(selectedProvider.metadata.name)
			const providerLabel = selectedProvider.spec?.displayName || selectedProvider.metadata.name

			// Handle orphan cleanup vs normal delete
			if (result?.status === 'cleaned') {
				toast.success(result.message || `Cleaned up orphaned resources for ${providerLabel}`)
			} else {
				toast.success(`Deleted ${providerLabel}`)
			}

			setDeleteModalOpen(false)
			setSelectedProvider(null)
			fetchProviders()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to delete provider'
			toast.error(message)
		} finally {
			setDeleting(false)
		}
	}

	function openDetail(provider: IdentityProvider) {
		setSelectedProvider(provider)
		setDetailModalOpen(true)
	}

	function openDelete(provider: IdentityProvider) {
		setSelectedProvider(provider)
		setDeleteModalOpen(true)
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
						<h1 className="text-2xl font-semibold text-neutral-50">Identity Providers</h1>
						<p className="text-neutral-400 mt-1">
							Configure SSO authentication providers for Butler Console
						</p>
					</div>
					<Link to="/admin/identity-providers/create">
						<Button>
							<svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Add Provider
						</Button>
					</Link>
				</div>

				{/* Error State */}
				{error && (
					<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-red-400">{error}</p>
						<Button variant="secondary" size="sm" className="mt-2" onClick={fetchProviders}>
							Retry
						</Button>
					</div>
				)}

				{/* Empty State */}
				{!error && providers.length === 0 && (
					<Card className="p-8 text-center">
						<div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
							<KeyIcon className="w-8 h-8 text-neutral-500" />
						</div>
						<h3 className="text-lg font-medium text-neutral-200 mb-2">No Identity Providers</h3>
						<p className="text-neutral-500 mb-4 max-w-md mx-auto">
							Add an OIDC identity provider to enable SSO authentication for your users.
							Butler supports Google Workspace, Microsoft Entra ID, Okta, and other OIDC providers.
						</p>
						<Link to="/admin/identity-providers/create">
							<Button>Add Your First Provider</Button>
						</Link>
					</Card>
				)}

				{/* Provider List */}
				{providers.length > 0 && (
					<div className="grid gap-4">
						{providers.map((provider) => {
							const issuerURL = provider.spec.oidc?.issuerURL || ''
							const displayName = provider.spec.displayName || provider.metadata.name
							const phase = provider.status?.phase || 'Active'
							const providerType = getProviderType(issuerURL)

							return (
								<Card key={provider.metadata.name} className="p-4">
									<div className="flex items-center gap-4">
										{/* Icon */}
										<div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center flex-shrink-0">
											{getProviderIcon(issuerURL)}
										</div>

										{/* Info */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<h3 className="text-lg font-medium text-neutral-100 truncate">{displayName}</h3>
												<span className="px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-400">
													{providerType}
												</span>
											</div>
											<p className="text-sm text-neutral-500 truncate">{issuerURL}</p>
										</div>

										{/* Status */}
										<div className="flex-shrink-0">
											<StatusBadge status={phase} />
										</div>

										{/* Age */}
										<div className="flex-shrink-0 text-sm text-neutral-500 w-24 text-right">
											{formatAge(provider.metadata.creationTimestamp)}
										</div>

										{/* Actions */}
										<div className="flex items-center gap-2 flex-shrink-0">
											<Button variant="secondary" size="sm" onClick={() => openDetail(provider)}>
												View
											</Button>
											<Button variant="danger" size="sm" onClick={() => openDelete(provider)}>
												Delete
											</Button>
										</div>
									</div>
								</Card>
							)
						})}
					</div>
				)}
			</div>

			{/* Modals */}
			<ProviderDetailModal
				provider={selectedProvider}
				isOpen={detailModalOpen}
				onClose={() => setDetailModalOpen(false)}
				onValidate={handleValidate}
				validating={validating}
			/>

			<DeleteModal
				provider={selectedProvider}
				isOpen={deleteModalOpen}
				onClose={() => setDeleteModalOpen(false)}
				onConfirm={handleDelete}
				deleting={deleting}
			/>
		</FadeIn>
	)
}
