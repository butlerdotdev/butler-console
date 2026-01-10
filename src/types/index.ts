// Kubernetes metadata
export interface ObjectMeta {
  name: string
  namespace: string
  uid?: string
  creationTimestamp?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

// TenantCluster CRD
export interface TenantCluster {
  apiVersion?: string
  kind?: string
  metadata: ObjectMeta
  spec: TenantClusterSpec
  status?: TenantClusterStatus
}

export interface TenantClusterSpec {
  kubernetesVersion?: string
  providerConfigRef?: {
    name: string
    namespace?: string
  }
  workers?: {
    replicas?: number
    machineTemplate?: {
      cpu?: number
      memory?: string
      diskSize?: string
    }
  }
  networking?: {
    loadBalancerPool?: {
      start?: string
      end?: string
    }
  }
}

export interface TenantClusterStatus {
  phase?: ClusterPhase
  tenantNamespace?: string
  controlPlaneReady?: boolean
  workersReady?: number
  workersTotal?: number
  conditions?: Condition[]
}

export interface Condition {
  type: string
  status: string
  reason?: string
  message?: string
  lastTransitionTime?: string
}

export type ClusterPhase = 
  | 'Pending'
  | 'Provisioning'
  | 'Ready'
  | 'Updating'
  | 'Deleting'
  | 'Failed'
  | 'Unknown'

// ProviderConfig CRD
export interface ProviderConfig {
  apiVersion?: string
  kind?: string
  metadata: ObjectMeta
  spec: {
    type: string
    credentialsRef?: {
      name: string
      namespace?: string
    }
  }
  status?: {
    ready?: boolean
    message?: string
  }
}

// Node info from tenant cluster
export interface NodeInfo {
  name: string
  status: string
  roles: string[]
  version: string
  internalIP: string
  os: string
  containerRuntime: string
  cpu: string
  memory: string
  age: string
}

// Addon status
export interface AddonStatus {
  name: string
  status: 'Installed' | 'Installing' | 'NotInstalled' | 'Failed'
  message?: string
}

// Event from Kubernetes
export interface ClusterEvent {
  type: string
  reason: string
  message: string
  source: string
  firstTimestamp: string
  lastTimestamp: string
  count: number
}

// Auth types
export interface User {
  username: string
  role: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

// API Response types
export interface ClusterListResponse {
  clusters: TenantCluster[]
}

export interface ProviderListResponse {
  providers: ProviderConfig[]
}

export interface NodesResponse {
  nodes: NodeInfo[]
}

export interface AddonsResponse {
  addons: AddonStatus[]
}

export interface EventsResponse {
  events: ClusterEvent[]
}
