// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { useDocumentTitle } from '@/hooks'
import { useAuth } from '@/hooks/useAuth'
import { Card, Button, FadeIn } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

interface TeamRef {
	name?: string
	metadata?: { name?: string }
	spec?: { displayName?: string }
	displayName?: string
	role?: string
}

export function ProfileSettingsPage() {
	useDocumentTitle('Profile Settings')
	const { user } = useAuth()
	const { success } = useToast()

	const [form, setForm] = useState({
		name: user?.name || '',
		email: user?.email || '',
	})
	const [saving, setSaving] = useState(false)

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
	}

	const handleSave = async () => {
		setSaving(true)
		// TODO: Implement profile update API
		await new Promise((resolve) => setTimeout(resolve, 500))
		success('Profile Updated', 'Your profile has been saved')
		setSaving(false)
	}

	const isAdmin = user?.role === 'admin' || user?.isAdmin
	const teams = user?.teams || []

	return (
		<FadeIn>
			<div className="max-w-2xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-neutral-50">Profile</h1>
					<p className="text-neutral-400 mt-1">
						Manage your account information
					</p>
				</div>

				<div className="space-y-6">
					{/* Avatar & Basic Info */}
					<Card className="p-6">
						<div className="flex items-start gap-6">
							<div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-semibold">
								{user?.name
									? user.name
										.split(' ')
										.map((n) => n[0])
										.join('')
										.toUpperCase()
										.slice(0, 2)
									: user?.email?.[0]?.toUpperCase() || 'U'}
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-medium text-neutral-50">
									{user?.name || 'User'}
								</h3>
								<p className="text-neutral-400 text-sm">{user?.email}</p>
								<div className="flex items-center gap-2 mt-2">
									{isAdmin && (
										<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-full">
											<ShieldIcon className="w-3 h-3" />
											Platform Admin
										</span>
									)}
								</div>
							</div>
						</div>
					</Card>

					{/* Edit Profile */}
					<Card className="p-6">
						<h3 className="text-lg font-medium text-neutral-50 mb-4">
							Account Information
						</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">
									<UserIcon className="w-4 h-4 inline mr-2" />
									Display Name
								</label>
								<input
									type="text"
									name="name"
									value={form.name}
									onChange={handleChange}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">
									<MailIcon className="w-4 h-4 inline mr-2" />
									Email Address
								</label>
								<input
									type="email"
									name="email"
									value={form.email}
									disabled
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 cursor-not-allowed"
								/>
								<p className="text-xs text-neutral-500 mt-1">
									Email is managed by your identity provider
								</p>
							</div>
						</div>
						<div className="mt-6 flex justify-end">
							<Button onClick={handleSave} disabled={saving}>
								{saving ? 'Saving...' : 'Save Changes'}
							</Button>
						</div>
					</Card>

					{/* Team Memberships */}
					<Card className="p-6">
						<h3 className="text-lg font-medium text-neutral-50 mb-4">
							<BuildingIcon className="w-5 h-5 inline mr-2" />
							Team Memberships
						</h3>
						{teams.length > 0 ? (
							<div className="space-y-2">
								{teams.map((team: TeamRef) => {
									const name = team.name || team.metadata?.name || 'unknown'
									const displayName = team.displayName || team.spec?.displayName || name
									const role = team.role || 'member'
									return (
										<div
											key={name}
											className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
										>
											<div>
												<p className="text-sm font-medium text-neutral-200">
													{displayName}
												</p>
												<p className="text-xs text-neutral-500">@{name}</p>
											</div>
											<span
												className={`px-2 py-0.5 text-xs font-medium rounded-full ${role === 'admin'
													? 'bg-violet-500/20 text-violet-400'
													: role === 'operator'
														? 'bg-blue-500/20 text-blue-400'
														: 'bg-neutral-700 text-neutral-400'
													}`}
											>
												{role}
											</span>
										</div>
									)
								})}
							</div>
						) : (
							<p className="text-neutral-500 text-sm">
								You are not a member of any teams yet.
							</p>
						)}
					</Card>

					{/* Auth Info */}
					<Card className="p-6">
						<h3 className="text-lg font-medium text-neutral-50 mb-4">
							Authentication
						</h3>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between">
								<span className="text-neutral-400">Identity Provider</span>
								<span className="text-neutral-200">
									{user?.provider || 'Dex (OIDC)'}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-neutral-400">Last Login</span>
								<span className="text-neutral-200">Just now</span>
							</div>
						</div>
					</Card>
				</div>
			</div>
		</FadeIn>
	)
}

// Icons
function UserIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
			/>
		</svg>
	)
}

function MailIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
			/>
		</svg>
	)
}

function BuildingIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
			/>
		</svg>
	)
}

function ShieldIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
			/>
		</svg>
	)
}
