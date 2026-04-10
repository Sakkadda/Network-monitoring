# Network Infrastructure Monitoring System

Prototype of a network infrastructure monitoring system with Go backend and React frontend.

## Planned stack

- Go
- Gin
- PostgreSQL
- Redis
- Vite
- TypeScript
- React
- CSS
- RTK Query
- Zod

## Project structure

- `cmd/api` - application entry point
- `configs` - environment and app configuration templates
- `deployments` - docker and deployment manifests
- `docs` - architecture notes and project docs
- `internal/api` - HTTP handlers, middleware, routes
- `internal/app` - application bootstrap and dependency wiring
- `internal/config` - config loading
- `internal/domain` - core entities
- `internal/dto` - request and response payloads
- `internal/repository` - database access
- `internal/service` - business logic
- `internal/monitoring` - monitoring and metric processing logic
- `internal/cache` - Redis integration
- `internal/logger` - application and admin log configuration
- `internal/utils` - helpers
- `migrations` - SQL migrations
- `pkg` - reusable public packages if needed
- `scripts` - dev scripts
- `storage` - local runtime storage for development
- `web` - frontend application
- `web/src` - React application source code
- `web/public` - static public assets
- `web/admin` - admin-specific frontend area, including logs page

## Notes

- Device data will initially be entered manually.
- Some metrics can later be partially simulated or populated from semi-real test data.
- Admin interface includes a dedicated logs section.
- Backend starts as REST API on Gin, frontend will be built as a separate Vite app.
- Built-in backend simulation can periodically update device statuses and metrics for demonstrations.
