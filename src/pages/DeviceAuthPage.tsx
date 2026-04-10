// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, Button, Input } from '@/components/ui'
import { useDocumentTitle } from '@/hooks'

interface DeviceInfo {
	deviceCode: string
	expiresIn: number
}

export function DeviceAuthPage() {
	useDocumentTitle('Authorize CLI')

	const { isAuthenticated } = useAuth()
	const [userCode, setUserCode] = useState('')
	const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const [loading, setLoading] = useState(false)

	const handleVerify = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			const res = await fetch('/api/auth/cli/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_code: userCode.toUpperCase().trim() }),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => null)
				setError(data?.message || 'Invalid or expired code. Check the code and try again.')
				setLoading(false)
				return
			}

			const data = await res.json()
			setDeviceInfo({ deviceCode: data.device_code, expiresIn: data.expires_in })

			// Try to approve directly. The approve endpoint requires a session
			// cookie. If the user is logged in to the console, this succeeds.
			// If not, we get a 401 and ask them to log in first.
			await handleApprove(data.device_code)
		} catch {
			setError('Failed to verify code. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	const handleApprove = async (code: string) => {
		setLoading(true)
		setError('')

		try {
			const res = await fetch('/api/auth/cli/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ device_code: code }),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => null)
				setError(data?.message || 'Failed to authorize device.')
				setLoading(false)
				return
			}

			setSuccess(true)
			// Clean up stored device code
			sessionStorage.removeItem('butler_device_code')
			sessionStorage.removeItem('butler_user_code')
		} catch {
			setError('Failed to authorize device. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	// If returning from login with a stored device code, auto-approve
	const storedCode = sessionStorage.getItem('butler_device_code')
	if (isAuthenticated && storedCode && !success && !deviceInfo) {
		handleApprove(storedCode)
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
			<Card className="w-full max-w-sm p-6">
				<div className="text-center mb-6">
					<img
						src="/butlerlabs.png"
						alt="Butler Labs"
						className="w-14 h-14 rounded-xl mx-auto mb-3"
					/>
					<h1 className="text-xl font-semibold text-neutral-50">Authorize CLI</h1>
					<p className="text-sm text-neutral-400 mt-1">
						Enter the code shown in your terminal
					</p>
				</div>

				{error && (
					<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				{success ? (
					<div className="text-center">
						<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
							<svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<h2 className="text-lg font-semibold text-neutral-50 mb-2">Device Authorized</h2>
						<p className="text-sm text-neutral-400">
							You can close this window and return to your terminal.
						</p>
					</div>
				) : (
					<form onSubmit={handleVerify} className="space-y-4">
						<Input
							id="code"
							label="Device Code"
							type="text"
							value={userCode}
							onChange={(e) => setUserCode(e.target.value.toUpperCase())}
							placeholder="XXXX-XXXX"
							required
							autoComplete="off"
							autoFocus
							className="text-center text-lg tracking-widest font-mono"
						/>

						<Button type="submit" className="w-full" disabled={loading || userCode.length < 9}>
							{loading ? 'Verifying...' : 'Authorize'}
						</Button>
					</form>
				)}

				<div className="mt-6 text-center">
					<p className="text-xs text-neutral-600">
						This page authorizes a Butler CLI session on your account.
					</p>
				</div>
			</Card>
		</div>
	)
}
