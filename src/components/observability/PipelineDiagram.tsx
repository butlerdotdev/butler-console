// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Animated SVG visualization of the centralized observability pipeline.
// Data flows: Tenant Clusters → Aggregator → Storage Backends → Grafana (lens).
// Particles are color-coded by signal type: blue=metrics, green=logs, amber=traces.

const W = 1080
const H = 340

// Node dimensions
const CW = 150, CH = 56
const AW = 140, AH = 140
const SW = 155, SH = 56
const GW = 160, GH = 210

// X positions
const CX = 10
const AX = 270
const SX = 535
const GX = 820

// Y positions
const AY = 100
const GY = 65

const TYPE_COLORS: Record<string, string> = {
  metrics: '#60a5fa',
  logs: '#4ade80',
  traces: '#fbbf24',
}

const CLUSTER_NODES = [
  { y: 42, name: 'production', types: ['metrics', 'logs', 'traces'] },
  { y: 142, name: 'staging', types: ['metrics', 'logs'] },
  { y: 242, name: 'development', types: ['logs'] },
]

const STORE_NODES = [
  { y: 42, name: 'Metrics', sub: 'VictoriaMetrics \u00b7 Mimir', color: '#60a5fa' },
  { y: 142, name: 'Logs', sub: 'VictoriaLogs \u00b7 Loki', color: '#4ade80' },
  { y: 242, name: 'Traces', sub: 'Tempo \u00b7 Jaeger', color: '#fbbf24' },
]

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cpx = (x1 + x2) / 2
  return `M ${x1},${y1} C ${cpx},${y1} ${cpx},${y2} ${x2},${y2}`
}

interface PathDef {
  id: string
  d: string
  color: string
  dur: number
}

function buildPaths() {
  const aggCY = AY + AH / 2

  const left: PathDef[] = CLUSTER_NODES.map((c, i) => ({
    id: `l${i}`,
    d: bezier(CX + CW, c.y + CH / 2, AX, aggCY),
    color: '#737373',
    dur: 2.6 + i * 0.2,
  }))

  const right: PathDef[] = STORE_NODES.map((s, i) => ({
    id: `r${i}`,
    d: bezier(AX + AW, aggCY, SX, s.y + SH / 2),
    color: s.color,
    dur: 2.2 + i * 0.15,
  }))

  const query: PathDef[] = STORE_NODES.map((s, i) => ({
    id: `g${i}`,
    d: bezier(SX + SW, s.y + SH / 2, GX, GY + 50 + i * ((GH - 100) / 2)),
    color: s.color,
    dur: 4 + i * 0.3,
  }))

  return { left, right, query }
}

const paths = buildPaths()

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

function ClusterParticles({ path, types, dur }: { path: string; types: string[]; dur: number }) {
  return (
    <>
      {types.map((t, i) => {
        const delay = i * dur / types.length
        return (
          <circle key={t} r="2.5" fill={TYPE_COLORS[t]} cx="0" cy="0">
            <animate attributeName="opacity" values="0;0.8;0.8;0" dur={`${dur}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" />
            <animateMotion dur={`${dur}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" path={path} />
          </circle>
        )
      })}
    </>
  )
}

export function PipelineDiagram() {
  const gcx = GX + GW / 2
  const gey = GY + 55

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="node-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
        </filter>
        <filter id="grafana-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#f97316" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Column labels */}
      <text x={CX + CW / 2} y={24} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">YOUR CLUSTERS</text>
      <text x={AX + AW / 2} y={AY - 14} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">PIPELINE</text>
      <text x={SX + SW / 2} y={24} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">STORAGE</text>
      <text x={gcx} y={GY - 10} textAnchor="middle" fill="#525252" fontSize="10" fontWeight="600" letterSpacing="0.08em">OBSERVE</text>

      {/* Data flow paths (solid) */}
      {[...paths.left, ...paths.right].map(p => (
        <path key={p.id} d={p.d} stroke="#1f1f1f" strokeWidth="1" fill="none" />
      ))}

      {/* Grafana query paths (dashed) */}
      {paths.query.map(p => (
        <path key={p.id} d={p.d} stroke={p.color} strokeWidth="0.5" fill="none" strokeDasharray="4 3" opacity="0.25" />
      ))}

      {/* Left particles — color-coded by each cluster's signal types */}
      {paths.left.map((p, i) => (
        <ClusterParticles key={`cp-${p.id}`} path={p.d} types={CLUSTER_NODES[i].types} dur={p.dur} />
      ))}

      {/* Right particles — color-coded by destination store */}
      {paths.right.map(p => (
        <DataParticles key={`dp-${p.id}`} path={p.d} color={p.color} count={3} dur={p.dur} />
      ))}

      {/* Query particles — subtle, representing Grafana reading from stores */}
      {paths.query.map(p => (
        <g key={`qp-${p.id}`}>
          {[0, 1].map(i => {
            const delay = i * p.dur / 2
            return (
              <circle key={i} r="1.8" fill={p.color} cx="0" cy="0">
                <animate attributeName="opacity" values="0;0.35;0.35;0" dur={`${p.dur}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" />
                <animateMotion dur={`${p.dur}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" path={p.d} />
              </circle>
            )
          })}
        </g>
      ))}

      {/* Cluster nodes */}
      {CLUSTER_NODES.map((c, i) => (
        <g key={`c-${i}`} filter="url(#node-shadow)">
          <rect x={CX} y={c.y} width={CW} height={CH} rx={8} fill="#0a0a0a" stroke="#262626" strokeWidth="1" />
          <rect x={CX} y={c.y + 6} width={3} height={CH - 12} rx={1.5} fill="#4ade80" opacity="0.7" />
          <text x={CX + 14} y={c.y + 22} fill="#d4d4d4" fontSize="12" fontWeight="500">{c.name}</text>
          {c.types.map((t, ti) => (
            <g key={t}>
              <circle cx={CX + 15 + ti * 48} cy={c.y + 38} r={2.5} fill={TYPE_COLORS[t]} opacity="0.8" />
              <text x={CX + 21 + ti * 48} y={c.y + 41} fill="#737373" fontSize="8">{t}</text>
            </g>
          ))}
        </g>
      ))}

      {/* Aggregator node */}
      <g filter="url(#node-shadow)">
        <rect x={AX} y={AY} width={AW} height={AH} rx={12} fill="#0a0a0a" stroke="#262626" strokeWidth="1.5" />
        <rect x={AX} y={AY} width={AW} height={AH} rx={12} fill="#4ade80">
          <animate attributeName="opacity" values="0;0.04;0" dur="4s" repeatCount="indefinite" />
        </rect>
        <text x={AX + AW / 2} y={AY + 45} textAnchor="middle" fill="#e5e5e5" fontSize="14" fontWeight="600">Aggregator</text>
        <text x={AX + AW / 2} y={AY + 65} textAnchor="middle" fill="#737373" fontSize="9.5">Buffer &middot; Transform</text>
        <text x={AX + AW / 2} y={AY + 80} textAnchor="middle" fill="#737373" fontSize="9.5">Route to backends</text>
        <text x={AX + AW / 2} y={AY + 110} textAnchor="middle" fill="#666" fontSize="8.5">Vector &middot; Fluentd &middot; OTel</text>
      </g>

      {/* Store nodes */}
      {STORE_NODES.map((s, i) => (
        <g key={`s-${i}`} filter="url(#node-shadow)">
          <rect x={SX} y={s.y} width={SW} height={SH} rx={8} fill="#0a0a0a" stroke="#262626" strokeWidth="1" />
          <rect x={SX + SW - 3} y={s.y + 6} width={3} height={SH - 12} rx={1.5} fill={s.color} opacity="0.7" />
          <text x={SX + 12} y={s.y + 23} fill="#d4d4d4" fontSize="12" fontWeight="500">{s.name}</text>
          <text x={SX + 12} y={s.y + 40} fill="#737373" fontSize="9">{s.sub}</text>
        </g>
      ))}

      {/* Grafana — the observability lens */}
      <g filter="url(#grafana-glow)">
        <rect x={GX} y={GY} width={GW} height={GH} rx={12} fill="#0a0a0a" stroke="#f97316" strokeWidth="1" opacity="0.8" />
        {/* Subtle orange pulse fill */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={12} fill="#f97316">
          <animate attributeName="opacity" values="0.02;0.06;0.02" dur="5s" repeatCount="indefinite" />
        </rect>
        {/* Eye/lens icon */}
        <path
          d={`M ${gcx - 22} ${gey} Q ${gcx} ${gey - 14} ${gcx + 22} ${gey} Q ${gcx} ${gey + 14} ${gcx - 22} ${gey}`}
          fill="#f97316" fillOpacity="0.06" stroke="#f97316" strokeWidth="0.8" opacity="0.35"
        />
        <circle cx={gcx} cy={gey} r={6} fill="#f97316" opacity="0.12" />
        <circle cx={gcx} cy={gey} r={3} fill="#f97316" opacity="0.3">
          <animate attributeName="r" values="3;4;3" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.5;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Labels */}
        <text x={gcx} y={gey + 35} textAnchor="middle" fill="#e5e5e5" fontSize="15" fontWeight="600">Grafana</text>
        <text x={gcx} y={gey + 53} textAnchor="middle" fill="#737373" fontSize="9.5">Unified Observability</text>
        <text x={gcx} y={gey + 82} textAnchor="middle" fill="#737373" fontSize="8.5">Dashboards</text>
        <text x={gcx} y={gey + 97} textAnchor="middle" fill="#737373" fontSize="8.5">Alerts</text>
        <text x={gcx} y={gey + 112} textAnchor="middle" fill="#737373" fontSize="8.5">Explore</text>
      </g>
    </svg>
  )
}
