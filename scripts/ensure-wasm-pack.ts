#!/usr/bin/env bun

const WASM_TARGET = 'wasm32-unknown-unknown';
const installMode = process.argv.includes('--install');

type CommandResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
};

const commandText = (command: string[]) => command.join(' ');

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

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

const fail = (message: string) => {
  console.error(message);
  process.exit(1);
};

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

const commandFailureMessage = (command: string[], result: CommandResult) =>
  [`error: failed to run \`${commandText(command)}\`.`, result.error, result.stderr.trim(), result.stdout.trim()]
    .filter(Boolean)
    .join('\n');

const requireCommand = (tool: string, versionCommand: string[]) => {
  const result = run(versionCommand);
  if (!result.success) {
    fail(missingToolMessage(tool, result.error || result.stderr.trim()));
  }
};

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

requireCommand('cargo', ['cargo', '--version']);
requireCommand('rustup', ['rustup', '--version']);
ensureWasmTarget();
ensureWasmPack();

if (installMode) {
  console.log('WebAssembly build prerequisites are ready.');
}
