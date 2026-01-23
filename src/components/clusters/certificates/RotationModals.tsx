/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { RotationType } from '@/types/certificates';

interface RotationModalProps {
	isOpen: boolean;
	onClose: () => void;
	clusterName: string;
	rotationType: RotationType;
	affectedSecrets: string[];
	onConfirm: () => void;
	loading: boolean;
}

export function RotationModal({
	isOpen,
	onClose,
	clusterName,
	rotationType,
	affectedSecrets,
	onConfirm,
	loading,
}: RotationModalProps) {
	const getTitle = () => {
		switch (rotationType) {
			case 'kubeconfigs':
				return 'Rotate Kubeconfig Certificates';
			case 'all':
				return 'Rotate All Certificates';
			default:
				return 'Rotate Certificates';
		}
	};

	const getDescription = () => {
		switch (rotationType) {
			case 'kubeconfigs':
				return 'This will regenerate all kubeconfig certificates. Existing kubeconfig files will become invalid and need to be re-downloaded.';
			case 'all':
				return 'This will regenerate all cluster certificates except the Certificate Authority. The cluster will remain operational during rotation.';
			default:
				return 'This will regenerate the selected certificates.';
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="md">
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">{getTitle()}</h2>
			</ModalHeader>

			<ModalBody>
				<div className="space-y-4">
					<p className="text-neutral-300">{getDescription()}</p>

					<div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
						<div className="flex gap-3">
							<span className="text-amber-400 text-xl">⚠️</span>
							<div>
								<p className="text-amber-200 font-medium">Impact Warning</p>
								<p className="text-amber-300/80 text-sm mt-1">
									Users with downloaded kubeconfigs will need to re-download them after rotation completes.
								</p>
							</div>
						</div>
					</div>

					{affectedSecrets.length > 0 && (
						<div>
							<p className="text-sm text-neutral-400 mb-2">
								The following {affectedSecrets.length} secret(s) will be rotated:
							</p>
							<div className="bg-neutral-900 rounded-lg p-3 max-h-32 overflow-y-auto">
								<ul className="text-xs font-mono text-neutral-400 space-y-1">
									{affectedSecrets.map((secret) => (
										<li key={secret}>{secret}</li>
									))}
								</ul>
							</div>
						</div>
					)}

					<p className="text-sm text-neutral-500">
						Cluster: <span className="text-neutral-300 font-medium">{clusterName}</span>
					</p>
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose} disabled={loading}>
					Cancel
				</Button>
				<Button variant="primary" onClick={onConfirm} disabled={loading}>
					{loading ? 'Rotating...' : 'Rotate Certificates'}
				</Button>
			</ModalFooter>
		</Modal>
	);
}

interface CARotationModalProps {
	isOpen: boolean;
	onClose: () => void;
	clusterName: string;
	onConfirm: () => void;
	loading: boolean;
}

export function CARotationModal({
	isOpen,
	onClose,
	clusterName,
	onConfirm,
	loading,
}: CARotationModalProps) {
	const [confirmText, setConfirmText] = useState('');
	const [understandsImpact, setUnderstandsImpact] = useState(false);

	const canConfirm = confirmText === clusterName && understandsImpact;

	const handleClose = () => {
		setConfirmText('');
		setUnderstandsImpact(false);
		onClose();
	};

	const handleConfirm = () => {
		if (canConfirm) {
			onConfirm();
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} size="lg">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<span className="text-2xl">🔐</span>
					<h2 className="text-lg font-semibold text-neutral-100">Rotate Certificate Authority</h2>
				</div>
			</ModalHeader>

			<ModalBody>
				<div className="space-y-4">
					{/* Critical warning banner */}
					<div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
						<div className="flex gap-3">
							<span className="text-red-400 text-xl">🚨</span>
							<div>
								<p className="text-red-200 font-bold">CRITICAL OPERATION</p>
								<p className="text-red-300/90 text-sm mt-1">
									This will rotate the root Certificate Authority and ALL dependent certificates.
									This is a disruptive operation that will temporarily break cluster connectivity.
								</p>
							</div>
						</div>
					</div>

					{/* What happens section */}
					<div className="bg-neutral-800/50 rounded-lg p-4">
						<p className="text-neutral-200 font-medium mb-3">What will happen:</p>
						<ol className="text-sm text-neutral-300 space-y-2 list-decimal list-inside">
							<li>The CA certificate and all leaf certificates will be deleted</li>
							<li>Steward will regenerate new CA and all certificates signed by it</li>
							<li>The control plane API server will restart with new certificates</li>
							<li>
								<span className="text-amber-300 font-medium">Worker nodes will go NotReady</span> until they receive the new CA trust bundle
							</li>
						</ol>
					</div>

					{/* Worker node recovery section */}
					<div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
						<p className="text-amber-200 font-medium mb-2">⚠️ Worker Node Recovery Required</p>
						<p className="text-amber-300/80 text-sm mb-3">
							After CA rotation, worker nodes must be updated with the new CA trust bundle.
							The recovery process depends on your node type:
						</p>

						<div className="space-y-3 text-sm">
							<div className="bg-neutral-900/50 rounded p-3">
								<p className="text-neutral-200 font-medium">Talos Linux Workers:</p>
								<code className="text-xs text-neutral-400 block mt-1">
									talosctl -n &lt;worker-ip&gt; reboot
								</code>
								<p className="text-neutral-500 text-xs mt-1">
									Or restart the VM to trigger re-bootstrap with new CA.
								</p>
							</div>

							<div className="bg-neutral-900/50 rounded p-3">
								<p className="text-neutral-200 font-medium">Kubeadm/Rocky Linux Workers:</p>
								<code className="text-xs text-neutral-400 block mt-1">
									# Update /etc/kubernetes/pki/ca.crt with new CA<br />
									systemctl restart kubelet
								</code>
								<p className="text-neutral-500 text-xs mt-1">
									Copy the new CA certificate to each worker node and restart kubelet.
								</p>
							</div>
						</div>
					</div>

					{/* Acknowledgment checkbox */}
					<label className="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={understandsImpact}
							onChange={(e) => setUnderstandsImpact(e.target.checked)}
							className="mt-1 w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
						/>
						<span className="text-sm text-neutral-300">
							I understand that this operation will cause temporary cluster downtime and that I will need to
							manually recover worker nodes after the CA rotation completes.
						</span>
					</label>

					{/* Type to confirm */}
					<div>
						<label className="block text-sm text-neutral-400 mb-2">
							Type <span className="text-red-400 font-mono">{clusterName}</span> to confirm:
						</label>
						<Input
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder={clusterName}
							className="font-mono"
						/>
					</div>
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={handleClose} disabled={loading}>
					Cancel
				</Button>
				<Button
					variant="danger"
					onClick={handleConfirm}
					disabled={!canConfirm || loading}
				>
					{loading ? 'Rotating CA...' : 'Rotate Certificate Authority'}
				</Button>
			</ModalFooter>
		</Modal>
	);
}
