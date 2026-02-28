// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { observabilityApi } from '@/api/observability'
import { clustersApi, type Cluster } from '@/api'
import { Card, Spinner, Button, FadeIn, StatusBadge, Input } from '@/components/ui'
import { PipelineDiagram } from '@/components/observability/PipelineDiagram'
import { useToast } from '@/hooks/useToast'
import type {
	ObservabilityConfig,
	ObservabilityStatus,
	ClusterObsInfo,
} from '@/types/observability'

export function ObservabilityPage() {
	useDocumentTitle('Observability')
	const { success, error: showError } = useToast()
	const [searchParams, setSearchParams] = useSearchParams()
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const [config, setConfig] = useState<ObservabilityConfig | null>(null)
	const [status, setStatus] = useState<ObservabilityStatus | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [serverUnavailable, setServerUnavailable] = useState(false)

	// Setup form state
	const [selectedCluster, setSelectedCluster] = useState('')
	const [selectedClusterPhase, setSelectedClusterPhase] = useState<string | null>(null)
	const [logEndpoint, setLogEndpoint] = useState('')
	const [metricEndpoint, setMetricEndpoint] = useState('')
	const [traceEndpoint, setTraceEndpoint] = useState('')
	const [setupSubmitting, setSetupSubmitting] = useState(false)

	// Deregister state
	const [deregistering, setDeregistering] = useState(false)

	// Edit pipeline state
	const [editingPipeline, setEditingPipeline] = useState(false)
	const [editLogEndpoint, setEditLogEndpoint] = useState('')
	const [editMetricEndpoint, setEditMetricEndpoint] = useState('')
	const [editTraceEndpoint, setEditTraceEndpoint] = useState('')
	const [editSubmitting, setEditSubmitting] = useState(false)

	// Diagram visibility
	const [showDiagram, setShowDiagram] = useState(false)

	// Collection defaults form state
	const [defaultPodLogs, setDefaultPodLogs] = useState(true)
	const [defaultJournald, setDefaultJournald] = useState(false)
	const [defaultK8sEvents, setDefaultK8sEvents] = useState(false)
	const [defaultRetention, setDefaultRetention] = useState('2h')
	const [savingConfig, setSavingConfig] = useState(false)

	useEffect(() => {
		const init = async () => {
			await loadData()
			const newCluster = searchParams.get('newCluster')
			if (newCluster) {
				setSelectedCluster(newCluster)
				setSearchParams({}, { replace: true })
			}
		}
		init()
	}, [])

	// Track selected cluster phase and poll if not Ready
	useEffect(() => {
		if (pollRef.current) {
			clearInterval(pollRef.current)
			pollRef.current = null
		}
		setSelectedClusterPhase(null)

		if (!selectedCluster) return

		const [ns, name] = selectedCluster.split('/')
		const found = clusters.find(c => c.metadata.namespace === ns && c.metadata.name === name)
		const phase = found?.status?.phase || null
		setSelectedClusterPhase(phase)

		if (phase && phase !== 'Ready') {
			pollRef.current = setInterval(async () => {
				try {
					const clusterData = await clustersApi.list()
					const updated = (clusterData.clusters || []).find(
						(c: Cluster) => c.metadata.namespace === ns && c.metadata.name === name
					)
					if (updated) {
						setClusters(prev =>
							prev.map(c =>
								c.metadata.namespace === ns && c.metadata.name === name ? updated : c
							)
						)
						setSelectedClusterPhase(updated.status?.phase || null)
						if (updated.status?.phase === 'Ready') {
							clearInterval(pollRef.current!)
							pollRef.current = null
						}
					}
				} catch { /* ignore polling errors */ }
			}, 10000)
		}

		return () => {
			if (pollRef.current) {
				clearInterval(pollRef.current)
				pollRef.current = null
			}
		}
	}, [selectedCluster, clusters])

	const loadData = async () => {
		setLoading(true)
		try {
			const [cfg, sts] = await Promise.allSettled([
				observabilityApi.getConfig(),
				observabilityApi.getStatus(),
			])

			if (cfg.status === 'fulfilled') {
				setConfig(cfg.value)
				setDefaultPodLogs(cfg.value.collection?.logs?.podLogs ?? true)
				setDefaultJournald(cfg.value.collection?.logs?.journald ?? false)
				setDefaultK8sEvents(cfg.value.collection?.logs?.kubernetesEvents ?? false)
				setDefaultRetention(cfg.value.collection?.metrics?.retention || '2h')
			} else {
				const err = cfg.reason as { status?: number }
				if (err?.status === 404) {
					setServerUnavailable(true)
					return
				}
			}

			if (sts.status === 'fulfilled') {
				setStatus(sts.value)
			}

			// Load clusters for setup dropdown
			try {
				const clusterData = await clustersApi.list()
				setClusters(clusterData.clusters || [])
			} catch {
				// Non-critical - just won't show cluster dropdown
			}
		} finally {
			setLoading(false)
		}
	}

	const handleSetupPipeline = async () => {
		if (!selectedCluster) {
			showError('Validation Error', 'Select a cluster')
			return
		}
		if (!logEndpoint) {
			showError('Validation Error', 'Log endpoint is required')
			return
		}

		const [namespace, name] = selectedCluster.split('/')
		if (!namespace || !name) {
			showError('Validation Error', 'Invalid cluster selection')
			return
		}

		setSetupSubmitting(true)
		try {
			const result = await observabilityApi.setupPipeline({
				clusterName: name,
				clusterNamespace: namespace,
				logEndpoint,
				metricEndpoint: metricEndpoint || undefined,
				traceEndpoint: traceEndpoint || undefined,
			})
			setConfig(result)
			success('Pipeline Registered', `${name} registered as the observability pipeline`)
			await loadData()
		} catch (err) {
			showError('Setup Failed', err instanceof Error ? err.message : 'Failed to register pipeline')
		} finally {
			setSetupSubmitting(false)
		}
	}

	const handleSaveCollectionConfig = async () => {
		setSavingConfig(true)
		try {
			const result = await observabilityApi.updateConfig({
				collection: {
					logs: {
						podLogs: defaultPodLogs,
						journald: defaultJournald,
						kubernetesEvents: defaultK8sEvents,
					},
					metrics: {
						enabled: true,
						retention: defaultRetention,
					},
				},
			})
			setConfig(result)
			success('Settings Saved', 'Collection configuration updated')
		} catch (err) {
			showError('Save Failed', err instanceof Error ? err.message : 'Failed to save settings')
		} finally {
			setSavingConfig(false)
		}
	}

	const handleDeregisterPipeline = async () => {
		if (!confirm('Deregister the observability pipeline? This will not delete any clusters or addons.')) return
		setDeregistering(true)
		try {
			const result = await observabilityApi.deregisterPipeline()
			setConfig(result)
			setStatus(null)
			success('Pipeline Deregistered', 'Observability pipeline has been deregistered')
		} catch (err) {
			showError('Deregister Failed', err instanceof Error ? err.message : 'Failed to deregister pipeline')
		} finally {
			setDeregistering(false)
		}
	}

	const handleStartEditPipeline = () => {
		setEditLogEndpoint(config?.pipeline?.logEndpoint || '')
		setEditMetricEndpoint(config?.pipeline?.metricEndpoint || '')
		setEditTraceEndpoint(config?.pipeline?.traceEndpoint || '')
		setEditingPipeline(true)
	}

	const handleSavePipelineEdit = async () => {
		if (!editLogEndpoint) {
			showError('Validation Error', 'Log endpoint is required')
			return
		}
		setEditSubmitting(true)
		try {
			const result = await observabilityApi.updateConfig({
				pipeline: {
					clusterName: config?.pipeline?.clusterName,
					clusterNamespace: config?.pipeline?.clusterNamespace,
					logEndpoint: editLogEndpoint,
					metricEndpoint: editMetricEndpoint || undefined,
					traceEndpoint: editTraceEndpoint || undefined,
				},
			})
			setConfig(result)
			setEditingPipeline(false)
			success('Pipeline Updated', 'Pipeline endpoints updated')
			await loadData()
		} catch (err) {
			showError('Update Failed', err instanceof Error ? err.message : 'Failed to update pipeline')
		} finally {
			setEditSubmitting(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (serverUnavailable) {
		return (
			<FadeIn>
				<div className="space-y-6">
					<h1 className="text-2xl font-bold text-neutral-100">Observability</h1>
					<div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-6">
						<h3 className="text-lg font-medium text-amber-400 mb-2">Server Update Required</h3>
						<p className="text-sm text-amber-300/80">
							Butler Server needs to be updated to support observability features.
						</p>
					</div>
				</div>
			</FadeIn>
		)
	}

	const isConfigured = config?.configured ?? false

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-neutral-100">Observability</h1>
					{isConfigured && (
						<Button variant="ghost" onClick={loadData}>
							Refresh
						</Button>
					)}
				</div>

				{!isConfigured ? (
					<div className="space-y-6">
						{/* Hero — animated pipeline diagram */}
						<div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-8">
							<div className="text-center mb-8">
								<h2 className="text-xl font-semibold text-neutral-100 mb-3">
									Centralized Observability Pipeline
								</h2>
								<p className="text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed">
									Deploy lightweight agents on your tenant clusters to collect metrics, logs, and traces.
									Signals flow to a central aggregator where they&apos;re buffered, transformed, and routed
									to your preferred storage backends — then query everything through Grafana.
								</p>
							</div>
							<PipelineDiagram />
						</div>

						{/* Setup form */}
						<Card>
							<div className="p-6">
								<h2 className="text-lg font-medium text-neutral-100 mb-2">Register Pipeline</h2>
								<p className="text-sm text-neutral-400 mb-6">
									Select or create a cluster to host your pipeline, then configure the endpoints
									where agents will send data.
								</p>

								<div className="space-y-4 max-w-lg">
									<div>
										<label className="block text-sm font-medium text-neutral-300 mb-1">
											Pipeline Cluster
										</label>
										<select
											value={selectedCluster}
											onChange={(e) => setSelectedCluster(e.target.value)}
											className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/40"
										>
											<option value="">Select a cluster...</option>
											{clusters.map((c) => (
												<option key={`${c.metadata.namespace}/${c.metadata.name}`} value={`${c.metadata.namespace}/${c.metadata.name}`}>
													{c.metadata.namespace}/{c.metadata.name} ({c.status?.phase || 'Unknown'})
												</option>
											))}
										</select>
										<div className="flex items-center gap-2 mt-2">
											<span className="text-xs text-neutral-500">or</span>
											<Link
												to="/clusters/create?returnTo=/admin/observability"
												className="text-xs text-green-400 hover:text-green-300"
											>
												Create a new cluster
											</Link>
										</div>
										{selectedCluster && selectedClusterPhase && selectedClusterPhase !== 'Ready' && (
											<div className="flex items-center gap-2 mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
												<Spinner size="sm" />
												<span className="text-xs text-amber-400">
													Cluster is {selectedClusterPhase} — waiting for Ready...
												</span>
											</div>
										)}
									</div>

									<div>
										<label className="block text-sm font-medium text-neutral-300 mb-1">
											Log Ingestion Endpoint
										</label>
										<Input
											value={logEndpoint}
											onChange={(e) => setLogEndpoint(e.target.value)}
											placeholder="http://vector-aggregator.vector.svc:8080"
										/>
										<p className="mt-1 text-xs text-neutral-500">
											Where tenant Vector agents send logs. Typically the aggregator&apos;s HTTP source
											address (Vector, Fluentd) or a log store API (Loki, Elastic).
										</p>
									</div>

									<div>
										<label className="block text-sm font-medium text-neutral-300 mb-1">
											Metric Remote-Write Endpoint <span className="text-neutral-600 font-normal">(optional)</span>
										</label>
										<Input
											value={metricEndpoint}
											onChange={(e) => setMetricEndpoint(e.target.value)}
											placeholder="http://victoria-metrics.monitoring.svc:8428/api/v1/write"
										/>
										<p className="mt-1 text-xs text-neutral-500">
											Prometheus remote-write URL. Tenant Prometheus instances forward metrics here
											(VictoriaMetrics, Mimir, Cortex, or another Prometheus).
										</p>
									</div>

									<div>
										<label className="block text-sm font-medium text-neutral-300 mb-1">
											Trace OTLP Endpoint <span className="text-neutral-600 font-normal">(optional)</span>
										</label>
										<Input
											value={traceEndpoint}
											onChange={(e) => setTraceEndpoint(e.target.value)}
											placeholder="tempo.tracing.svc:4317"
										/>
										<p className="mt-1 text-xs text-neutral-500">
											OTLP gRPC endpoint for traces. OTEL Collectors on tenant clusters forward traces here
											(Tempo, Jaeger, or another OTLP-compatible backend).
										</p>
									</div>

									<Button onClick={handleSetupPipeline} disabled={setupSubmitting || (!!selectedClusterPhase && selectedClusterPhase !== 'Ready')}>
										{setupSubmitting ? 'Registering...' : 'Register Pipeline'}
									</Button>
								</div>
							</div>
						</Card>
					</div>
				) : (
					// Configured — Live status
					<div className="space-y-6">
						{/* Pipeline architecture diagram (collapsible) */}
						<div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
							<button
								onClick={() => setShowDiagram(!showDiagram)}
								className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-800/30 transition-colors"
							>
								<div>
									<h2 className="text-sm font-medium text-neutral-300">Pipeline Architecture</h2>
									<p className="text-xs text-neutral-500 mt-0.5">How data flows from your clusters to storage and dashboards</p>
								</div>
								<svg
									className={`w-4 h-4 text-neutral-500 transition-transform ${showDiagram ? 'rotate-180' : ''}`}
									fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
							{showDiagram && (
								<div className="px-6 pb-6">
									<PipelineDiagram />
								</div>
							)}
						</div>

						{/* Pipeline status */}
						{status?.pipeline && (
							<Card>
								<div className="p-6">
									<div className="flex items-center justify-between mb-4">
										<h2 className="text-lg font-medium text-neutral-100">Pipeline</h2>
										<div className="flex items-center gap-3">
											<StatusBadge status={status.pipeline.clusterPhase} />
											{!editingPipeline && (
												<Button
													variant="ghost"
													size="sm"
													onClick={handleStartEditPipeline}
												>
													Edit
												</Button>
											)}
											<Button
												variant="ghost"
												size="sm"
												onClick={handleDeregisterPipeline}
												disabled={deregistering}
												className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
											>
												{deregistering ? 'Deregistering...' : 'Deregister'}
											</Button>
										</div>
									</div>
									{editingPipeline ? (
										<div className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<label className="block text-xs text-neutral-500 mb-1">Cluster</label>
													<p className="text-sm text-neutral-200">{status.pipeline.clusterNamespace}/{status.pipeline.clusterName}</p>
												</div>
												<div>
													<label className="block text-xs text-neutral-500 mb-1">Aggregator</label>
													<StatusBadge status={status.pipeline.aggregatorStatus || 'Unknown'} />
												</div>
											</div>
											<div>
												<label className="block text-xs text-neutral-500 mb-1">Log Endpoint</label>
												<Input
													value={editLogEndpoint}
													onChange={(e) => setEditLogEndpoint(e.target.value)}
													placeholder="http://vector-aggregator:8080"
												/>
											</div>
											<div>
												<label className="block text-xs text-neutral-500 mb-1">
													Metric Remote-Write Endpoint <span className="text-neutral-600">(optional)</span>
												</label>
												<Input
													value={editMetricEndpoint}
													onChange={(e) => setEditMetricEndpoint(e.target.value)}
													placeholder="http://victoria-metrics:8428/api/v1/write"
												/>
											</div>
											<div>
												<label className="block text-xs text-neutral-500 mb-1">
													Trace OTLP Endpoint <span className="text-neutral-600">(optional)</span>
												</label>
												<Input
													value={editTraceEndpoint}
													onChange={(e) => setEditTraceEndpoint(e.target.value)}
													placeholder="tempo.tracing.svc:4317"
												/>
											</div>
											<div className="flex justify-end gap-2 pt-2">
												<Button variant="ghost" size="sm" onClick={() => setEditingPipeline(false)} disabled={editSubmitting}>
													Cancel
												</Button>
												<Button size="sm" onClick={handleSavePipelineEdit} disabled={editSubmitting}>
													{editSubmitting ? 'Saving...' : 'Save'}
												</Button>
											</div>
										</div>
									) : (
										<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
											<div>
												<p className="text-neutral-500">Cluster</p>
												<Link
													to={`/admin/clusters/${status.pipeline.clusterNamespace}/${status.pipeline.clusterName}`}
													className="text-green-400 hover:text-green-300"
												>
													{status.pipeline.clusterName}
												</Link>
											</div>
											<div>
												<p className="text-neutral-500">Aggregator</p>
												<StatusBadge status={status.pipeline.aggregatorStatus || 'Unknown'} />
											</div>
											<div>
												<p className="text-neutral-500">Namespace</p>
												<p className="text-neutral-200">{status.pipeline.clusterNamespace}</p>
											</div>
											<div>
												<p className="text-neutral-500">Log Endpoint</p>
												<p className="text-neutral-200 font-mono text-xs">{status.pipeline.logEndpoint}</p>
											</div>
											<div>
												<p className="text-neutral-500">Metric Endpoint</p>
												<p className="text-neutral-200 font-mono text-xs">{config?.pipeline?.metricEndpoint || <span className="text-neutral-600">—</span>}</p>
											</div>
											<div>
												<p className="text-neutral-500">Trace Endpoint</p>
												<p className="text-neutral-200 font-mono text-xs">{config?.pipeline?.traceEndpoint || <span className="text-neutral-600">—</span>}</p>
											</div>
										</div>
									)}
								</div>
							</Card>
						)}

						{/* Summary cards */}
						{status && (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<Card>
									<div className="p-4 text-center">
										<p className="text-2xl font-bold text-neutral-100">{status.summary.totalClusters}</p>
										<p className="text-xs text-neutral-500 mt-1">Total Clusters</p>
									</div>
								</Card>
								<Card>
									<div className="p-4 text-center">
										<p className="text-2xl font-bold text-green-400">{status.summary.enrolledClusters}</p>
										<p className="text-xs text-neutral-500 mt-1">Enrolled</p>
									</div>
								</Card>
								<Card>
									<div className="p-4 text-center">
										<p className="text-2xl font-bold text-blue-400">{status.summary.vectorAgentCount}</p>
										<p className="text-xs text-neutral-500 mt-1">Vector Agents</p>
									</div>
								</Card>
								<Card>
									<div className="p-4 text-center">
										<p className="text-2xl font-bold text-orange-400">{status.summary.prometheusCount}</p>
										<p className="text-xs text-neutral-500 mt-1">Prometheus</p>
									</div>
								</Card>
								<Card>
									<div className="p-4 text-center">
										<p className="text-2xl font-bold text-amber-400">{status.summary.otelCollectorCount}</p>
										<p className="text-xs text-neutral-500 mt-1">OTEL Collectors</p>
									</div>
								</Card>
							</div>
						)}

						{/* Collection defaults */}
						<Card>
							<div className="p-6">
								<h2 className="text-lg font-medium text-neutral-100 mb-1">Collection Defaults</h2>
								<p className="text-xs text-neutral-500 mb-5">
									Pre-filled when enabling log or metric collection on individual clusters.
								</p>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<h3 className="text-sm font-medium text-neutral-300 mb-3">Log Sources</h3>
										<div className="space-y-2">
											<label className="flex items-center gap-2 text-sm text-neutral-300">
												<input
													type="checkbox"
													checked={defaultPodLogs}
													onChange={(e) => setDefaultPodLogs(e.target.checked)}
													className="rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
												/>
												Pod logs
											</label>
											<label className="flex items-center gap-2 text-sm text-neutral-300">
												<input
													type="checkbox"
													checked={defaultJournald}
													onChange={(e) => setDefaultJournald(e.target.checked)}
													className="rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
												/>
												Systemd journal
											</label>
											<label className="flex items-center gap-2 text-sm text-neutral-300">
												<input
													type="checkbox"
													checked={defaultK8sEvents}
													onChange={(e) => setDefaultK8sEvents(e.target.checked)}
													className="rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
												/>
												Kubernetes events
											</label>
										</div>
									</div>
									<div>
										<h3 className="text-sm font-medium text-neutral-300 mb-3">Metrics</h3>
										<div>
											<label className="block text-xs text-neutral-400 mb-1">Local Retention</label>
											<Input
												value={defaultRetention}
												onChange={(e) => setDefaultRetention(e.target.value)}
												placeholder="e.g., 2h"
												className="max-w-[140px]"
											/>
											<p className="mt-1 text-xs text-neutral-500">
												Buffer period before forwarding via remote-write.
											</p>
										</div>
									</div>
								</div>
								<div className="mt-5">
									<Button
										size="sm"
										onClick={handleSaveCollectionConfig}
										disabled={savingConfig}
									>
										{savingConfig ? 'Saving...' : 'Save Defaults'}
									</Button>
								</div>
							</div>
						</Card>

						{/* Fleet table */}
						{status && status.clusters.length > 0 && (
							<Card>
								<div className="p-6">
									<h2 className="text-lg font-medium text-neutral-100 mb-4">Clusters</h2>
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="text-left text-neutral-500 border-b border-neutral-800">
													<th className="pb-2 font-medium">Name</th>
													<th className="pb-2 font-medium">Team</th>
													<th className="pb-2 font-medium">Phase</th>
													<th className="pb-2 font-medium">Vector Agent</th>
													<th className="pb-2 font-medium">Prometheus</th>
													<th className="pb-2 font-medium">OTEL</th>
													<th className="pb-2 font-medium"></th>
												</tr>
											</thead>
											<tbody className="divide-y divide-neutral-800">
												{status.clusters.map((c: ClusterObsInfo) => (
													<tr key={`${c.namespace}/${c.name}`} className="text-neutral-300">
														<td className="py-2">
															<Link
																to={`/admin/clusters/${c.namespace}/${c.name}?tab=observability`}
																className="text-green-400 hover:text-green-300"
															>
																{c.name}
															</Link>
														</td>
														<td className="py-2">{c.team || '-'}</td>
														<td className="py-2"><StatusBadge status={c.phase} /></td>
														<td className="py-2">
															{c.vectorAgent ? (
																<StatusBadge status={c.vectorAgent.status} />
															) : (
																<span className="text-neutral-600">-</span>
															)}
														</td>
														<td className="py-2">
															{c.prometheus ? (
																<StatusBadge status={c.prometheus.status} />
															) : (
																<span className="text-neutral-600">-</span>
															)}
														</td>
														<td className="py-2">
															{c.otelCollector ? (
																<StatusBadge status={c.otelCollector.status} />
															) : (
																<span className="text-neutral-600">-</span>
															)}
														</td>
														<td className="py-2 text-right">
															<Link
																to={`/admin/clusters/${c.namespace}/${c.name}?tab=observability`}
																className="text-xs text-neutral-500 hover:text-neutral-300"
															>
																Configure
															</Link>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							</Card>
						)}
					</div>
				)}
			</div>
		</FadeIn>
	)
}
