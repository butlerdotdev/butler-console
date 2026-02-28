// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export interface ObservabilityConfig {
  configured: boolean
  pipeline?: PipelineConfigInfo
  collection?: CollectionConfigInfo
}

export interface PipelineConfigInfo {
  clusterName?: string
  clusterNamespace?: string
  logEndpoint?: string
  metricEndpoint?: string
  traceEndpoint?: string
}

export interface AutoEnrollConfig {
  vectorAgent?: boolean
  prometheus?: boolean
  otelCollector?: boolean
}

export interface CollectionConfigInfo {
  autoEnroll?: AutoEnrollConfig
  logs?: LogCollectionInfo
  metrics?: MetricCollectionInfo
}

export interface LogCollectionInfo {
  podLogs?: boolean
  journald?: boolean
  kubernetesEvents?: boolean
}

export interface MetricCollectionInfo {
  enabled?: boolean
  retention?: string
}

export interface ObservabilityStatus {
  pipeline?: PipelineStatusInfo
  clusters: ClusterObsInfo[]
  summary: ObservabilitySummary
}

export interface PipelineStatusInfo {
  clusterName: string
  clusterNamespace: string
  clusterPhase: string
  logEndpoint: string
  aggregatorStatus?: string
}

export interface ClusterObsInfo {
  name: string
  namespace: string
  team: string
  phase: string
  vectorAgent?: { status: string; version?: string }
  prometheus?: { status: string; version?: string }
  otelCollector?: { status: string; version?: string }
}

export interface ObservabilitySummary {
  totalClusters: number
  enrolledClusters: number
  vectorAgentCount: number
  prometheusCount: number
  otelCollectorCount: number
}

export interface UpdateObservabilityConfigRequest {
  pipeline?: PipelineConfigInfo
  collection?: CollectionConfigInfo
}

export interface SetupPipelineRequest {
  clusterName: string
  clusterNamespace: string
  logEndpoint: string
  metricEndpoint?: string
  traceEndpoint?: string
}
