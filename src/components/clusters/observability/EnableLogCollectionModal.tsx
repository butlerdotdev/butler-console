// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ObservabilityConfig } from '@/types/observability'

interface EnableLogCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (values: Record<string, unknown>) => Promise<void>
  config?: ObservabilityConfig
  clusterName: string
}

export function EnableLogCollectionModal({ isOpen, onClose, onConfirm, config, clusterName }: EnableLogCollectionModalProps) {
  const [aggregatorEndpoint, setAggregatorEndpoint] = useState(
    config?.pipeline?.logEndpoint || ''
  )
  const [podLogs, setPodLogs] = useState(config?.collection?.logs?.podLogs ?? true)
  const [journald, setJournald] = useState(config?.collection?.logs?.journald ?? false)
  const [kubernetesEvents, setKubernetesEvents] = useState(config?.collection?.logs?.kubernetesEvents ?? false)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const sources: Record<string, unknown> = {}
      if (podLogs) {
        sources.kubernetes_logs = { type: 'kubernetes_logs' }
      }
      if (journald) {
        sources.journald = { type: 'journald' }
      }
      if (kubernetesEvents) {
        sources.internal_metrics = { type: 'internal_metrics' }
      }

      // Add a transform to tag every event with the cluster name
      const sourceNames = Object.keys(sources)
      const transforms: Record<string, unknown> = {
        add_cluster: {
          type: 'remap',
          inputs: sourceNames,
          source: `.cluster = "${clusterName}"`,
        },
      }

      const sinks: Record<string, unknown> = {}
      if (aggregatorEndpoint) {
        sinks.aggregator = {
          type: 'http',
          inputs: ['add_cluster'],
          uri: aggregatorEndpoint,
          encoding: { codec: 'json' },
        }
      } else {
        sinks.stdout = {
          type: 'console',
          inputs: ['add_cluster'],
          encoding: { codec: 'json' },
        }
      }

      await onConfirm({
        role: 'Agent',
        customConfig: {
          data_dir: '/vector-data-dir',
          api: { enabled: true, address: '127.0.0.1:8686', playground: false },
          sources,
          transforms,
          sinks,
        },
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader><h2 className="text-lg font-medium text-neutral-100">Enable Log Collection</h2></ModalHeader>
      <ModalBody>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            Aggregator Endpoint
          </label>
          <Input
            value={aggregatorEndpoint}
            onChange={(e) => setAggregatorEndpoint(e.target.value)}
            placeholder="e.g., vector-aggregator.vector.svc:6000"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {config?.configured
              ? 'Pre-filled from platform pipeline configuration.'
              : 'Enter the Vector aggregator address. Leave empty for local console output.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-3">
            Log Sources
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={podLogs}
                onChange={(e) => setPodLogs(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
              />
              Pod logs (container stdout/stderr)
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={journald}
                onChange={(e) => setJournald(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
              />
              Systemd journal logs
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={kubernetesEvents}
                onChange={(e) => setKubernetesEvents(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
              />
              Kubernetes events
            </label>
          </div>
        </div>

        <div className="rounded-lg bg-neutral-800/50 border border-neutral-700 p-3">
          <p className="text-xs text-neutral-400">
            These defaults provide a working starting point for log collection. For production workloads,
            review the Vector agent configuration — including buffer sizing, filtering, resource limits,
            and sink authentication — with the same rigor you would apply to any critical infrastructure component.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Installing...' : 'Enable Log Collection'}
          </Button>
        </div>
      </div>
      </ModalBody>
    </Modal>
  )
}
