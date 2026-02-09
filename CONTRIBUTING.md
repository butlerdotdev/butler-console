# Contributing to Butler Console

Thank you for your interest in contributing to Butler Console!

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- Butler Server running locally (for API connectivity)

### Installation

```bash
git clone https://github.com/butlerdotdev/butler-console.git
cd butler-console
npm install
```

### Running Locally

```bash
# Start dev server (proxies to Butler Server on :8080)
npm run dev

# The console will be available at http://localhost:5173
```

### Building

```bash
# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Code Guidelines

### Project Structure

- `src/api/` - API client modules (one file per resource type)
- `src/components/` - Reusable React components
- `src/components/ui/` - Base UI primitives (Button, Card, Input, etc.)
- `src/contexts/` - React context providers
- `src/hooks/` - Custom React hooks
- `src/pages/` - Route page components
- `src/types/` - TypeScript type definitions

### Adding a New Feature

1. Define types in `src/types/`
2. Add API functions in `src/api/`
3. Create components in `src/components/`
4. Add page(s) in `src/pages/`
5. Update routes in `src/App.tsx`

### Code Style

- **TypeScript**: Strict mode enabled. Fix type errors, don't suppress them.
- **Components**: Functional components with hooks. No class components.
- **Styling**: Tailwind CSS only. No CSS modules or styled-components.
- **State**: React Context for global state. No Redux or external state libraries.
- **Icons**: Inline SVG (Heroicons style). No icon libraries.

### Component Pattern

```tsx
interface Props {
  cluster: TenantCluster;
  onDelete?: () => void;
}

export function ClusterCard({ cluster, onDelete }: Props) {
  const { showToast } = useToast();

  const handleDelete = async () => {
    try {
      await clustersApi.delete(cluster.namespace, cluster.name);
      showToast('Cluster deleted', 'success');
      onDelete?.();
    } catch (error) {
      showToast('Failed to delete cluster', 'error');
    }
  };

  return (
    <Card>
      {/* Component content */}
    </Card>
  );
}
```

### API Client Pattern

```typescript
// src/api/resources.ts
import { apiClient } from './client';
import type { Resource, CreateResourceRequest } from '@/types';

export async function listResources(): Promise<Resource[]> {
  return apiClient.get<Resource[]>('/resources');
}

export async function createResource(data: CreateResourceRequest): Promise<Resource> {
  return apiClient.post<Resource>('/resources', data);
}
```

### Don't Do

- Don't add `/* eslint-disable */` comments
- Don't use `any` type (use `unknown` and type guards if needed)
- Don't store auth tokens in localStorage (JWT is in httpOnly cookie)
- Don't make direct K8s API calls (everything goes through butler-server)
- Don't add external component libraries

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run checks: `npm run lint && npm run typecheck`
5. Test your changes manually
6. Commit with conventional commit messages
7. Push to your fork and open a PR

### Commit Message Format

```
type(scope): description
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(clusters): add certificate rotation UI`
- `fix(auth): handle SSO callback errors gracefully`
- `docs: update README with new features`

## Developer Certificate of Origin

By contributing to this project, you agree to the Developer Certificate of Origin (DCO). This means you certify that you wrote the contribution or have the right to submit it under the project's license.

Sign off your commits with `git commit -s` or add `Signed-off-by: Your Name <your.email@example.com>` to your commit messages.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
