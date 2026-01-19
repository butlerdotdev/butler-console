/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type {
	ClusterCertificates,
	RotationType,
	CertHealthStatus,
} from '@/types/certificates';
import {
	HEALTH_STATUS_CONFIG,
	ROTATION_TYPE_CONFIG,
	formatDaysUntilExpiry,
	formatCertDate,
	getHealthCounts,
} from '@/types/certificates';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface CertificateHealthOverviewProps {
	certificates: ClusterCertificates;
	onRotate: (type: RotationType) => void;
	canRotate: boolean;
	canRotateCA: boolean;
}

export function CertificateHealthOverview({
	certificates,
	onRotate,
	canRotate,
	canRotateCA,
}: CertificateHealthOverviewProps) {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	// Capture current time once on mount to avoid impure Date.now() calls during render
	const [currentTime] = useState(() => Date.now());
	const healthCounts = getHealthCounts(certificates.categories);
	const healthConfig = HEALTH_STATUS_CONFIG[certificates.overallHealth];

	const daysUntilEarliest = certificates.earliestExpiry
		? Math.floor(
			(new Date(certificates.earliestExpiry).getTime() - currentTime) /
			(1000 * 60 * 60 * 24)
		)
		: null;

	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-lg font-semibold text-gray-900">Certificate Health</h3>
				<span
					className={`px-3 py-1 rounded-full text-sm font-medium ${healthConfig.bgColor} ${healthConfig.color}`}
				>
					{healthConfig.icon} {healthConfig.label}
				</span>
			</div>

			{/* Health metrics */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<HealthMetric
					label="Healthy"
					value={healthCounts.Healthy}
					status="Healthy"
				/>
				<HealthMetric
					label="Warning"
					value={healthCounts.Warning}
					status="Warning"
				/>
				<HealthMetric
					label="Critical"
					value={healthCounts.Critical}
					status="Critical"
				/>
				<div className="bg-gray-50 rounded-lg p-4">
					<div className="text-sm text-gray-500">Earliest Expiry</div>
					<div className="text-lg font-semibold text-gray-900">
						{certificates.earliestExpiry
							? formatCertDate(certificates.earliestExpiry)
							: 'N/A'}
					</div>
					{daysUntilEarliest !== null && (
						<div className="text-xs text-gray-500">
							({formatDaysUntilExpiry(daysUntilEarliest)})
						</div>
					)}
				</div>
			</div>

			{/* Last rotation info */}
			{certificates.lastRotation && (
				<div className="text-sm text-gray-500 mb-4">
					Last Rotation:{' '}
					{formatCertDate(certificates.lastRotation.initiatedAt)}
					{certificates.lastRotation.initiatedBy && (
						<> by {certificates.lastRotation.initiatedBy}</>
					)}
					{certificates.lastRotation.status === 'in-progress' && (
						<span className="ml-2 text-yellow-600">(in progress)</span>
					)}
				</div>
			)}

			{/* Rotation in progress warning */}
			{certificates.rotationInProgress && (
				<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-yellow-500 mr-2 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						<span className="text-yellow-800 font-medium">
							Certificate rotation in progress...
						</span>
					</div>
				</div>
			)}

			{/* Rotation dropdown */}
			{canRotate && !certificates.rotationInProgress && (
				<div className="relative">
					<Button
						onClick={() => setDropdownOpen(!dropdownOpen)}
						variant="secondary"
						className="w-full md:w-auto"
					>
						Rotate Certificates
						<svg
							className={`w-4 h-4 ml-2 transition-transform ${dropdownOpen ? 'rotate-180' : ''
								}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</Button>

					{dropdownOpen && (
						<>
							{/* Backdrop to close dropdown */}
							<div
								className="fixed inset-0 z-10"
								onClick={() => setDropdownOpen(false)}
							/>

							<div className="absolute left-0 mt-2 w-72 bg-neutral-800 rounded-lg shadow-lg border border-neutral-700 z-20">
								<div className="py-1">
									{(['all', 'kubeconfigs', 'ca'] as RotationType[]).map((type) => {
										const config = ROTATION_TYPE_CONFIG[type];
										const disabled = type === 'ca' && !canRotateCA;

										return (
											<button
												key={type}
												onClick={() => {
													setDropdownOpen(false);
													onRotate(type);
												}}
												disabled={disabled}
												className={`w-full text-left px-4 py-3 hover:bg-neutral-700 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''
													} ${config.warning ? 'border-t border-neutral-700' : ''}`}
											>
												<div className="flex items-center">
													<span className="font-medium text-neutral-100">
														{config.label}
													</span>
													{config.warning && (
														<span className="ml-2 text-red-500">⚠</span>
													)}
												</div>
												<div className="text-sm text-neutral-400 mt-0.5">
													{config.description}
												</div>
												{disabled && (
													<div className="text-xs text-red-400 mt-1">
														Requires admin role
													</div>
												)}
											</button>
										);
									})}
								</div>
							</div>
						</>
					)}
				</div>
			)}
		</Card>
	);
}

interface HealthMetricProps {
	label: string;
	value: number;
	status: CertHealthStatus;
}

function HealthMetric({ label, value, status }: HealthMetricProps) {
	const config = HEALTH_STATUS_CONFIG[status];

	return (
		<div className={`rounded-lg p-4 ${config.bgColor}`}>
			<div className={`text-sm ${config.color}`}>{label}</div>
			<div className={`text-2xl font-bold ${config.color}`}>{value}</div>
		</div>
	);
}
