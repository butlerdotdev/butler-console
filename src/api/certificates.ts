/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from './client';
import type {
	ClusterCertificates,
	RotateCertificatesRequest,
	RotationEvent,
	CertificateCategory,
	CertificateInfo,
} from '@/types/certificates';

/**
 * Get all certificates for a cluster.
 */
export async function getCertificates(
	namespace: string,
	name: string
): Promise<ClusterCertificates> {
	return apiClient.get<ClusterCertificates>(
		`/clusters/${namespace}/${name}/certificates`
	);
}

/**
 * Get certificates for a specific category.
 */
export async function getCertificatesByCategory(
	namespace: string,
	name: string,
	category: CertificateCategory
): Promise<{ category: CertificateCategory; certificates: CertificateInfo[] }> {
	return apiClient.get<{
		category: CertificateCategory;
		certificates: CertificateInfo[];
	}>(`/clusters/${namespace}/${name}/certificates/${category}`);
}

/**
 * Trigger certificate rotation.
 *
 * @param namespace - Cluster namespace
 * @param name - Cluster name
 * @param type - Rotation type: "all", "kubeconfigs", or "ca"
 * @param acknowledge - Required for CA rotation
 */
export async function rotateCertificates(
	namespace: string,
	name: string,
	type: RotateCertificatesRequest['type'],
	acknowledge: boolean = false
): Promise<RotationEvent> {
	return apiClient.post<RotationEvent>(
		`/clusters/${namespace}/${name}/certificates/rotate`,
		{ type, acknowledge }
	);
}

/**
 * Get the current rotation status.
 */
export async function getRotationStatus(
	namespace: string,
	name: string
): Promise<RotationEvent> {
	return apiClient.get<RotationEvent>(
		`/clusters/${namespace}/${name}/certificates/rotation-status`
	);
}

/**
 * Custom hook for certificate polling during rotation.
 * Returns a function that starts polling and returns a cleanup function.
 */
export function createRotationPoller(
	namespace: string,
	name: string,
	onUpdate: (certs: ClusterCertificates) => void,
	onError?: (error: Error) => void,
	intervalMs: number = 5000
): () => () => void {
	return () => {
		let active = true;

		const poll = async () => {
			while (active) {
				try {
					const certs = await getCertificates(namespace, name);
					if (active) {
						onUpdate(certs);

						// Stop polling if rotation is complete
						if (!certs.rotationInProgress) {
							active = false;
							break;
						}
					}
				} catch (error) {
					if (active && onError) {
						onError(error instanceof Error ? error : new Error(String(error)));
					}
				}

				// Wait for next poll
				await new Promise((resolve) => setTimeout(resolve, intervalMs));
			}
		};

		poll();

		// Return cleanup function
		return () => {
			active = false;
		};
	};
}
