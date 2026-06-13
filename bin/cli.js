#!/usr/bin/env node
import 'dotenv/config';
import readline from 'node:readline';
import { createAgent } from '../src/agent.js';
import { c, printBanner, label, spinner, rule } from '../src/ui.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

// Allow a one-shot question: `lemura-cli "what time is it?"`
const oneShot = args.filter((a) => !a.startsWith('-')).join(' ').trim();

function fail(msg) {
  process.stderr.write('\n' + c.red('✖ ') + msg + '\n\n');
  process.exit(1);
}

let agent;
try {
  agent = createAgent({ verbose });
} catch (err) {
  fail(err.message);
}
const { session, model, mcpServers } = agent;

// MCP servers connect asynchronously inside the SessionManager; both run() and
// stream() await readiness internally, but we await here too so the banner can
// report connected servers and tool counts up front.
async function waitForMcp() {
  if (!mcpServers.length) return;
  const spin = spinner(`connecting ${mcpServers.length} MCP server(s)`);
  spin.start();
  try {
    if (session.mcpReady) await session.mcpReady;
  } catch {
    /* per-server failures are logged by lemura; keep going */
  }
  spin.stop();
}

function mcpSummary() {
  if (!mcpServers.length) return c.dim('  MCP: ') + c.dim('none configured') + '\n';
  const all = session.tools?.getAll?.() ?? [];
  const builtIns = new Set(['get_current_time', 'calculate']);
  const mcpToolCount = all.filter((t) => !builtIns.has(t.name)).length;
  const names = mcpServers.map((s) => s.name).join(', ');
  return (
    c.dim('  MCP: ') +
    c.white(`${mcpServers.length} server(s)`) +
    c.dim(` [${names}] · `) +
    c.white(`${mcpToolCount} tool(s)`) +
    '\n'
  );
}

// Run the agent and render the final answer. The whole ReAct loop (tools, goal
// verification) completes first; we show a spinner during the wait, then print
// the answer in one clean block.
async function ask(question) {
  const spin = spinner('thinking');
  spin.start();
  let answer;
  try {
    answer = await session.run(question);
  } catch (err) {
    spin.stop();
    process.stdout.write(c.red('✖ ') + (err?.message || String(err)) + '\n');
    if (verbose && err?.stack) process.stdout.write(c.dim(err.stack) + '\n');
    return;
  }
  spin.stop();
  const text = (answer ?? '').trim();
  process.stdout.write(label.agent() + '  ' + (text || c.dim('(no response)')) + '\n');
}

// --- one-shot mode -----------------------------------------------------------
if (oneShot) {
  await waitForMcp();
  await ask(oneShot);
  await session.close();
  process.exit(0);
}

// --- interactive REPL --------------------------------------------------------
printBanner({ model });
await waitForMcp();
process.stdout.write(mcpSummary() + '\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: label.you() + c.dim(' › '),
});

const HELP = `
${c.bold('Commands')}
  ${c.yellow('/help')}     show this help
  ${c.yellow('/clear')}    clear the screen
  ${c.yellow('/model')}    show the active model
  ${c.yellow('/mcp')}      list connected MCP servers
  ${c.yellow('/tools')}    list all available tools
  ${c.yellow('/exit')}     quit (or Ctrl+C)
`;

function listTools() {
  const all = session.tools?.getAll?.() ?? [];
  if (!all.length) return c.dim('  no tools registered') + '\n';
  return (
    all
      .map((t) => '  ' + c.cyan(t.name) + c.dim(' — ' + (t.description || '').split('\n')[0]))
      .join('\n') + '\n'
  );
}

// Serialize turns: readline can fire 'line' again before an async handler
// resolves (especially with paste / piped input). Pausing input while the
// agent works guarantees one question is fully answered before the next.
let busy = false;

async function handleLine(line) {
  const input = line.trim();
  if (!input) return rl.prompt();

  if (input.startsWith('/')) {
    switch (input.toLowerCase()) {
      case '/exit':
      case '/quit':
        return rl.close();
      case '/help':
        process.stdout.write(HELP + '\n');
        return rl.prompt();
      case '/clear':
        process.stdout.write('\x1b[2J\x1b[H');
        printBanner({ model });
        return rl.prompt();
      case '/model':
        process.stdout.write(c.dim('  active model: ') + c.white(model) + '\n\n');
        return rl.prompt();
      case '/mcp':
        process.stdout.write(mcpSummary() + '\n');
        return rl.prompt();
      case '/tools':
        process.stdout.write(listTools() + '\n');
        return rl.prompt();
      default:
        process.stdout.write(
          c.red('  unknown command: ') + input + c.dim('  (try /help)') + '\n\n'
        );
        return rl.prompt();
    }
  }

  busy = true;
  rl.pause();
  process.stdout.write('\n');
  await ask(input);
  process.stdout.write(rule() + '\n');
  busy = false;
  rl.resume();
  rl.prompt();
}

rl.prompt();

rl.on('line', (line) => {
  if (busy) return; // ignore stray input while the agent is working
  handleLine(line);
});

rl.on('close', async () => {
  process.stdout.write('\n' + c.magenta('Goodbye! ') + c.dim('✦') + '\n');
  try {
    await session.close();
  } catch {
    /* ignore disconnect errors on shutdown */
  }
  process.exit(0);
});
