// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui'

interface DeleteClusterModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => Promise<void>
	clusterName: string
	clusterNamespace: string
	workerCount: number
}

export function DeleteClusterModal({
	isOpen,
	onClose,
	onConfirm,
	clusterName,
	clusterNamespace,
	workerCount,
}: DeleteClusterModalProps) {
	const [confirmText, setConfirmText] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const isConfirmed = confirmText === clusterName

	const handleClose = () => {
		setConfirmText('')
		setError(null)
		setIsDeleting(false)
		onClose()
	}

	const handleConfirm = async () => {
		if (!isConfirmed) return
		setIsDeleting(true)
		setError(null)

		try {
			await onConfirm()
			handleClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete cluster')
			setIsDeleting(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={isDeleting ? () => { } : handleClose} className="w-full max-w-md">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Delete Cluster</h2>
						<p className="text-sm text-neutral-400">This action cannot be undone</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody className="space-y-4">
				<div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
					<p className="text-sm text-neutral-300">
						You are about to delete cluster{' '}
						<span className="font-mono font-semibold text-red-400">{clusterName}</span> from
						namespace <span className="font-mono text-neutral-400">{clusterNamespace}</span>.
					</p>
					<ul className="mt-3 space-y-1 text-sm text-neutral-400">
						<li className="flex items-center gap-2">
							<span className="w-1.5 h-1.5 rounded-full bg-red-500" />
							{workerCount} worker node{workerCount !== 1 ? 's' : ''} will be terminated
						</li>
						<li className="flex items-center gap-2">
							<span className="w-1.5 h-1.5 rounded-full bg-red-500" />
							All workloads will be destroyed
						</li>
						<li className="flex items-center gap-2">
							<span className="w-1.5 h-1.5 rounded-full bg-red-500" />
							Persistent volumes will be deleted
						</li>
					</ul>
				</div>

				<div>
					<label className="block text-sm font-medium text-neutral-400 mb-2">
						Type <span className="font-mono text-neutral-200">{clusterName}</span> to confirm
					</label>
					<input
						type="text"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && isConfirmed && !isDeleting && handleConfirm()}
						placeholder={clusterName}
						disabled={isDeleting}
						autoFocus
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
					/>
				</div>

				{error && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={handleClose} disabled={isDeleting}>
					Cancel
				</Button>
				<Button variant="danger" onClick={handleConfirm} disabled={!isConfirmed || isDeleting}>
					{isDeleting ? 'Deleting...' : 'Delete Cluster'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}
