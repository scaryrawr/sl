# Vendored Anti-Slop plugin

Copied from https://github.com/dmmulroy/anti-slop (MIT, see `LICENSE`) at revision
`13909c9e07590f5a85d93c62712259fe14a883f7` (upstream version 0.1.2).

This directory is vendored source, owned by this repository: read and change the rules to match local standards. It is
excluded from linting via `ignorePatterns` in `.oxlintrc.json`.

`@oxlint/plugins` in the root `package.json` is pinned to the exact version of `oxlint` (currently `1.90.0`); upgrade
both together.

## Updating

Fetch the upstream `src/` at a newer revision and port changes into this directory, preserving any local rule
customizations recorded below.

## Local customizations

- None yet.
