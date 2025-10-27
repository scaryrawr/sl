#!/usr/bin/env bash
set -e

# Update package list and install common development tools
sudo apt-get update && sudo apt-get install -y build-essential pkg-config curl wget git gh
