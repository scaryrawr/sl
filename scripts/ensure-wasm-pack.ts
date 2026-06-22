#!/usr/bin/env bun
/**
 * Prerequisite checker and installer for the WebAssembly build toolchain.
 *
 * Verifies that `cargo` and `rustup` are available, then ensures:
 * - The `wasm32-unknown-unknown` Rust target is installed.
 * - `wasm-pack` is installed via `cargo install`.
 *
 * When run with `--install`, missing tools are automatically installed.
 * Without `--install`, the script exits with an error message if prerequisites are missing.
 *
 * Run with:
 * - `bun run scripts/ensure-wasm-pack.ts`        (check only)
 * - `bun run scripts/ensure-wasm-pack.ts --install` (check and install)
 *
 * @module ensure-wasm-pack
 */

const WASM_TARGET = 'wasm32-unknown-unknown';
const installMode = process.argv.includes('--install');

/** Result of executing a child process via `Bun.spawnSync`. */
type CommandResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
};

/** Join an array of command arguments into a human-readable string. */
const commandText = (command: string[]) => command.join(' ');

/** Convert any error value to a readable string. */
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

/**
 * Run a child process and capture its output.
 *
 * @param command - Command and arguments to execute.
 * @param inheritOutput - When true, streams stdout/stderr directly to the parent (useful for install progress).
 * @returns Captured result with success status and output text.
 */
const run = (command: string[], inheritOutput = false): CommandResult => {
  try {
    const result = Bun.spawnSync(command, {
      stdout: inheritOutput ? 'inherit' : 'pipe',
      stderr: inheritOutput ? 'inherit' : 'pipe'
    });

    return {
      success: result.success,
      stdout: result.stdout ? result.stdout.toString() : '',
      stderr: result.stderr ? result.stderr.toString() : ''
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: getErrorMessage(error)
    };
  }
};

/** Print an error message to stderr and exit with code 1. */
const fail = (message: string) => {
  console.error(message);
  process.exit(1);
};

/**
 * Build a helpful error message when a required tool is not found on PATH.
 *
 * @param tool - Name of the missing tool.
 * @param extra - Optional additional context (e.g., stderr from a failed version check).
 * @returns Formatted error message with installation instructions.
 */
const missingToolMessage = (tool: string, extra?: string) =>
  [
    `error: ${tool} is required to build the website, but it was not found on PATH.`,
    extra,
    '',
    'Run the repository setup command:',
    '  bun run setup',
    '',
    'Or install the WebAssembly build prerequisites manually:',
    `  rustup target add ${WASM_TARGET}`,
    '  cargo install wasm-pack'
  ]
    .filter(Boolean)
    .join('\n');

/**
 * Build an error message for a failed command execution.
 *
 * @param command - The command that failed.
 * @param result - The captured result from the failed execution.
 * @returns Formatted error message including stderr/stdout.
 */
const commandFailureMessage = (command: string[], result: CommandResult) =>
  [`error: failed to run \`${commandText(command)}\`.`, result.error, result.stderr.trim(), result.stdout.trim()]
    .filter(Boolean)
    .join('\n');

/**
 * Verify that a required command-line tool is available.
 * Exits with an error if the tool's version command fails.
 *
 * @param tool - Human-readable name of the tool.
 * @param versionCommand - Command to check the tool's version (e.g., `['cargo', '--version']`).
 */
const requireCommand = (tool: string, versionCommand: string[]) => {
  const result = run(versionCommand);
  if (!result.success) {
    fail(missingToolMessage(tool, result.error || result.stderr.trim()));
  }
};

/**
 * Ensure the `wasm32-unknown-unknown` Rust target is installed.
 * Installs it automatically when `--install` flag is present.
 */
const ensureWasmTarget = () => {
  const listCommand = ['rustup', 'target', 'list', '--installed'];
  const listResult = run(listCommand);

  if (!listResult.success) {
    fail(commandFailureMessage(listCommand, listResult));
  }

  if (listResult.stdout.split(/\r?\n/).includes(WASM_TARGET)) {
    return;
  }

  if (!installMode) {
    fail(
      [
        `error: Rust target ${WASM_TARGET} is required to build the website, but it is not installed.`,
        '',
        'Run the repository setup command:',
        '  bun run setup',
        '',
        'Or install it manually:',
        `  rustup target add ${WASM_TARGET}`
      ].join('\n')
    );
  }

  console.log(`Installing Rust target ${WASM_TARGET}...`);
  const addResult = run(['rustup', 'target', 'add', WASM_TARGET], true);
  if (!addResult.success) {
    fail(commandFailureMessage(['rustup', 'target', 'add', WASM_TARGET], addResult));
  }
};

/**
 * Ensure `wasm-pack` is installed.
 * Installs it via `cargo install` when `--install` flag is present.
 */
const ensureWasmPack = () => {
  const versionCommand = ['wasm-pack', '--version'];
  const versionResult = run(versionCommand);

  if (versionResult.success) {
    return;
  }

  if (!installMode) {
    fail(missingToolMessage('wasm-pack', versionResult.error || versionResult.stderr.trim()));
  }

  console.log('Installing wasm-pack...');
  const installResult = run(['cargo', 'install', 'wasm-pack'], true);
  if (!installResult.success) {
    fail(commandFailureMessage(['cargo', 'install', 'wasm-pack'], installResult));
  }
};

// Main execution: check prerequisites and install if requested
requireCommand('cargo', ['cargo', '--version']);
requireCommand('rustup', ['rustup', '--version']);
ensureWasmTarget();
ensureWasmPack();

if (installMode) {
  console.log('WebAssembly build prerequisites are ready.');
}
