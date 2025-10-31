# Development Container Configurations

This repository provides multiple devcontainer configurations to support different development environments.

## Available Configurations

### Fedora (Default)
- **Location**: `.devcontainer/fedora/`
- **Base Image**: `fedora:latest`
- **Features**:
  - Common Utils (with vscode user)
  - Rust
  - Node.js
  - Zig
  - Bun
- **Additional Packages**: dnf-plugins-core, cargo, C development tools, RPM development tools, rpkg, gh

### Ubuntu
- **Location**: `.devcontainer/ubuntu/`
- **Base Image**: `mcr.microsoft.com/devcontainers/base:noble`
- **Features**:
  - Common Utils (with vscode user)
  - Rust
  - Node.js

## Usage

When opening this repository in VS Code with the Dev Containers extension:

1. VS Code will detect multiple devcontainer configurations
2. You'll be prompted to select which configuration to use
3. Choose either "Fedora" or "Ubuntu" based on your preference

Alternatively, you can specify the configuration in your VS Code settings or when running the "Dev Containers: Reopen in Container" command.

## VSCode Extensions

Both configurations include the following VS Code extensions:
- C/C++ Extension Pack
- GitHub Actions
- Rust Analyzer
- Dependi
- CodeLLDB

## Environment Variables

Both configurations set:
- `CARGO_HOME=/home/vscode/.cargo` - Custom cargo home directory
