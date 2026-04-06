// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui'

interface ScaleWorkersModalProps {
	isOpen: boolean
	onClose: () => void
	onScale: (replicas: number) => Promise<void>
	clusterName: string
	currentReplicas: number
}

export function ScaleWorkersModal({
	isOpen,
	onClose,
	onScale,
	clusterName,
	currentReplicas,
}: ScaleWorkersModalProps) {
	const [replicas, setReplicas] = useState(currentReplicas)
	const [isScaling, setIsScaling] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [lastOpen, setLastOpen] = useState(false)

	if (isOpen && !lastOpen) {
		setReplicas(currentReplicas)
		setError(null)
		setIsScaling(false)
	}
	if (isOpen !== lastOpen) {
		setLastOpen(isOpen)
	}

	const isValid = replicas >= 1 && replicas <= 100 && replicas !== currentReplicas

	const handleClose = () => {
		if (isScaling) return
		setReplicas(currentReplicas)
		setError(null)
		onClose()
	}

	const handleScale = async () => {
		if (!isValid) return
		setIsScaling(true)
		setError(null)

		try {
			await onScale(replicas)
			handleClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to scale cluster')
			setIsScaling(false)
		}
	}

	const diff = replicas - currentReplicas

	return (
		<Modal isOpen={isOpen} onClose={handleClose} className="w-full max-w-md">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Scale Workers</h2>
						<p className="text-sm text-neutral-400">{clusterName}</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody className="space-y-4">
				<div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
					<div className="flex items-center justify-between text-sm">
						<span className="text-neutral-400">Current workers</span>
						<span className="font-mono text-neutral-200">{currentReplicas}</span>
					</div>
					{isValid && (
						<div className="flex items-center justify-between text-sm mt-2">
							<span className="text-neutral-400">Change</span>
							<span className={`font-mono ${diff > 0 ? 'text-green-400' : 'text-amber-400'}`}>
								{diff > 0 ? `+${diff}` : diff}
							</span>
						</div>
					)}
				</div>

				<div>
					<label className="block text-sm font-medium text-neutral-300 mb-2">
						New worker count
					</label>
					<input
						type="number"
						min={1}
						max={100}
						value={replicas}
						onChange={(e) => setReplicas(parseInt(e.target.value, 10) || 1)}
						onKeyDown={(e) => e.key === 'Enter' && isValid && !isScaling && handleScale()}
						disabled={isScaling}
						autoFocus
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
					/>
					<p className="text-xs text-neutral-500 mt-1">Must be between 1 and 100</p>
				</div>

				{error && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={handleClose} disabled={isScaling}>
					Cancel
				</Button>
				<Button onClick={handleScale} disabled={!isValid || isScaling}>
					{isScaling ? 'Scaling...' : 'Scale Workers'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}
