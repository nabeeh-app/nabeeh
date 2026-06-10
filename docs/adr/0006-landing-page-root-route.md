# ADR-0006: Landing page at root route

The root route (`/` and `/[locale]/`) now serves a marketing landing page instead of redirecting to login. Login remains at `/login` as a secondary entry point.

## Context

Nabeeh had no public-facing marketing page. The root route redirected straight to login, which is unusual for a SaaS product and wastes the highest-traffic URL on an auth form instead of conversion.

## Decision

Make the root route the marketing landing page. The page includes: hero with interactive WhatsApp bot demo, problem/solution section, features grid, screenshots carousel, pricing (coming soon), FAQ, WhatsApp CTA, and footer. Login and register remain at their current paths.

## Consequences

- Root URL (`/`, `/en`, `/ar`) is now public marketing content, not a redirect.
- Login page can optionally be simplified (hero panel removed since landing page handles marketing).
- The landing page is statically renderable (no auth required).
- New component namespace: `components/landing/` for all landing-page-specific components.
- New i18n namespace: `landing.*` in both `en.json` and `ar.json`.
