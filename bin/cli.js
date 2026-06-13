#!/usr/bin/env node
import 'dotenv/config';
import readline from 'node:readline';
import { Agent } from '../src/agent.js';
import { UI, c } from '../src/ui.js';

const HELP = `
${c.bold('Commands')}
  ${c.yellow('/help')}     show this help
  ${c.yellow('/clear')}    clear the screen
  ${c.yellow('/model')}    show the active model
  ${c.yellow('/mcp')}      list connected MCP servers
  ${c.yellow('/tools')}    list all available tools
  ${c.yellow('/exit')}     quit (or Ctrl+C)
`;

class CLI {
  #agent;
  #rl;
  #busy = false;

  constructor(agent) {
    this.#agent = agent;
  }

  #fail(msg) {
    process.stderr.write('\n' + c.red('✖ ') + msg + '\n\n');
    process.exit(1);
  }

  async #ask(question, verbose) {
    const spin = UI.spinner('thinking');
    spin.start();
    let answer;
    try {
      answer = await this.#agent.ask(question);
    } catch (err) {
      spin.stop();
      process.stdout.write(c.red('✖ ') + (err?.message || String(err)) + '\n');
      if (verbose && err?.stack) process.stdout.write(c.dim(err.stack) + '\n');
      return;
    }
    spin.stop();
    const text = (answer ?? '').trim();
    process.stdout.write(UI.label.agent() + '  ' + (text || c.dim('(no response)')) + '\n');
  }

  #mcpSummary() {
    const servers = this.#agent.mcpServers;
    if (!servers.length) return c.dim('  MCP: ') + c.dim('none configured') + '\n';

    const builtIns = new Set(['get_current_time', 'calculate']);
    const mcpToolCount = this.#agent.getAllTools().filter((t) => !builtIns.has(t.name)).length;
    const names = servers.map((s) => s.name).join(', ');
    return (
      c.dim('  MCP: ') +
      c.white(`${servers.length} server(s)`) +
      c.dim(` [${names}] · `) +
      c.white(`${mcpToolCount} tool(s)`) +
      '\n'
    );
  }

  #listTools() {
    const all = this.#agent.getAllTools();
    if (!all.length) return c.dim('  no tools registered') + '\n';
    return (
      all
        .map((t) => '  ' + c.cyan(t.name) + c.dim(' — ' + (t.description || '').split('\n')[0]))
        .join('\n') + '\n'
    );
  }

  async #handleCommand(input) {
    switch (input.toLowerCase()) {
      case '/exit':
      case '/quit':
        return this.#rl.close();
      case '/help':
        process.stdout.write(HELP + '\n');
        break;
      case '/clear':
        process.stdout.write('\x1b[2J\x1b[H');
        UI.printBanner({ model: this.#agent.model });
        break;
      case '/model':
        process.stdout.write(c.dim('  active model: ') + c.white(this.#agent.model) + '\n\n');
        break;
      case '/mcp':
        process.stdout.write(this.#mcpSummary() + '\n');
        break;
      case '/tools':
        process.stdout.write(this.#listTools() + '\n');
        break;
      default:
        process.stdout.write(
          c.red('  unknown command: ') + input + c.dim('  (try /help)') + '\n\n'
        );
    }
    this.#rl.prompt();
  }

  async #handleLine(line, verbose) {
    const input = line.trim();
    if (!input) return this.#rl.prompt();

    if (input.startsWith('/')) {
      return this.#handleCommand(input);
    }

    this.#busy = true;
    this.#rl.pause();
    process.stdout.write('\n');
    await this.#ask(input, verbose);
    process.stdout.write(UI.rule() + '\n');
    this.#busy = false;
    this.#rl.resume();
    this.#rl.prompt();
  }

  async runOneShot(question, verbose) {
    await this.#waitForMcp();
    await this.#ask(question, verbose);
    await this.#agent.close();
    process.exit(0);
  }

  async #waitForMcp() {
    const servers = this.#agent.mcpServers;
    if (!servers.length) return;
    const spin = UI.spinner(`connecting ${servers.length} MCP server(s)`);
    spin.start();
    await this.#agent.waitForMcp();
    spin.stop();
  }

  async runRepl(verbose) {
    UI.printBanner({ model: this.#agent.model });
    await this.#waitForMcp();
    process.stdout.write(this.#mcpSummary() + '\n');

    this.#rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: UI.label.you() + c.dim(' › '),
    });

    this.#rl.prompt();

    this.#rl.on('line', (line) => {
      if (this.#busy) return;
      this.#handleLine(line, verbose);
    });

    this.#rl.on('close', async () => {
      process.stdout.write('\n' + c.magenta('Goodbye! ') + c.dim('✦') + '\n');
      await this.#agent.close();
      process.exit(0);
    });
  }
}

// --- bootstrap ---------------------------------------------------------------
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const oneShot = args.filter((a) => !a.startsWith('-')).join(' ').trim();

let agent;
try {
  agent = new Agent({ verbose });
} catch (err) {
  process.stderr.write('\n' + c.red('✖ ') + err.message + '\n\n');
  process.exit(1);
}

const cli = new CLI(agent);

if (oneShot) {
  await cli.runOneShot(oneShot, verbose);
} else {
  await cli.runRepl(verbose);
}
