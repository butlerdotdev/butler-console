// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ObservabilityConfig } from '@/types/observability'

interface EnableTracingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (values: Record<string, unknown>) => Promise<void>
  config?: ObservabilityConfig
  clusterName: string
}

export function EnableTracingModal({ isOpen, onClose, onConfirm, config, clusterName }: EnableTracingModalProps) {
  const [traceEndpoint, setTraceEndpoint] = useState(
    config?.pipeline?.traceEndpoint || ''
  )
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      // Detect whether the endpoint looks like HTTP or gRPC
      const isHttpEndpoint = traceEndpoint.startsWith('http://') || traceEndpoint.startsWith('https://')

      let exporterConfig: Record<string, unknown>
      let exporterName: string

      if (!traceEndpoint) {
        exporterConfig = { debug: { verbosity: 'detailed' } }
        exporterName = 'debug'
      } else if (isHttpEndpoint) {
        exporterConfig = { otlphttp: { endpoint: traceEndpoint } }
        exporterName = 'otlphttp'
      } else {
        exporterConfig = { otlp: { endpoint: traceEndpoint, tls: { insecure: true } } }
        exporterName = 'otlp'
      }

      await onConfirm({
        mode: 'daemonset',
        image: {
          repository: 'otel/opentelemetry-collector-contrib',
        },
        presets: {
          kubernetesAttributes: { enabled: true },
        },
        config: {
          receivers: {
            otlp: {
              protocols: {
                grpc: { endpoint: '0.0.0.0:4317' },
                http: { endpoint: '0.0.0.0:4318' },
              },
            },
          },
          processors: {
            resource: {
              attributes: [
                { key: 'k8s.cluster.name', value: clusterName, action: 'upsert' },
              ],
            },
            batch: { timeout: '5s', send_batch_size: 1024 },
            memory_limiter: { check_interval: '5s', limit_mib: 256 },
          },
          exporters: exporterConfig,
          service: {
            pipelines: {
              traces: {
                receivers: ['otlp'],
                processors: ['memory_limiter', 'resource', 'batch'],
                exporters: [exporterName],
              },
            },
          },
        },
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader><h2 className="text-lg font-medium text-neutral-100">Enable Trace Collection</h2></ModalHeader>
      <ModalBody>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            OTLP Export Endpoint
          </label>
          <Input
            value={traceEndpoint}
            onChange={(e) => setTraceEndpoint(e.target.value)}
            placeholder="e.g., http://tempo:4318 or tempo:4317"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {config?.configured
              ? 'Pre-filled from platform pipeline configuration.'
              : 'HTTP endpoints (http://host:4318) use OTLP/HTTP. Plain host:port uses OTLP/gRPC. Leave empty for debug output.'}
          </p>
        </div>

        <div className="rounded-lg bg-neutral-800/50 border border-neutral-700 p-3">
          <p className="text-xs text-neutral-400">
            Installs the OpenTelemetry Collector as a DaemonSet. Applications send traces via OTLP
            (gRPC :4317 or HTTP :4318) and the collector forwards them to your tracing backend.
          </p>
          <p className="text-xs text-neutral-400 mt-2">
            These defaults provide a working starting point. For production workloads, review sampling rates,
            resource limits, batch sizing, TLS configuration, and exporter authentication with the same
            rigor you would apply to any critical infrastructure component.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Installing...' : 'Enable Tracing'}
          </Button>
        </div>
      </div>
      </ModalBody>
    </Modal>
  )
}
