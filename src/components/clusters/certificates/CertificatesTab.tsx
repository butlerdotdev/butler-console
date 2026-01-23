/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type {
	ClusterCertificates,
	RotationType,
	CertificateCategory,
} from '@/types/certificates';
import { getSortedCategories } from '@/types/certificates';
import { getCertificates, rotateCertificates } from '@/api/certificates';
import { CertificateHealthOverview } from './CertificateHealthOverview';
import { CertificateCategorySection } from './CertificateCategory';
import { RotationModal, CARotationModal } from './RotationModals';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

// Poll interval during rotation (5 seconds)
const ROTATION_POLL_INTERVAL = 5000;
// Regular refresh interval (60 seconds)
const REGULAR_REFRESH_INTERVAL = 60000;

export function CertificatesTab() {
	const { namespace, name } = useParams<{ namespace: string; name: string }>();
	const { user } = useAuth();
	const { success, error: showError } = useToast();

	const [certificates, setCertificates] = useState<ClusterCertificates | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Track if we just triggered a rotation (for optimistic UI)
	const [justTriggeredRotation, setJustTriggeredRotation] = useState(false);
	const [rotationTriggeredAt, setRotationTriggeredAt] = useState<number | null>(null);
	const [showRotationSuccess, setShowRotationSuccess] = useState(false);

	// Minimum time to show rotation banner (ms) so users see feedback
	const MIN_ROTATION_DISPLAY_TIME = 3000;

	// Modal state
	const [rotationModalOpen, setRotationModalOpen] = useState(false);
	const [caModalOpen, setCAModalOpen] = useState(false);
	const [selectedRotationType, setSelectedRotationType] = useState<RotationType>('all');
	const [rotating, setRotating] = useState(false);

	// Compute affected secrets for modal display
	const [affectedSecrets, setAffectedSecrets] = useState<string[]>([]);

	// Ref to track poll interval
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// Permission checks
	const isAdmin = user?.isPlatformAdmin || user?.teams?.some((t) => t.role === 'admin') || false;
	const isOperator =
		isAdmin || user?.teams?.some((t) => t.role === 'operator' || t.role === 'admin') || false;

	// Fetch certificates
	const fetchCertificates = useCallback(async () => {
		if (!namespace || !name) return;

		try {
			// Don't show loading spinner on subsequent fetches
			if (!certificates) {
				setLoading(true);
			}
			const data = await getCertificates(namespace, name);
			setCertificates(data);
			setError(null);

			// Handle rotation completion with minimum display time
			if (justTriggeredRotation && !data.rotationInProgress) {
				const elapsed = rotationTriggeredAt ? Date.now() - rotationTriggeredAt : MIN_ROTATION_DISPLAY_TIME;

				if (elapsed >= MIN_ROTATION_DISPLAY_TIME) {
					// Minimum time passed - show success briefly, then clear
					setJustTriggeredRotation(false);
					setShowRotationSuccess(true);
					setTimeout(() => setShowRotationSuccess(false), 2000);
				}
				// If minimum time hasn't passed, keep showing "in progress"
				// The next poll will check again
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load certificates';
			setError(message);
			console.error('Failed to fetch certificates:', err);
		} finally {
			setLoading(false);
		}
	}, [namespace, name, certificates, justTriggeredRotation, rotationTriggeredAt]);

	// Initial fetch
	useEffect(() => {
		const doFetch = async () => {
			if (!namespace || !name) return;

			try {
				if (!certificates) {
					setLoading(true);
				}
				const data = await getCertificates(namespace, name);
				setCertificates(data);
				setError(null);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load certificates';
				setError(message);
				console.error('Failed to fetch certificates:', err);
			} finally {
				setLoading(false);
			}
		};

		doFetch();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [namespace, name]); // Only refetch when route params change

	// Set up polling based on rotation status
	useEffect(() => {
		// Clear any existing interval
		if (pollIntervalRef.current) {
			clearInterval(pollIntervalRef.current);
			pollIntervalRef.current = null;
		}

		// Determine poll interval based on state
		// Poll fast if rotation is in progress OR we're still in the minimum display window
		const needsFastPolling = certificates?.rotationInProgress || justTriggeredRotation;
		const interval = needsFastPolling ? ROTATION_POLL_INTERVAL : REGULAR_REFRESH_INTERVAL;

		pollIntervalRef.current = setInterval(fetchCertificates, interval);

		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, [certificates?.rotationInProgress, justTriggeredRotation, fetchCertificates]);

	// Compute affected secrets when opening modal
	const computeAffectedSecrets = useCallback(
		(type: RotationType): string[] => {
			if (!certificates) return [];

			const secrets = new Set<string>();

			for (const [category, certList] of Object.entries(certificates.categories)) {
				const shouldInclude =
					(type === 'all' && category !== 'ca') ||
					(type === 'kubeconfigs' && category === 'kubeconfig') ||
					(type === 'ca' && category === 'ca');

				if (shouldInclude) {
					certList.forEach((cert) => secrets.add(cert.secretName));
				}
			}

			return Array.from(secrets);
		},
		[certificates]
	);

	// Handle rotation request
	const handleRotate = async (type: RotationType, acknowledge: boolean = false) => {
		if (!namespace || !name) return;

		try {
			setRotating(true);
			await rotateCertificates(namespace, name, type, acknowledge);

			// Optimistic UI - show rotation in progress immediately
			setJustTriggeredRotation(true);
			setRotationTriggeredAt(Date.now());
			setShowRotationSuccess(false);

			success('Rotation Initiated', 'Certificate rotation has been triggered.');
			setRotationModalOpen(false);
			setCAModalOpen(false);

			// Immediately fetch to update UI
			await fetchCertificates();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to initiate rotation';
			showError('Rotation Failed', message);
		} finally {
			setRotating(false);
		}
	};

	// Open rotation modal
	const openRotationModal = (type: RotationType) => {
		setSelectedRotationType(type);
		setAffectedSecrets(computeAffectedSecrets(type));

		if (type === 'ca') {
			setCAModalOpen(true);
		} else {
			setRotationModalOpen(true);
		}
	};

	// Determine if rotation is happening (either from server or optimistic)
	const isRotationActive = certificates?.rotationInProgress || justTriggeredRotation;
	const showRotationBanner = isRotationActive || showRotationSuccess;

	// Loading state (only for initial load)
	if (loading && !certificates) {
		return (
			<div className="flex items-center justify-center p-12">
				<Spinner size="lg" />
				<span className="ml-3 text-neutral-400">Loading certificates...</span>
			</div>
		);
	}

	// Error state
	if (error && !certificates) {
		return (
			<div className="p-6 bg-red-900/20 border border-red-700 rounded-lg">
				<h3 className="text-red-400 font-medium">Failed to load certificates</h3>
				<p className="text-red-300 mt-1">{error}</p>
				<button
					onClick={fetchCertificates}
					className="mt-4 px-4 py-2 bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 transition-colors"
				>
					Retry
				</button>
			</div>
		);
	}

	// No certificates found
	if (!certificates || certificates.certificateCount === 0) {
		return (
			<div className="p-6 bg-neutral-800 border border-neutral-700 rounded-lg text-center">
				<h3 className="text-neutral-200 font-medium">No certificates found</h3>
				<p className="text-neutral-400 mt-1">
					Certificate information is not available for this cluster. The cluster may still be
					provisioning, or Steward may not be managing its certificates.
				</p>
			</div>
		);
	}

	const sortedCategories = getSortedCategories();

	return (
		<div className="space-y-6">
			{/* Rotation in progress banner */}
			{showRotationBanner && (
				<div className={`p-4 rounded-lg flex items-center gap-3 transition-colors ${showRotationSuccess
					? 'bg-green-900/30 border border-green-700'
					: 'bg-amber-900/30 border border-amber-700'
					}`}>
					{!showRotationSuccess && <Spinner size="sm" />}
					{showRotationSuccess && (
						<svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
					)}
					<div>
						<p className={`font-medium ${showRotationSuccess ? 'text-green-200' : 'text-amber-200'}`}>
							{showRotationSuccess ? 'Certificate rotation complete' : 'Certificate rotation in progress'}
						</p>
						<p className={`text-sm ${showRotationSuccess ? 'text-green-300/70' : 'text-amber-300/70'}`}>
							{showRotationSuccess
								? 'New certificates have been generated successfully.'
								: 'This may take a few moments. The page will automatically refresh when complete.'}
							{!showRotationSuccess && certificates?.lastRotation?.initiatedBy && (
								<> Initiated by {certificates.lastRotation.initiatedBy}.</>
							)}
						</p>
					</div>
				</div>
			)}

			{/* Health overview with rotation dropdown */}
			<CertificateHealthOverview
				certificates={certificates}
				onRotate={openRotationModal}
				canRotate={isOperator && !isRotationActive}
				canRotateCA={isAdmin && !isRotationActive}
			/>

			{/* Certificate categories */}
			<div className="space-y-4">
				{sortedCategories.map((category) => {
					const certs = certificates.categories[category as CertificateCategory];
					if (!certs || certs.length === 0) return null;

					return (
						<CertificateCategorySection
							key={category}
							category={category as CertificateCategory}
							certificates={certs}
						/>
					);
				})}
			</div>

			{/* Last rotation info */}
			{certificates.lastRotation && !isRotationActive && (
				<div className="text-sm text-neutral-500 text-right">
					Last rotation: {new Date(certificates.lastRotation.initiatedAt).toLocaleString()}
					{certificates.lastRotation.initiatedBy && (
						<> by {certificates.lastRotation.initiatedBy}</>
					)}
				</div>
			)}

			{/* Standard rotation modal */}
			<RotationModal
				isOpen={rotationModalOpen}
				onClose={() => setRotationModalOpen(false)}
				clusterName={name || ''}
				rotationType={selectedRotationType}
				affectedSecrets={affectedSecrets}
				onConfirm={() => handleRotate(selectedRotationType)}
				loading={rotating}
			/>

			{/* CA rotation modal with type-to-confirm */}
			<CARotationModal
				isOpen={caModalOpen}
				onClose={() => setCAModalOpen(false)}
				clusterName={name || ''}
				onConfirm={() => handleRotate('ca', true)}
				loading={rotating}
			/>
		</div>
	);
}

export default CertificatesTab;
