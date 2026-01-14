// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Card } from '@/components/ui'
import { useDocumentTitle } from '@/hooks'

interface InviteValidation {
	valid: boolean
	email: string
	displayName: string
	message?: string
}

export function SetPasswordPage() {
	useDocumentTitle('Set Password')

	const { token } = useParams<{ token: string }>()
	const navigate = useNavigate()

	const [loading, setLoading] = useState(true)
	const [inviteData, setInviteData] = useState<InviteValidation | null>(null)
	const [error, setError] = useState('')

	// Form state
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [submitting, setSubmitting] = useState(false)

	// Password requirements
	const requirements = [
		{ label: 'At least 12 characters', met: password.length >= 12 },
		{ label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
		{ label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
		{ label: 'At least one number', met: /[0-9]/.test(password) },
	]

	const allRequirementsMet = requirements.every((r) => r.met)
	const passwordsMatch = password === confirmPassword && password.length > 0

	// Validate invite token on mount
	useEffect(() => {
		if (!token) {
			setError('Invalid invite link')
			setLoading(false)
			return
		}

		const validateToken = async () => {
			try {
				const response = await fetch(`/api/auth/invite/${token}`)
				const data = await response.json()

				if (!response.ok) {
					setError(data.error || 'Invalid or expired invite link')
					setInviteData(null)
				} else {
					setInviteData(data)
				}
			} catch {
				setError('Failed to validate invite. Please try again.')
			} finally {
				setLoading(false)
			}
		}

		validateToken()
	}, [token])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!allRequirementsMet) {
			setError('Password does not meet requirements')
			return
		}

		if (!passwordsMatch) {
			setError('Passwords do not match')
			return
		}

		setError('')
		setSubmitting(true)

		try {
			const response = await fetch('/api/auth/set-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					token,
					password,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				setError(data.error || 'Failed to set password')
				return
			}

			// Password set successfully - redirect to dashboard
			navigate('/dashboard', { replace: true })
		} catch {
			setError('An error occurred. Please try again.')
		} finally {
			setSubmitting(false)
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
				<Card className="w-full max-w-sm p-6">
					<div className="text-center">
						<div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center mx-auto mb-3">
							<span className="text-white font-bold text-xl">B</span>
						</div>
						<p className="text-neutral-400">Validating invite...</p>
					</div>
				</Card>
			</div>
		)
	}

	// Invalid or expired token
	if (!inviteData?.valid) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
				<Card className="w-full max-w-sm p-6">
					<div className="text-center">
						<div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center mx-auto mb-3">
							<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</div>
						<h1 className="text-xl font-semibold text-neutral-100 mb-2">Invalid Invite</h1>
						<p className="text-sm text-neutral-400 mb-4">{error || 'This invite link is invalid or has expired.'}</p>
						<Button onClick={() => navigate('/login')} variant="secondary">
							Go to Login
						</Button>
					</div>
				</Card>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
			<Card className="w-full max-w-sm p-6">
				{/* Logo and Title */}
				<div className="text-center mb-6">
					<div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center mx-auto mb-3">
						<span className="text-white font-bold text-xl">B</span>
					</div>
					<h1 className="text-xl font-semibold text-neutral-100">Set Your Password</h1>
					<p className="text-sm text-neutral-400 mt-1">
						Welcome, {inviteData.displayName || inviteData.email}
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				{/* Password Form */}
				<form onSubmit={handleSubmit} className="space-y-4">
					<Input
						id="password"
						label="Password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Enter your password"
						required
						autoComplete="new-password"
					/>

					{/* Password Requirements */}
					<div className="space-y-1">
						{requirements.map((req, idx) => (
							<div key={idx} className="flex items-center gap-2 text-xs">
								{req.met ? (
									<svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
								) : (
									<svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
									</svg>
								)}
								<span className={req.met ? 'text-green-500' : 'text-neutral-500'}>{req.label}</span>
							</div>
						))}
					</div>

					<Input
						id="confirmPassword"
						label="Confirm Password"
						type="password"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						placeholder="Confirm your password"
						required
						autoComplete="new-password"
					/>

					{/* Match indicator */}
					{confirmPassword && (
						<div className="flex items-center gap-2 text-xs">
							{passwordsMatch ? (
								<>
									<svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
									<span className="text-green-500">Passwords match</span>
								</>
							) : (
								<>
									<svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
									<span className="text-red-500">Passwords do not match</span>
								</>
							)}
						</div>
					)}

					<Button
						type="submit"
						className="w-full"
						disabled={submitting || !allRequirementsMet || !passwordsMatch}
					>
						{submitting ? 'Setting password...' : 'Set Password & Sign In'}
					</Button>
				</form>

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
