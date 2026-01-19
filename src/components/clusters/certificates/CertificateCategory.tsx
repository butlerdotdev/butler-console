/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { CertificateCategory, CertificateInfo } from '@/types/certificates';
import {
	CERTIFICATE_CATEGORIES,
	HEALTH_STATUS_CONFIG,
	getCategoryHealth,
	formatDaysUntilExpiry,
	formatCertDate,
} from '@/types/certificates';

interface CertificateCategorySectionProps {
	category: CertificateCategory;
	certificates: CertificateInfo[];
}

export function CertificateCategorySection({
	category,
	certificates,
}: CertificateCategorySectionProps) {
	const [expanded, setExpanded] = useState(category === 'api-server' || category === 'kubeconfig');
	const categoryConfig = CERTIFICATE_CATEGORIES[category];
	const categoryHealth = getCategoryHealth(certificates);
	const healthConfig = HEALTH_STATUS_CONFIG[categoryHealth];

	return (
		<div className="border border-gray-200 rounded-lg overflow-hidden">
			{/* Header */}
			<button
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
			>
				<div className="flex items-center">
					<svg
						className={`w-5 h-5 text-gray-500 mr-2 transition-transform ${expanded ? 'rotate-90' : ''
							}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<span className="font-medium text-gray-900">{categoryConfig.label}</span>
					<span className="ml-2 text-sm text-gray-500">({certificates.length})</span>
				</div>
				<span
					className={`px-2 py-0.5 rounded text-xs font-medium ${healthConfig.bgColor} ${healthConfig.color}`}
				>
					{healthConfig.label}
				</span>
			</button>

			{/* Certificates list */}
			{expanded && (
				<div className="p-4 space-y-3">
					{certificates.map((cert, idx) => (
						<CertificateCard key={`${cert.secretName}-${cert.secretKey}-${idx}`} cert={cert} />
					))}
				</div>
			)}
		</div>
	);
}

interface CertificateCardProps {
	cert: CertificateInfo;
}

function CertificateCard({ cert }: CertificateCardProps) {
	const [showDetails, setShowDetails] = useState(false);
	const healthConfig = HEALTH_STATUS_CONFIG[cert.healthStatus];

	// Extract common name from subject
	const cn = extractCN(cert.subject);

	return (
		<div className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors">
			{/* Main info */}
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<div className="flex items-center">
						<span className={`mr-2 ${healthConfig.color}`}>{healthConfig.icon}</span>
						<span className="font-medium text-neutral-100 truncate">{cn || cert.subject}</span>
					</div>
					<div className="mt-1 text-sm text-gray-500">
						Secret: {cert.secretName}
					</div>
				</div>
				<div className="text-right ml-4">
					<div className={`text-sm font-medium ${healthConfig.color}`}>
						{formatDaysUntilExpiry(cert.daysUntilExpiry)}
					</div>
					<div className="text-xs text-gray-400">until expiry</div>
				</div>
			</div>

			{/* Dates row */}
			<div className="mt-3 flex items-center text-sm text-gray-500">
				<span>Issued: {formatCertDate(cert.notBefore)}</span>
				<span className="mx-2">→</span>
				<span>Expires: {formatCertDate(cert.notAfter)}</span>
				{cert.isCA && (
					<span className="ml-3 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
						CA
					</span>
				)}
			</div>

			{/* Toggle details */}
			<button
				onClick={() => setShowDetails(!showDetails)}
				className="mt-2 text-sm text-blue-600 hover:text-blue-800"
			>
				{showDetails ? 'Hide details' : 'Show details'}
			</button>

			{/* Expanded details */}
			{showDetails && (
				<div className="mt-3 pt-3 border-t border-gray-100 text-sm">
					<DetailRow label="Subject" value={cert.subject} />
					<DetailRow label="Issuer" value={cert.issuer} />
					<DetailRow label="Serial" value={cert.serialNumber} mono />
					<DetailRow label="Secret Key" value={cert.secretKey} mono />
					<DetailRow label="Age" value={`${cert.ageInDays} days`} />

					{cert.dnsNames && cert.dnsNames.length > 0 && (
						<div className="mt-2">
							<span className="text-gray-500">DNS SANs:</span>
							<div className="mt-1 flex flex-wrap gap-1">
								{cert.dnsNames.map((dns) => (
									<span
										key={dns}
										className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono"
									>
										{dns}
									</span>
								))}
							</div>
						</div>
					)}

					{cert.ipAddresses && cert.ipAddresses.length > 0 && (
						<div className="mt-2">
							<span className="text-gray-500">IP SANs:</span>
							<div className="mt-1 flex flex-wrap gap-1">
								{cert.ipAddresses.map((ip) => (
									<span
										key={ip}
										className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono"
									>
										{ip}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

interface DetailRowProps {
	label: string;
	value: string;
	mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
	return (
		<div className="flex py-1">
			<span className="w-24 text-gray-500 flex-shrink-0">{label}:</span>
			<span className={`text-gray-900 break-all ${mono ? 'font-mono text-xs' : ''}`}>
				{value}
			</span>
		</div>
	);
}

/**
 * Extract Common Name from an X.509 subject string.
 */
function extractCN(subject: string): string | null {
	const match = subject.match(/CN=([^,]+)/);
	return match ? match[1] : null;
}
