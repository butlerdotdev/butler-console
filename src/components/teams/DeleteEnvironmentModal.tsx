// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui'
import { environmentsApi } from '@/api/environments'
import { extractWebhookDenial } from '@/lib/webhookError'
import { useToast } from '@/hooks/useToast'

interface Props {
	isOpen: boolean
	team: string
	envName: string
	clusterCount: number
	onClose: () => void
	onDeleted: () => void
}

export function DeleteEnvironmentModal({
	isOpen,
	team,
	envName,
	clusterCount,
	onClose,
	onDeleted,
}: Props) {
	const { success, error: showError } = useToast()
	const [confirmText, setConfirmText] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		if (!isOpen) return
		setConfirmText('')
		setError(null)
		setDeleting(false)
	}, [isOpen])

	const isConfirmed = confirmText === envName

	const handleConfirm = async () => {
		if (!isConfirmed) return
		setDeleting(true)
		setError(null)
		try {
			await environmentsApi.delete(team, envName)
			success('Environment deleted', `${envName} has been removed`)
			onDeleted()
		} catch (err) {
			const denial = extractWebhookDenial(err)
			if (denial) {
				setError(denial.message)
			} else {
				const msg = err instanceof Error ? err.message : 'Failed to delete environment'
				setError(msg)
				showError('Delete failed', msg)
			}
		} finally {
			setDeleting(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={deleting ? () => {} : onClose} size="md">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Delete Environment</h2>
						<p className="text-sm text-neutral-400">This action cannot be undone</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody className="space-y-4">
				<div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
					<p className="text-sm text-neutral-300">
						You are about to delete environment{' '}
						<span className="font-mono font-semibold text-red-400">{envName}</span> from
						team <span className="font-mono text-neutral-400">{team}</span>.
					</p>
					{clusterCount > 0 ? (
						<p className="mt-3 text-sm text-amber-300">
							{clusterCount} cluster{clusterCount === 1 ? '' : 's'} currently carry this env
							label. They will remain but will be orphaned against env accounting; they
							continue to count against the team total.
						</p>
					) : (
						<p className="mt-3 text-sm text-neutral-400">No clusters currently use this env.</p>
					)}
				</div>

				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-2">
						Type <span className="font-mono text-neutral-200">{envName}</span> to confirm
					</label>
					<input
						type="text"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						onKeyDown={(e) =>
							e.key === 'Enter' && isConfirmed && !deleting && handleConfirm()
						}
						placeholder={envName}
						disabled={deleting}
						autoFocus
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
					/>
				</div>

				{error && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose} disabled={deleting}>
					Cancel
				</Button>
				<Button variant="danger" onClick={handleConfirm} disabled={!isConfirmed || deleting}>
					{deleting ? 'Deleting...' : 'Delete environment'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}
