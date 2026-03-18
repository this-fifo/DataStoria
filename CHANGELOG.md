# Changelog

All notable changes to DataStoria will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-03-18

### Added

- **Data Store Explorer** — browse standard data stores via the Activity Bar sidebar
  - Tree hierarchy: Universe > Data Store > Scope > Entry > Revisions
  - Lazy loading with pagination ("Load More" sentinel nodes)
  - Scope discovery with custom scope browsing
  - Inline data store count on group nodes

- **Authentication** — key-first auth model with OS keychain storage
  - API keys stored securely via VS Code SecretStorage (never in plaintext)
  - Multiple universes can share a single API key
  - Add, edit, and delete API keys and universes through guided wizards

- **Entry CRUD** — full create, read, update, delete for data store entries
  - Read-only JSON viewer with syntax highlighting (virtual documents)
  - Edit with JSON validation and save interception
  - Increment numeric entries
  - Copy entry ID or value to clipboard
  - 4 MB value size guard with warning at 90% threshold
  - Input validation enforcing Roblox 50-character limits on keys and scopes

- **Time-Travel Debugging** — revision history and comparison
  - Expand any entry to see its revision history with relative dates
  - Compare any revision with the current version (VS Code diff editor)
  - Compare any two revisions side-by-side
  - View entry value at a specific point in time (ISO 8601 timestamp)
  - Restore a past revision as a new current version
  - Revision retention countdown in tooltips (30-day expiry warning)

- **Editor Integration**
  - CodeLens showing version status (current vs revision hash)
  - CodeLens actions: Restore this version, Compare with current
  - Value size indicator in CodeLens (bytes used / 4 MB limit)
  - Tab titles: `entryId.json` or `entryId @ rev12345.json`

- **Search** — persistent search panel above the tree
  - Debounced key prefix filtering via Roblox API server-side filter
  - Auto-sets context from tree selection
  - Filter state preserved when clicking away
  - Filter bar indicator in tree with result count

- **Universe Stats** — right-click a universe to view a Markdown overview
  - Data store inventory (active and deleted counts with names)
  - Complete Roblox limits reference (sizes, rates, storage formula)
  - Versioning rules, caching behavior, serialization notes

- **Error Handling** — contextual error messages mapped from Roblox API codes
  - Actionable hints for permission, rate limit, and not-found errors
  - Links to Roblox API key documentation

- **Status Bar** — connection indicator showing active profile

[Unreleased]: https://github.com/this-fifo/DataStoria/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/this-fifo/DataStoria/releases/tag/v0.1.0
