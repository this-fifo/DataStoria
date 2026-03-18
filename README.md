# DataStoria

**Browse, edit, and debug Roblox Data Stores from VS Code.**

DataStoria is a VS Code extension that connects to the [Roblox Open Cloud API v2](https://create.roblox.com/docs/cloud/reference/DataStore) to give you a full data store explorer with time-travel debugging, revision diffs, and entry editing — all without leaving your editor.

---

## Features

### Data Store Explorer

A dedicated sidebar in the Activity Bar lets you browse your data stores like a file tree:

```
DataStoria
├── My Game (Production)           ← Universe
│   ├── Standard Data Stores (3)
│   │   ├── PlayerData             ← Data Store
│   │   │   └── global             ← Scope
│   │   │       ├── Player_1001    ← Entry (click to view, expand for history)
│   │   │       │   ├── a3f8c201  current    2m ago
│   │   │       │   ├── 7b2e4d90             1h ago
│   │   │       │   └── e1c9a5f3             3d ago
│   │   │       ├── Player_1002
│   │   │       └── Load More...
│   │   ├── Leaderboards
│   │   └── Settings
│   └── Ordered Data Stores
└── My Game (Staging)
```

- **Lazy loading** — children fetched only when you expand a node
- **Pagination** — large data stores load in pages with "Load More"
- **Scope discovery** — scopes are detected automatically, with the option to browse custom scopes
- **Search** — persistent filter panel above the tree for key prefix filtering

### Entry Viewing and Editing

Click any entry to open it as a read-only JSON document with full syntax highlighting. A CodeLens bar at the top shows the version status and value size:

```
  $(file-binary) 2.3 KB / 4 MB (0.1%)  |  $(pass-filled) Current version
  ─────────────────────────────────────────────────────────────────────
  {
    "coins": 4200,
    "level": 15,
    "inventory": ["sword", "shield", "potion"],
    "lastLogin": "2026-03-18T04:30:00Z"
  }
```

Right-click an entry to edit, delete, increment, or copy its value.

### Time-Travel Debugging

Every entry keeps a revision history. Expand an entry in the tree to see its past versions with relative timestamps and a retention countdown:

```
  $(git-commit) Revision 7b2e4d90  |  $(debug-reverse-continue) Restore  |  $(diff) Compare
  ─────────────────────────────────────────────────────────────────────────────────────────────
  {
    "coins": 3800,
    "level": 14,
    ...
  }
```

- **Compare with current** — opens VS Code's diff editor side-by-side
- **Compare any two revisions** — pick left and right from a QuickPick
- **View at timestamp** — enter an ISO 8601 date to see the value at that moment
- **Restore** — one click to write a past revision's value as the new current version

### Universe Stats

Right-click a universe node and select "Show Universe Stats" to get a Markdown overview with your data store inventory and the complete Roblox limits reference:

```
  # My Game — Universe Stats

  | Metric  | Count |
  |---------|-------|
  | Active  | 12    |
  | Deleted | 2     |
  | Total   | 14    |

  Storage limit = 100 MB + 1 MB × lifetime user count
  Max value size: 4 MB per key
  Read throughput: 25 MB/min per key
  ...
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VS Code UI                       │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Activity │  │   Editor     │  │  Status Bar   │  │
│  │ Bar +    │  │  (Virtual    │  │  (connection) │  │
│  │ Tree     │  │   Documents  │  │               │  │
│  │ View     │  │   + CodeLens)│  │               │  │
│  └────┬─────┘  └──────┬───────┘  └───────────────┘  │
│       │               │                             │
│  ┌────┴───────────────┴──────────────────────────┐  │
│  │           Extension Host (extension.ts)       │  │
│  │                                               │  │
│  │  Commands · Providers · Event Wiring          │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │                               │
│  ┌──────────────────┴────────────────────────────┐  │
│  │              Service Layer                    │  │
│  │                                               │  │
│  │  ┌────────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ DataStores │ │ Entries  │ │  Revisions  │  │  │
│  │  │  Service   │ │ Service  │ │   Service   │  │  │
│  │  └─────┬──────┘ └────┬─────┘ └──────┬──────┘  │  │
│  │        └──────────────┼──────────────┘        │  │
│  │                       │                       │  │
│  │            ┌──────────┴──────────┐            │  │
│  │            │    API Client       │            │  │
│  │            │  (auth · retry ·    │            │  │
│  │            │   error mapping)    │            │  │
│  │            └──────────┬──────────┘            │  │
│  └───────────────────────┼───────────────────────┘  │
│                          │                          │
│  ┌───────────────────────┴───────────────────────┐  │
│  │         SecretStorage (OS Keychain)           │  │
│  │  macOS Keychain · Windows Credential Manager  │  │
│  │  Linux libsecret                              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                          │
                          │ HTTPS (fetch)
                          ▼
              ┌───────────────────────┐
              │  Roblox Open Cloud    │
              │  API v2               │
              │                       │
              │  apis.roblox.com      │
              └───────────────────────┘
```

**Zero runtime dependencies.** The extension uses Node.js native `fetch` for HTTP and VS Code's built-in APIs for everything else. The production bundle is ~47 KB.

---

## Security

**API keys are never stored in plaintext.**

DataStoria uses [VS Code's SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage), which delegates to your operating system's secure credential store:

| OS      | Backend                   |
| ------- | ------------------------- |
| macOS   | Keychain                  |
| Windows | Credential Manager        |
| Linux   | libsecret (GNOME Keyring) |

Your API key secrets never appear in VS Code settings files, workspace configs, or extension logs. Only a display name is stored in settings — the actual key material lives in the OS keychain.

The extension communicates with Roblox exclusively over HTTPS and sends the API key only in the `x-api-key` request header as required by the Open Cloud API.

### Required API Key Scopes

DataStoria uses the **v2** Open Cloud API, which requires specific scopes on your API key:

| Operation             | Required Scope                              |
| --------------------- | ------------------------------------------- |
| List data stores      | `universe-datastores.control:list`          |
| Read entries          | `universe-datastores.objects:read`          |
| List entries          | `universe-datastores.objects:list`          |
| Create/update entries | `universe-datastores.objects:create/update` |
| Delete entries        | `universe-datastores.objects:delete`        |
| List revisions        | `universe-datastores.versions:list`         |
| Read revisions        | `universe-datastores.versions:read`         |

You can create and manage API keys at [create.roblox.com/credentials](https://create.roblox.com/dashboard/credentials).

---

## Getting Started

1. **Install the extension** from the VS Code Marketplace (or build from source)
2. **Open the DataStoria sidebar** by clicking the icon in the Activity Bar
3. **Add an API key** — the welcome view will guide you
4. **Add a universe** — provide a display name, Universe ID, and select the API key to use
5. **Browse** — expand the tree to explore your data stores

You can find your Universe ID in the [Creator Hub](https://create.roblox.com) under your experience settings.

---

## Data Store Limits

These limits are enforced by the Roblox platform. DataStoria surfaces them contextually in tooltips, CodeLens, and validation messages.

| Resource           | Limit                          |
| ------------------ | ------------------------------ |
| Data store name    | 50 characters                  |
| Entry key name     | 50 characters                  |
| Scope name         | 50 characters                  |
| Entry value        | 4 MB (4,194,304 B)             |
| Read throughput    | 25 MB/min per key              |
| Write throughput   | 4 MB/min per key               |
| Revision retention | 30 days after overwrite        |
| Storage formula    | 100 MB + 1 MB × lifetime users |

For the complete reference, see [Error Codes and Limits](https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits).

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org) 22+
- [Bun](https://bun.sh) (package manager)

### Setup

```sh
bun install
```

### Build

```sh
bun run build          # Type-check + production bundle
bun run watch          # Rebuild on file changes
```

### Lint & Format

```sh
bun run check          # Biome lint + format check
bun run fix            # Auto-fix issues
```

### Test

Press **F5** in VS Code to launch the Extension Development Host for manual testing.

```sh
bun test               # Run unit tests
```

### Package

```sh
bun run package        # Build .vsix for distribution
```

---

## Roadmap

- [x] Data store browsing with tree view
- [x] Entry CRUD (create, read, update, delete, increment)
- [x] Revision history and time-travel debugging
- [x] Diff comparison between revisions
- [x] Search and filter entries by key prefix
- [x] Universe stats and limits reference
- [ ] Ordered data store support
- [ ] Bulk export (JSON / NDJSON)
- [ ] Daily snapshot trigger
- [ ] Data store delete / undelete
- [ ] Unit and integration tests
- [ ] Marketplace publishing

---

## License

[Apache 2.0](LICENSE)
