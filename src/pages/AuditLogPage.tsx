// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback } from 'react'
import { useDocumentTitle } from '@/hooks'
import { auditApi } from '@/api/audit'
import { Card, Spinner, Button, FadeIn } from '@/components/ui'
import type { AuditEntry, AuditFilters } from '@/api/audit'

const PAGE_SIZES = [25, 50, 100]

const RESOURCE_TYPE_OPTIONS = [
	'TenantCluster',
	'Team',
	'User',
	'ProviderConfig',
	'IdentityProvider',
	'NetworkPool',
	'TenantAddon',
	'ManagementAddon',
	'ImageSync',
	'ButlerConfig',
	'Workspace',
]

const ACTION_OPTIONS = [
	'create',
	'update',
	'delete',
	'scale',
	'login',
	'logout',
	'login_failed',
]

const AUTH_ACTIONS = new Set(['login', 'logout', 'login_failed'])

export function AuditLogPage() {
	useDocumentTitle('Audit Log')

	const [entries, setEntries] = useState<AuditEntry[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

	// Filter state
	const [filterUser, setFilterUser] = useState('')
	const [filterAction, setFilterAction] = useState('')
	const [filterResourceType, setFilterResourceType] = useState('')
	const [filterSuccess, setFilterSuccess] = useState('')
	const [filterFrom, setFilterFrom] = useState('')
	const [filterTo, setFilterTo] = useState('')

	// Pagination state
	const [pageSize, setPageSize] = useState(25)
	const [offset, setOffset] = useState(0)

	const buildFilters = useCallback((): AuditFilters => {
		const filters: AuditFilters = {
			limit: pageSize,
			offset,
		}
		if (filterUser) filters.user = filterUser
		if (filterAction) filters.action = filterAction
		if (filterResourceType) filters.resourceType = filterResourceType
		if (filterSuccess) filters.success = filterSuccess
		if (filterFrom) filters.from = new Date(filterFrom).toISOString()
		if (filterTo) {
			const toDate = new Date(filterTo)
			toDate.setHours(23, 59, 59, 999)
			filters.to = toDate.toISOString()
		}
		return filters
	}, [pageSize, offset, filterUser, filterAction, filterResourceType, filterSuccess, filterFrom, filterTo])

	const loadEntries = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const response = await auditApi.listAll(buildFilters())
			setEntries(response.entries || [])
			setTotal(response.total)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load audit entries')
		} finally {
			setLoading(false)
		}
	}, [buildFilters])

	useEffect(() => {
		loadEntries()
	}, [loadEntries])

	const handleApplyFilters = () => {
		setOffset(0)
		setExpandedIndex(null)
		loadEntries()
	}

	const handleResetFilters = () => {
		setFilterUser('')
		setFilterAction('')
		setFilterResourceType('')
		setFilterSuccess('')
		setFilterFrom('')
		setFilterTo('')
		setOffset(0)
		setExpandedIndex(null)
	}

	const handlePrevPage = () => {
		setOffset(Math.max(0, offset - pageSize))
		setExpandedIndex(null)
	}

	const handleNextPage = () => {
		if (offset + pageSize < total) {
			setOffset(offset + pageSize)
			setExpandedIndex(null)
		}
	}

	const handlePageSizeChange = (newSize: number) => {
		setPageSize(newSize)
		setOffset(0)
		setExpandedIndex(null)
	}

	const toggleRow = (index: number) => {
		setExpandedIndex(expandedIndex === index ? null : index)
	}

	const inputClass =
		'w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'

	const showingFrom = total > 0 ? offset + 1 : 0
	const showingTo = Math.min(offset + pageSize, total)

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Audit Log</h1>
					<p className="text-neutral-400 mt-1">
						Recent platform audit events from all users and actions
					</p>
				</div>

				{/* Filter Bar */}
				<Card className="p-4">
					<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">From</label>
							<input
								type="date"
								value={filterFrom}
								onChange={(e) => setFilterFrom(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">To</label>
							<input
								type="date"
								value={filterTo}
								onChange={(e) => setFilterTo(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">User</label>
							<input
								type="text"
								value={filterUser}
								onChange={(e) => setFilterUser(e.target.value)}
								placeholder="Filter by email..."
								className={inputClass}
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">Resource Type</label>
							<select
								value={filterResourceType}
								onChange={(e) => setFilterResourceType(e.target.value)}
								className={inputClass}
							>
								<option value="">All</option>
								{RESOURCE_TYPE_OPTIONS.map((rt) => (
									<option key={rt} value={rt}>{rt}</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">Action</label>
							<select
								value={filterAction}
								onChange={(e) => setFilterAction(e.target.value)}
								className={inputClass}
							>
								<option value="">All</option>
								{ACTION_OPTIONS.map((a) => (
									<option key={a} value={a}>{a}</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs font-medium text-neutral-500 mb-1">Status</label>
							<select
								value={filterSuccess}
								onChange={(e) => setFilterSuccess(e.target.value)}
								className={inputClass}
							>
								<option value="">All</option>
								<option value="true">Success</option>
								<option value="false">Failed</option>
							</select>
						</div>
					</div>
					<div className="flex items-center gap-3 mt-3">
						<Button size="sm" onClick={handleApplyFilters}>
							Apply
						</Button>
						<button
							onClick={handleResetFilters}
							className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
						>
							Reset
						</button>
					</div>
				</Card>

				{/* Loading */}
				{loading && (
					<div className="flex items-center justify-center h-64">
						<Spinner size="lg" />
					</div>
				)}

				{/* Error */}
				{!loading && error && (
					<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-red-400">{error}</p>
						<button
							onClick={loadEntries}
							className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
						>
							Retry
						</button>
					</div>
				)}

				{/* Empty State */}
				{!loading && !error && entries.length === 0 && (
					<Card className="p-8 text-center">
						<div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
							<AuditLogIcon className="w-6 h-6 text-neutral-500" />
						</div>
						<h3 className="text-lg font-medium text-neutral-200 mb-2">No Audit Entries</h3>
						<p className="text-neutral-400">
							Audit events will appear here as users interact with the platform.
						</p>
					</Card>
				)}

				{/* Table */}
				{!loading && !error && entries.length > 0 && (
					<Card className="overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b border-neutral-800">
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Time
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											User
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Action
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Resource
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Status
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-neutral-800">
									{entries.map((entry, idx) => (
										<AuditRow
											key={`${entry.timestamp}-${idx}`}
											entry={entry}
											expanded={expandedIndex === idx}
											onToggle={() => toggleRow(idx)}
										/>
									))}
								</tbody>
							</table>
						</div>

						{/* Pagination */}
						<div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
							<div className="flex items-center gap-4">
								<span className="text-sm text-neutral-400">
									Showing {showingFrom}-{showingTo} of {total} entries
								</span>
								<div className="flex items-center gap-2">
									<label className="text-xs text-neutral-500">Per page:</label>
									<select
										value={pageSize}
										onChange={(e) => handlePageSizeChange(Number(e.target.value))}
										className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
									>
										{PAGE_SIZES.map((size) => (
											<option key={size} value={size}>{size}</option>
										))}
									</select>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="secondary"
									onClick={handlePrevPage}
									disabled={offset === 0}
								>
									Previous
								</Button>
								<Button
									size="sm"
									variant="secondary"
									onClick={handleNextPage}
									disabled={offset + pageSize >= total}
								>
									Next
								</Button>
							</div>
						</div>
					</Card>
				)}
			</div>
		</FadeIn>
	)
}

// ----------------------------------------------------------------------------
// Table Row
// ----------------------------------------------------------------------------

interface AuditRowProps {
	entry: AuditEntry
	expanded: boolean
	onToggle: () => void
}

function AuditRow({ entry, expanded, onToggle }: AuditRowProps) {
	const relativeTime = formatRelativeTime(entry.timestamp)
	const fullTimestamp = new Date(entry.timestamp).toISOString()
	const isAuth = AUTH_ACTIONS.has(entry.action)

	const resourceLabel = isAuth
		? 'Authentication'
		: entry.resourceType && entry.resourceName
			? `${entry.resourceType}/${entry.resourceName}`
			: entry.resourceType || '-'

	return (
		<>
			<tr
				className="hover:bg-neutral-800/30 transition-colors cursor-pointer"
				onClick={onToggle}
			>
				<td className="px-4 py-3">
					<span
						className="text-sm text-neutral-300"
						title={fullTimestamp}
					>
						{relativeTime}
					</span>
				</td>
				<td className="px-4 py-3">
					<span className="text-sm text-neutral-200 truncate block max-w-[200px]" title={entry.user}>
						{entry.user}
					</span>
				</td>
				<td className="px-4 py-3">
					<ActionBadge action={entry.action} />
				</td>
				<td className="px-4 py-3">
					<span className="text-sm text-neutral-300 font-mono truncate block max-w-[250px]" title={resourceLabel}>
						{resourceLabel}
					</span>
				</td>
				<td className="px-4 py-3">
					<StatusCodeLabel code={entry.statusCode} />
				</td>
			</tr>
			{expanded && (
				<tr>
					<td colSpan={5} className="px-4 py-4 bg-neutral-800/20">
						<AuditDetailPanel entry={entry} />
					</td>
				</tr>
			)}
		</>
	)
}

// ----------------------------------------------------------------------------
// Expanded Detail Panel
// ----------------------------------------------------------------------------

function AuditDetailPanel({ entry }: { entry: AuditEntry }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
			<div className="space-y-2">
				<DetailField label="Full Timestamp" value={new Date(entry.timestamp).toISOString()} />
				{entry.httpMethod && entry.path && (
					<DetailField
						label="HTTP Request"
						value={`${entry.httpMethod} ${entry.path}`}
						mono
					/>
				)}
				{entry.sourceIP && (
					<DetailField label="Source IP" value={entry.sourceIP} mono />
				)}
				{entry.teamRef && (
					<DetailField label="Team Context" value={entry.teamRef} />
				)}
				{entry.provider && (
					<DetailField label="Provider" value={entry.provider} />
				)}
				{entry.resourceNamespace && (
					<DetailField label="Resource Namespace" value={entry.resourceNamespace} mono />
				)}
			</div>
			<div className="space-y-2">
				{entry.requestSummary && (
					<div>
						<p className="text-xs font-medium text-neutral-500 mb-1">Request Summary</p>
						<pre className="font-mono text-xs text-neutral-300 bg-neutral-900 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
							{entry.requestSummary}
						</pre>
					</div>
				)}
				{entry.errorMessage && (
					<div>
						<p className="text-xs font-medium text-neutral-500 mb-1">Error Message</p>
						<p className="text-sm text-red-400">{entry.errorMessage}</p>
					</div>
				)}
			</div>
		</div>
	)
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
	return (
		<div>
			<p className="text-xs font-medium text-neutral-500">{label}</p>
			<p className={`text-neutral-300 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
		</div>
	)
}

// ----------------------------------------------------------------------------
// Action Badge
// ----------------------------------------------------------------------------

function ActionBadge({ action }: { action: string }) {
	const config: Record<string, { bg: string; text: string }> = {
		create: { bg: 'bg-green-500/10', text: 'text-green-400' },
		delete: { bg: 'bg-red-500/10', text: 'text-red-400' },
		update: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
		login: { bg: 'bg-green-500/10', text: 'text-green-400' },
		login_failed: { bg: 'bg-red-500/10', text: 'text-red-400' },
		scale: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
		logout: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
	}

	const displayLabels: Record<string, string> = {
		create: 'Create',
		delete: 'Delete',
		update: 'Update',
		login: 'Login',
		login_failed: 'Login Failed',
		scale: 'Scale',
		logout: 'Logout',
	}

	const c = config[action] || { bg: 'bg-neutral-500/10', text: 'text-neutral-400' }
	const label = displayLabels[action] || action

	return (
		<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
			{label}
		</span>
	)
}

// ----------------------------------------------------------------------------
// Status Code Label
// ----------------------------------------------------------------------------

function StatusCodeLabel({ code }: { code?: number }) {
	if (!code) return <span className="text-sm text-neutral-500">-</span>

	let colorClass = 'text-neutral-400'
	if (code >= 200 && code < 300) colorClass = 'text-green-400'
	else if (code >= 400 && code < 500) colorClass = 'text-amber-400'
	else if (code >= 500) colorClass = 'text-red-400'

	return <span className={`text-sm font-mono font-medium ${colorClass}`}>{code}</span>
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatRelativeTime(timestamp: string): string {
	const now = Date.now()
	const then = new Date(timestamp).getTime()
	const diffMs = now - then

	const minutes = Math.floor(diffMs / 60000)
	if (minutes < 1) return 'Just now'
	if (minutes < 60) return `${minutes}m ago`

	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`

	const days = Math.floor(hours / 24)
	if (days < 30) return `${days}d ago`

	return new Date(timestamp).toLocaleDateString()
}

// ----------------------------------------------------------------------------
// Icons
// ----------------------------------------------------------------------------

function AuditLogIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
			/>
		</svg>
	)
}
