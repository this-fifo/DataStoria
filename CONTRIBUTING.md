# Contributing to DataStoria

Thanks for your interest in DataStoria. Please read this before opening an issue or pull request.

## Project Status

DataStoria is in **pre-release development**. The architecture, APIs, and feature set are still being shaped. Unsolicited pull requests are likely to be closed without review during this phase.

## What Is Welcome

- **Bug reports** with clear reproduction steps
- **Feature requests** opened as discussions, not PRs
- **Questions** about the project or its design

## What Will Be Closed

- Pull requests that were not discussed in an issue first
- AI-generated or low-effort submissions (drive-by typo fixes, mass reformatting, vague "improvements")
- PRs that introduce runtime dependencies
- Changes that don't follow the existing code style (Biome with tabs, single quotes, semicolons)

## If You Want to Contribute Code

1. **Open an issue first.** Describe what you want to change and why. Wait for a response before writing code.
2. **Keep it focused.** One PR per change. No drive-by refactors or unrelated cleanups bundled in.
3. **Match the style.** Run `bun run check` before submitting. The project uses Biome for linting and formatting.
4. **No new runtime dependencies.** DataStoria ships with zero runtime deps and intends to stay that way.
5. **Test your changes.** Press F5 to launch the Extension Development Host and verify your change works end-to-end.

## Code of Conduct

Be respectful. Engage in good faith. This is a small project maintained by one person — time and attention are limited.

## Sponsorship

If you find DataStoria useful and want to support its development, you can sponsor the project through [GitHub Sponsors](https://github.com/sponsors/this-fifo).
