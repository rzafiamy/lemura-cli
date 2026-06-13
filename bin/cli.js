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
  ${c.yellow('/skills')}   list active skills
  ${c.yellow('/exit')}     quit (or Ctrl+C)
`;

class CLI {
  #agent;
  #rl;
  #busy = false;
  #verbose;
  #spin = null;

  // Accumulated per turn, reset before each ask
  #turnTools = [];
  #turnSkills = [];
  #turnTokens = null;

  constructor(verbose = false) {
    this.#verbose = verbose;
  }

  setAgent(agent) {
    this.#agent = agent;
  }

  // Receives all trace events from lemura — both at session init and per turn.
  handleTrace(event) {
    const { type, name, status, metadata } = event;

    // Per-turn events — only meaningful while a turn is running
    if (type === 'tool_call' && status === 'running') {
      if (!this.#turnTools.includes(name)) this.#turnTools.push(name);
    }

    if (type === 'skill' && name === 'skill_inject') {
      this.#turnSkills = metadata?.skills ?? [];
    }

    if (type === 'thinking' && name === 'llm_call' && status === 'done') {
      if (metadata?.usage) this.#turnTokens = metadata.usage;
    }
  }

  async #ask(question) {
    this.#turnTools = [];
    this.#turnSkills = [];
    this.#turnTokens = null;

    this.#spin = UI.spinner('thinking');
    this.#spin.start();
    let answer;
    try {
      answer = await this.#agent.ask(question);
    } catch (err) {
      this.#spin.stop();
      this.#spin = null;
      process.stdout.write(c.red('✖ ') + (err?.message || String(err)) + '\n');
      if (this.#verbose && err?.stack) process.stdout.write(c.dim(err.stack) + '\n');
      return;
    }
    this.#spin.stop();
    this.#spin = null;

    const raw = (answer ?? '').trim();
    const text = raw ? UI.renderMarkdown(raw) : c.dim('(no response)');
    process.stdout.write(UI.label.agent() + '  ' + text + '\n');

    UI.renderTurnStats({
      tools: this.#turnTools,
      skills: this.#turnSkills,
      tokens: this.#turnTokens,
    });
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

  #skillSummary() {
    const all = this.#agent.getAllSkills();
    if (!all.length) return '';
    const names = all.map((s) => c.magenta(s.name)).join(c.dim(', '));
    return c.dim('  skills: ') + names + '\n';
  }

  #listSkills() {
    const all = this.#agent.getAllSkills();
    if (!all.length) return c.dim('  no skills loaded') + '\n';
    return (
      all
        .map((s) => {
          const tag = s.strategy === 'dynamic' ? c.dim(' [dynamic]') : c.dim(' [fixed]');
          return '  ' + c.magenta(s.name) + tag + c.dim(' — ' + s.description);
        })
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
      case '/skills':
        process.stdout.write(this.#listSkills() + '\n');
        break;
      default:
        process.stdout.write(
          c.red('  unknown command: ') + input + c.dim('  (try /help)') + '\n\n'
        );
    }
    this.#rl.prompt();
  }

  async #handleLine(line) {
    const input = line.trim();
    if (!input) return this.#rl.prompt();

    if (input.startsWith('/')) {
      return this.#handleCommand(input);
    }

    this.#busy = true;
    this.#rl.pause();
    process.stdout.write('\n');
    await this.#ask(input);
    process.stdout.write(UI.rule() + '\n');
    this.#busy = false;
    this.#rl.resume();
    this.#rl.prompt();
  }

  async #waitForMcp() {
    const servers = this.#agent.mcpServers;
    if (!servers.length) return;
    const spin = UI.spinner(`connecting ${servers.length} MCP server(s)`);
    spin.start();
    await this.#agent.waitForMcp();
    spin.stop();
  }

  async runOneShot(question) {
    await this.#waitForMcp();
    await this.#ask(question);
    await this.#agent.close();
    process.exit(0);
  }

  async runRepl() {
    UI.printBanner({ model: this.#agent.model });
    await this.#waitForMcp();
    process.stdout.write(this.#mcpSummary() + this.#skillSummary() + '\n');

    this.#rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: UI.label.you() + c.dim(' › '),
    });

    this.#rl.prompt();

    this.#rl.on('line', (line) => {
      if (this.#busy) return;
      this.#handleLine(line);
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

const cli = new CLI(verbose);

let agent;
try {
  agent = new Agent({ verbose, onTrace: (e) => cli.handleTrace(e) });
} catch (err) {
  process.stderr.write('\n' + c.red('✖ ') + err.message + '\n\n');
  process.exit(1);
}

cli.setAgent(agent);

if (oneShot) {
  await cli.runOneShot(oneShot);
} else {
  await cli.runRepl();
}
