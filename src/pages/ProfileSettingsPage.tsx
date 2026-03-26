// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react'
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

interface SSHKey {
	name: string
	fingerprint: string
	addedAt: string
	preview: string
}

export function ProfileSettingsPage() {
	useDocumentTitle('Profile Settings')
	const { user } = useAuth()
	const { success, error: showError } = useToast()

	const [form, setForm] = useState({
		name: user?.name || '',
		email: user?.email || '',
	})
	const [saving, setSaving] = useState(false)

	// SSH key state
	const [sshKeys, setSSHKeys] = useState<SSHKey[]>([])
	const [loadingKeys, setLoadingKeys] = useState(true)
	const [showAddKey, setShowAddKey] = useState(false)
	const [keyName, setKeyName] = useState('')
	const [keyPublic, setKeyPublic] = useState('')
	const [addingKey, setAddingKey] = useState(false)
	const [deletingFingerprint, setDeletingFingerprint] = useState<string | null>(null)

	const fetchSSHKeys = useCallback(async () => {
		try {
			const res = await fetch('/api/auth/ssh-keys', { credentials: 'include' })
			if (res.ok) {
				const data = await res.json()
				setSSHKeys(data.sshKeys || [])
			}
		} catch {
			// Silently fail on load — keys section will show empty
		} finally {
			setLoadingKeys(false)
		}
	}, [])

	useEffect(() => {
		fetchSSHKeys()
	}, [fetchSSHKeys])

	const handleAddKey = async () => {
		if (!keyName.trim() || !keyPublic.trim()) return
		setAddingKey(true)
		try {
			const res = await fetch('/api/auth/ssh-keys', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: keyName.trim(), publicKey: keyPublic.trim() }),
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({ error: 'Failed to add SSH key' }))
				showError('Error', data.error || 'Failed to add SSH key')
				return
			}
			success('SSH Key Added', `Key "${keyName.trim()}" has been added`)
			setKeyName('')
			setKeyPublic('')
			setShowAddKey(false)
			await fetchSSHKeys()
		} catch {
			showError('Error', 'Failed to add SSH key')
		} finally {
			setAddingKey(false)
		}
	}

	const handleDeleteKey = async (fingerprint: string, name: string) => {
		setDeletingFingerprint(fingerprint)
		try {
			const res = await fetch(`/api/auth/ssh-keys/${encodeURIComponent(fingerprint)}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({ error: 'Failed to remove SSH key' }))
				showError('Error', data.error || 'Failed to remove SSH key')
				return
			}
			success('SSH Key Removed', `Key "${name}" has been removed`)
			await fetchSSHKeys()
		} catch {
			showError('Error', 'Failed to remove SSH key')
		} finally {
			setDeletingFingerprint(null)
		}
	}

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

	const isAdmin = user?.isPlatformAdmin || false
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

					{/* SSH Keys */}
					<Card className="p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-medium text-neutral-50">
								<KeyIcon className="w-5 h-5 inline mr-2" />
								SSH Keys
							</h3>
							{!showAddKey && (
								<Button onClick={() => setShowAddKey(true)}>
									Add Key
								</Button>
							)}
						</div>

						{showAddKey && (
							<div className="mb-4 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700 space-y-3">
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Key Name
									</label>
									<input
										type="text"
										value={keyName}
										onChange={(e) => setKeyName(e.target.value)}
										placeholder="e.g. Work Laptop"
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Public Key
									</label>
									<textarea
										value={keyPublic}
										onChange={(e) => setKeyPublic(e.target.value)}
										placeholder="ssh-ed25519 AAAA... user@host"
										rows={3}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm resize-none"
									/>
									<p className="text-xs text-neutral-500 mt-1">
										Paste the contents of your public key file (e.g. ~/.ssh/id_ed25519.pub)
									</p>
								</div>
								<div className="flex justify-end gap-2">
									<button
										onClick={() => { setShowAddKey(false); setKeyName(''); setKeyPublic('') }}
										className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
									>
										Cancel
									</button>
									<Button
										onClick={handleAddKey}
										disabled={addingKey || !keyName.trim() || !keyPublic.trim()}
									>
										{addingKey ? 'Adding...' : 'Add SSH Key'}
									</Button>
								</div>
							</div>
						)}

						{loadingKeys ? (
							<p className="text-neutral-500 text-sm">Loading SSH keys...</p>
						) : sshKeys.length > 0 ? (
							<div className="space-y-2">
								{sshKeys.map((key) => (
									<div
										key={key.fingerprint}
										className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
									>
										<div className="min-w-0 flex-1">
											<p className="text-sm font-medium text-neutral-200">
												{key.name}
											</p>
											<p className="text-xs text-neutral-500 font-mono truncate">
												{key.fingerprint}
											</p>
											<p className="text-xs text-neutral-500">
												Added {new Date(key.addedAt).toLocaleDateString()}
											</p>
										</div>
										<button
											onClick={() => handleDeleteKey(key.fingerprint, key.name)}
											disabled={deletingFingerprint === key.fingerprint}
											className="ml-4 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded disabled:opacity-50"
										>
											{deletingFingerprint === key.fingerprint ? 'Removing...' : 'Remove'}
										</button>
									</div>
								))}
							</div>
						) : (
							<p className="text-neutral-500 text-sm">
								No SSH keys added. SSH keys are used for workspace access.
							</p>
						)}
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

function KeyIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
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
