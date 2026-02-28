// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ObservabilityConfig } from '@/types/observability'

interface EnableMetricsModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (values: Record<string, unknown>) => Promise<void>
  config?: ObservabilityConfig
  clusterName: string
}

export function EnableMetricsModal({ isOpen, onClose, onConfirm, config, clusterName }: EnableMetricsModalProps) {
  const [metricEndpoint, setMetricEndpoint] = useState(
    config?.pipeline?.metricEndpoint || ''
  )
  const [retention, setRetention] = useState('2h')
  const [storageSize, setStorageSize] = useState('10Gi')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const values: Record<string, unknown> = {
        grafana: { enabled: false },
        alertmanager: { enabled: false },
        prometheus: {
          prometheusSpec: {
            retention,
            externalLabels: { cluster: clusterName },
            serviceMonitorNamespaceSelector: {},
            podMonitorNamespaceSelector: {},
            serviceMonitorSelector: {},
            podMonitorSelector: {},
            storageSpec: {
              volumeClaimTemplate: {
                spec: {
                  accessModes: ['ReadWriteOnce'],
                  resources: { requests: { storage: storageSize } },
                },
              },
            },
            ...(metricEndpoint
              ? { remoteWrite: [{ url: metricEndpoint }] }
              : {}),
          },
        },
      }

      await onConfirm(values)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader><h2 className="text-lg font-medium text-neutral-100">Enable Metrics Collection</h2></ModalHeader>
      <ModalBody>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            Remote Write Endpoint
          </label>
          <Input
            value={metricEndpoint}
            onChange={(e) => setMetricEndpoint(e.target.value)}
            placeholder="e.g., http://victoria-metrics.monitoring.svc:8428/api/v1/write"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {config?.configured
              ? 'Pre-filled from platform pipeline configuration.'
              : 'Enter the Prometheus remote-write URL for your metrics pipeline.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            Local Retention
          </label>
          <Input
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            placeholder="e.g., 2h"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Buffer period before data is forwarded. Keep short when using remote-write.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            WAL Storage Size
          </label>
          <Input
            value={storageSize}
            onChange={(e) => setStorageSize(e.target.value)}
            placeholder="e.g., 10Gi"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Persistent volume for the write-ahead log. 10Gi is typically sufficient for forwarding.
          </p>
        </div>

        <div className="rounded-lg bg-neutral-800/50 border border-neutral-700 p-3">
          <p className="text-xs text-neutral-400">
            Installs Prometheus Operator with node-exporter and kube-state-metrics for scraping.
            Grafana and Alertmanager are disabled — metrics are forwarded to your pipeline.
          </p>
          <p className="text-xs text-neutral-400 mt-2">
            These defaults provide a working starting point. For production workloads, review scrape intervals,
            resource limits, retention policies, remote-write tuning, and alerting configuration with the same
            rigor you would apply to any critical infrastructure component.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Installing...' : 'Enable Metrics'}
          </Button>
        </div>
      </div>
      </ModalBody>
    </Modal>
  )
}
