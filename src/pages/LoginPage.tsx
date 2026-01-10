// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts'
import { Button, Input, Card } from '@/components/ui'
import { useDocumentTitle } from '@/hooks'

export function LoginPage() {
	useDocumentTitle('Login')

	const { login, isAuthenticated } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()

	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'

	if (isAuthenticated) {
		navigate(from, { replace: true })
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			await login({ username, password })
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
				<div className="text-center mb-6">
					<div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center mx-auto mb-3">
						<span className="text-white font-bold text-xl">B</span>
					</div>
					<h1 className="text-xl font-semibold text-neutral-100">Butler Console</h1>
					<p className="text-sm text-neutral-400 mt-1">Sign in to your account</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
							<p className="text-sm text-red-400">{error}</p>
						</div>
					)}

					<Input
						id="username"
						label="Username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="admin"
						required
					/>

					<Input
						id="password"
						label="Password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="••••••••"
						required
					/>

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign in'}
					</Button>
				</form>
			</Card>
		</div>
	)
}
