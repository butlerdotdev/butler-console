// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Card } from '@/components/ui'
import { useDocumentTitle } from '@/hooks'

// Provider icons as inline SVGs
const GoogleIcon = () => (
	<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
		<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
		<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
		<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
		<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
	</svg>
)

const MicrosoftIcon = () => (
	<svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
		<rect x="1" y="1" width="9" height="9" fill="#f25022" />
		<rect x="11" y="1" width="9" height="9" fill="#7fba00" />
		<rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
		<rect x="11" y="11" width="9" height="9" fill="#ffb900" />
	</svg>
)

const OktaIcon = () => (
	<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 0C5.389 0 0 5.389 0 12s5.389 12 12 12 12-5.389 12-12S18.611 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" fill="#007DC1" />
	</svg>
)

const SSOIcon = () => (
	<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
		<polyline points="10 17 15 12 10 7" />
		<line x1="15" y1="12" x2="3" y2="12" />
	</svg>
)

const EmailIcon = () => (
	<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
		<polyline points="22,6 12,13 2,6" />
	</svg>
)

function getProviderIcon(name: string) {
	const lowerName = name.toLowerCase()
	if (lowerName.includes('google')) return <GoogleIcon />
	if (lowerName.includes('microsoft') || lowerName.includes('azure') || lowerName.includes('entra')) return <MicrosoftIcon />
	if (lowerName.includes('okta')) return <OktaIcon />
	return <SSOIcon />
}

type LoginMode = 'select' | 'email' | 'sso'

export function LoginPage() {
	useDocumentTitle('Login')

	const { login, legacyLogin, isAuthenticated, providers } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()

	// Login mode state
	const [mode, setMode] = useState<LoginMode>('select')

	// Form state
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'

	// Check for OAuth error in URL
	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const oauthError = params.get('error')
		if (oauthError) {
			setError(getErrorMessage(oauthError))
			window.history.replaceState({}, '', window.location.pathname)
		}
	}, [])

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate(from, { replace: true })
		}
	}, [isAuthenticated, from, navigate])

	// Handle SSO login
	const handleSSOLogin = (loginUrl: string) => {
		setLoading(true)
		login(loginUrl)
	}

	// Handle email/password login
	const handleEmailSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			await legacyLogin(email, password)
			navigate(from, { replace: true })
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
			<Card className="w-full max-w-sm p-6">
				{/* Logo and Title */}
				<div className="text-center mb-6">
					<img
						src="/butlerlabs.png"
						alt="Butler Labs"
						className="w-14 h-14 rounded-xl mx-auto mb-3"
					/>
					<h1 className="text-xl font-semibold text-neutral-100">Butler Console</h1>
					<p className="text-sm text-neutral-400 mt-1">
						Sign in with your identity provider
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				{/* Selection Mode - Show all login options */}
				{mode === 'select' && (
					<div className="space-y-3">
						{/* Email & Password option - always show */}
						<button
							onClick={() => setMode('email')}
							className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-200 font-medium transition-colors"
						>
							<EmailIcon />
							<span>Sign in with Email & Password</span>
						</button>

						{/* SSO Providers */}
						{providers.map((provider) => (
							<button
								key={provider.name}
								onClick={() => handleSSOLogin(provider.loginUrl)}
								disabled={loading}
								className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{getProviderIcon(provider.name)}
								<span>{provider.buttonLabel || `Sign in with ${provider.name}`}</span>
							</button>
						))}
					</div>
				)}

				{/* Email/Password Form */}
				{mode === 'email' && (
					<form onSubmit={handleEmailSubmit} className="space-y-4">
						<Input
							id="email"
							label="Email"
							type="text"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@company.com"
							required
							autoComplete="username"
						/>

						<Input
							id="password"
							label="Password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							required
							autoComplete="current-password"
						/>

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? 'Signing in...' : 'Sign in'}
						</Button>

						<button
							type="button"
							onClick={() => {
								setMode('select')
								setError('')
							}}
							className="w-full text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
						>
							← Back to login options
						</button>
					</form>
				)}

				{/* Footer */}
				<div className="mt-6 text-center">
					<p className="text-xs text-neutral-600">
						Butler Platform © {new Date().getFullYear()} Butler Labs
					</p>
				</div>
			</Card>
		</div>
	)
}

// Map OAuth errors to user-friendly messages
function getErrorMessage(error: string): string {
	switch (error) {
		case 'access_denied':
			return 'Access was denied. Please try again or contact your administrator.'
		case 'token_exchange_failed':
			return 'Authentication failed. Please try again.'
		case 'session_creation_failed':
			return 'Failed to create session. Please try again.'
		case 'invalid_state':
			return 'Invalid request. Please try again.'
		default:
			return `Authentication error: ${error}`
	}
}
