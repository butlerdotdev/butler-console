// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { observabilityApi } from '@/api/observability'
import { addonsApi } from '@/api/addons'
import { useToast } from '@/hooks/useToast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Spinner } from '@/components/ui/Spinner'
import { EnableLogCollectionModal } from './EnableLogCollectionModal'
import { EnableMetricsModal } from './EnableMetricsModal'
import { EnableTracingModal } from './EnableTracingModal'
import { TenantPipelineDiagram } from './TenantPipelineDiagram'
import type { ObservabilityConfig } from '@/types/observability'

interface SimpleAddon {
  name: string
  status: string
  version?: string
}

interface ObservabilityTabProps {
  clusterNamespace: string
  clusterName: string
  addons: SimpleAddon[]
  onRefresh: () => void
}

export function ObservabilityTab({ clusterNamespace, clusterName, addons, onRefresh }: ObservabilityTabProps) {
  const { success, error: showError } = useToast()
  const [config, setConfig] = useState<ObservabilityConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [serverUnavailable, setServerUnavailable] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [showMetricsModal, setShowMetricsModal] = useState(false)
  const [showTracingModal, setShowTracingModal] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const cfg = await observabilityApi.getConfig()
      setConfig(cfg)
      setServerUnavailable(false)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        setServerUnavailable(true)
      }
    } finally {
      setConfigLoading(false)
    }
  }

  const vectorAgent = addons.find(a => {
    const n = a.name.toLowerCase()
    return n === 'vector-agent' || n.startsWith('vector-agent-')
  })
  const prometheus = addons.find(a => {
    const n = a.name.toLowerCase()
    return n === 'prometheus-operator' || n.startsWith('prometheus-operator-') ||
      n === 'kube-prometheus-stack' || n.startsWith('kube-prometheus-stack-')
  })
  const otelCollector = addons.find(a => {
    const n = a.name.toLowerCase()
    return n === 'otel-collector' || n.startsWith('otel-collector-')
  })

  const handleInstallLogCollection = async (values: Record<string, unknown>) => {
    try {
      await addonsApi.install(clusterNamespace, clusterName, {
        addon: 'vector-agent',
        values,
      })
      success('Enabled', 'Log collection enabled')
      onRefresh()
    } catch {
      showError('Failed', 'Failed to enable log collection')
    }
  }

  const handleInstallMetrics = async (values: Record<string, unknown>) => {
    try {
      await addonsApi.install(clusterNamespace, clusterName, {
        addon: 'prometheus-operator',
        values,
      })
      success('Enabled', 'Metrics collection enabled')
      onRefresh()
    } catch {
      showError('Failed', 'Failed to enable metrics collection')
    }
  }

  const handleInstallTracing = async (values: Record<string, unknown>) => {
    try {
      await addonsApi.install(clusterNamespace, clusterName, {
        addon: 'otel-collector',
        values,
      })
      success('Enabled', 'Trace collection enabled')
      onRefresh()
    } catch {
      showError('Failed', 'Failed to enable trace collection')
    }
  }

  const handleUninstall = async (addonName: string) => {
    try {
      await addonsApi.uninstall(clusterNamespace, clusterName, addonName)
      success('Removed', `${addonName} removed`)
      onRefresh()
    } catch {
      showError('Failed', `Failed to remove ${addonName}`)
    }
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (serverUnavailable) {
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
        <p className="text-sm text-amber-400">
          Butler Server needs to be updated to support observability features.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pipeline info banner */}
      {config?.configured && config.pipeline && (
        <div className="rounded-lg bg-neutral-800/50 border border-neutral-700 p-4">
          <p className="text-sm text-neutral-300">
            Platform pipeline: <span className="text-neutral-100 font-medium">{config.pipeline.clusterNamespace}/{config.pipeline.clusterName}</span>
            {config.pipeline.logEndpoint && (
              <span className="text-neutral-500 ml-2">({config.pipeline.logEndpoint})</span>
            )}
          </p>
        </div>
      )}

      {/* Pipeline flow diagram */}
      <Card>
        <div className="p-4">
          <TenantPipelineDiagram
            config={config}
            hasLogs={!!vectorAgent}
            hasMetrics={!!prometheus}
            hasTracing={!!otelCollector}
          />
        </div>
      </Card>

      {/* Addon status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Vector Agent card */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-100">Log Collection</h3>
              {vectorAgent && <StatusBadge status={vectorAgent.status} />}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Vector Agent collects logs from pods and system journals and ships them to the aggregator.
            </p>
            {vectorAgent ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {vectorAgent.version && `v${vectorAgent.version}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUninstall(vectorAgent.name)}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowLogModal(true)}>
                Enable
              </Button>
            )}
          </div>
        </Card>

        {/* Prometheus card */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-100">Metrics Collection</h3>
              {prometheus && <StatusBadge status={prometheus.status} />}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Prometheus collects cluster metrics and forwards them to your observability pipeline.
            </p>
            {prometheus ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {prometheus.version && `v${prometheus.version}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUninstall(prometheus.name)}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowMetricsModal(true)}>
                Enable
              </Button>
            )}
          </div>
        </Card>

        {/* OTEL Collector card */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-100">Trace Collection</h3>
              {otelCollector && <StatusBadge status={otelCollector.status} />}
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              OpenTelemetry Collector receives traces via OTLP and exports them to your tracing backend.
            </p>
            {otelCollector ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {otelCollector.version && `v${otelCollector.version}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUninstall(otelCollector.name)}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowTracingModal(true)}>
                Enable
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Modals */}
      <EnableLogCollectionModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onConfirm={handleInstallLogCollection}
        config={config ?? undefined}
        clusterName={clusterName}
      />
      <EnableMetricsModal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        onConfirm={handleInstallMetrics}
        config={config ?? undefined}
        clusterName={clusterName}
      />
      <EnableTracingModal
        isOpen={showTracingModal}
        clusterName={clusterName}
        onClose={() => setShowTracingModal(false)}
        onConfirm={handleInstallTracing}
        config={config ?? undefined}
      />
    </div>
  )
}
