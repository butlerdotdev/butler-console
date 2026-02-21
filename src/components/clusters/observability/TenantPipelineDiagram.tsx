// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Per-tenant pipeline flow visualization using the same visual language as the
// platform PipelineDiagram. A single "This Cluster" source fans out through
// collectors to their respective backends. Active signals have color-coded
// particles; inactive signals are dimmed.

import type { ObservabilityConfig } from '@/types/observability'

const W = 920
const H = 300

// Node dimensions (matching main diagram)
const NW = 155, NH = 56
const SRC_W = 140, SRC_H = 130

// X positions (4 columns)
const SRC_X = 10
const COL_X = 240
const FWD_X = 480
const DST_X = 720

// Y positions (3 rows)
const ROW_Y = [42, 122, 202]
const SRC_Y = 85

const COLORS: Record<string, string> = {
  logs: '#4ade80',
  metrics: '#60a5fa',
  traces: '#fbbf24',
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cpx = (x1 + x2) / 2
  return `M ${x1},${y1} C ${cpx},${y1} ${cpx},${y2} ${x2},${y2}`
}

function DataParticles({ path, color, count, dur }: { path: string; color: string; count: number; dur: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const delay = i * dur / count
        return (
          <circle key={i} r="2.5" fill={color} cx="0" cy="0">
            <animate attributeName="opacity" values="0;0.85;0.85;0" dur={`${dur}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" />
            <animateMotion dur={`${dur}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" path={path} />
          </circle>
        )
      })}
    </>
  )
}

function truncateLabel(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '\u2026'
}

interface Signal {
  key: string
  label: string
  sub: string
  color: string
  collector: string
  collectorSub: string
  enabled: boolean
  destination: string
  destinationSub: string
}

interface TenantPipelineDiagramProps {
  config?: ObservabilityConfig | null
  hasLogs: boolean
  hasMetrics: boolean
  hasTracing: boolean
}

export function TenantPipelineDiagram({ config, hasLogs, hasMetrics, hasTracing }: TenantPipelineDiagramProps) {
  const pipeline = config?.pipeline
  const anyEnabled = hasLogs || hasMetrics || hasTracing

  const signals: Signal[] = [
    {
      key: 'logs',
      label: 'Logs',
      sub: 'Pod stdout · Journald',
      color: COLORS.logs,
      collector: 'Vector Agent',
      collectorSub: 'DaemonSet',
      enabled: hasLogs,
      destination: pipeline?.logEndpoint ? truncateLabel(pipeline.logEndpoint, 20) : 'Aggregator',
      destinationSub: pipeline?.logEndpoint ? 'Log Pipeline' : 'Not configured',
    },
    {
      key: 'metrics',
      label: 'Metrics',
      sub: 'Scrape · ServiceMonitor',
      color: COLORS.metrics,
      collector: 'Prometheus',
      collectorSub: 'kube-prometheus-stack',
      enabled: hasMetrics,
      destination: pipeline?.metricEndpoint ? truncateLabel(pipeline.metricEndpoint, 20) : 'Remote Write',
      destinationSub: pipeline?.metricEndpoint ? 'Metric Pipeline' : 'Not configured',
    },
    {
      key: 'traces',
      label: 'Traces',
      sub: 'OTLP gRPC · HTTP',
      color: COLORS.traces,
      collector: 'OTEL Collector',
      collectorSub: 'DaemonSet',
      enabled: hasTracing,
      destination: pipeline?.traceEndpoint ? truncateLabel(pipeline.traceEndpoint, 20) : 'Tracing Backend',
      destinationSub: pipeline?.traceEndpoint ? 'Trace Pipeline' : 'Not configured',
    },
  ]

  // Build paths: source → collectors (fan-out), collectors → forwarding, forwarding → destinations
  const srcCY = SRC_Y + SRC_H / 2
  const fanPaths = signals.map((_, i) => bezier(SRC_X + SRC_W, srcCY, COL_X, ROW_Y[i] + NH / 2))
  const fwdPaths = signals.map((_, i) => bezier(COL_X + NW, ROW_Y[i] + NH / 2, FWD_X, ROW_Y[i] + NH / 2))
  const dstPaths = signals.map((_, i) => bezier(FWD_X + NW, ROW_Y[i] + NH / 2, DST_X, ROW_Y[i] + NH / 2))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="tp-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
        </filter>
        <filter id="tp-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#4ade80" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Column labels */}
      <text x={SRC_X + SRC_W / 2} y={SRC_Y - 10} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">THIS CLUSTER</text>
      <text x={COL_X + NW / 2} y={24} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">COLLECTORS</text>
      <text x={FWD_X + NW / 2} y={24} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">PIPELINE</text>
      <text x={DST_X + NW / 2} y={24} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">DESTINATIONS</text>

      {/* All flow paths (draw behind everything) */}
      {signals.map((s, i) => (
        <g key={`paths-${s.key}`} opacity={s.enabled ? 1 : 0.2}>
          <path d={fanPaths[i]} stroke="#1f1f1f" strokeWidth="1" fill="none" />
          <path d={fwdPaths[i]} stroke="#1f1f1f" strokeWidth="1" fill="none" />
          <path d={dstPaths[i]} stroke="#1f1f1f" strokeWidth="1" fill="none" />
        </g>
      ))}

      {/* Animated particles on active paths */}
      {signals.map((s, i) => s.enabled && (
        <g key={`particles-${s.key}`}>
          <DataParticles path={fanPaths[i]} color={s.color} count={3} dur={2.6 + i * 0.2} />
          <DataParticles path={fwdPaths[i]} color={s.color} count={3} dur={2.2 + i * 0.15} />
          <DataParticles path={dstPaths[i]} color={s.color} count={3} dur={2.2 + i * 0.15} />
        </g>
      ))}

      {/* Source node — large, centered, like the main diagram's aggregator */}
      <g filter={anyEnabled ? 'url(#tp-glow)' : 'url(#tp-shadow)'}>
        <rect x={SRC_X} y={SRC_Y} width={SRC_W} height={SRC_H} rx={12} fill="#0a0a0a" stroke="#262626" strokeWidth="1.5" />
        {anyEnabled && (
          <rect x={SRC_X} y={SRC_Y} width={SRC_W} height={SRC_H} rx={12} fill="#4ade80">
            <animate attributeName="opacity" values="0;0.04;0" dur="4s" repeatCount="indefinite" />
          </rect>
        )}
        <text x={SRC_X + SRC_W / 2} y={srcCY - 10} textAnchor="middle" fill="#e5e5e5" fontSize="14" fontWeight="600">Workloads</text>
        <text x={SRC_X + SRC_W / 2} y={srcCY + 8} textAnchor="middle" fill="#737373" fontSize="9.5">Applications · Nodes</text>
        {/* Signal type indicators */}
        {signals.map((s, si) => (
          <g key={`ind-${s.key}`} opacity={s.enabled ? 0.8 : 0.2}>
            <circle cx={SRC_X + 30 + si * 40} cy={srcCY + 30} r={3} fill={s.color} />
            <text x={SRC_X + 37 + si * 40} y={srcCY + 33} fill="#737373" fontSize="8">{s.label.toLowerCase()}</text>
          </g>
        ))}
      </g>

      {/* Collector nodes */}
      {signals.map((s, i) => {
        const y = ROW_Y[i]
        const active = s.enabled
        return (
          <g key={`col-${s.key}`} filter="url(#tp-shadow)" opacity={active ? 1 : 0.3}>
            <rect x={COL_X} y={y} width={NW} height={NH} rx={8} fill="#0a0a0a" stroke="#262626" strokeWidth="1" />
            <rect x={COL_X} y={y + 6} width={3} height={NH - 12} rx={1.5} fill={s.color} opacity={active ? 0.7 : 0.2} />
            <text x={COL_X + 14} y={y + 23} fill={active ? '#d4d4d4' : '#525252'} fontSize="12" fontWeight="500">{s.collector}</text>
            <text x={COL_X + 14} y={y + 40} fill="#737373" fontSize="9">{active ? s.collectorSub : 'Not installed'}</text>
          </g>
        )
      })}

      {/* Forwarding / pipeline nodes */}
      {signals.map((s, i) => {
        const y = ROW_Y[i]
        const active = s.enabled
        return (
          <g key={`fwd-${s.key}`} filter="url(#tp-shadow)" opacity={active ? 1 : 0.3}>
            <rect x={FWD_X} y={y} width={NW} height={NH} rx={8} fill="#0a0a0a" stroke="#262626" strokeWidth="1" />
            {active && (
              <rect x={FWD_X} y={y} width={NW} height={NH} rx={8} fill={s.color}>
                <animate attributeName="opacity" values="0;0.03;0" dur="3s" repeatCount="indefinite" />
              </rect>
            )}
            <text x={FWD_X + NW / 2} y={y + 23} textAnchor="middle" fill={active ? '#d4d4d4' : '#525252'} fontSize="12" fontWeight="500">
              {active ? 'Forwarding' : '\u2014'}
            </text>
            <text x={FWD_X + NW / 2} y={y + 40} textAnchor="middle" fill="#737373" fontSize="9">
              {active ? `${s.label} pipeline` : ''}
            </text>
          </g>
        )
      })}

      {/* Destination nodes */}
      {signals.map((s, i) => {
        const y = ROW_Y[i]
        const active = s.enabled
        return (
          <g key={`dst-${s.key}`} filter="url(#tp-shadow)" opacity={active ? 1 : 0.3}>
            <rect x={DST_X} y={y} width={NW} height={NH} rx={8} fill="#0a0a0a" stroke="#262626" strokeWidth="1" />
            <rect x={DST_X + NW - 3} y={y + 6} width={3} height={NH - 12} rx={1.5} fill={s.color} opacity={active ? 0.7 : 0.2} />
            <text x={DST_X + 12} y={y + 23} fill={active ? '#d4d4d4' : '#525252'} fontSize="11" fontWeight="500">
              {active ? s.destination : '\u2014'}
            </text>
            <text x={DST_X + 12} y={y + 40} fill="#737373" fontSize="9">{active ? s.destinationSub : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}
