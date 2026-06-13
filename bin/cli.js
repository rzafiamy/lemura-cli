#!/usr/bin/env node
import 'dotenv/config';
import readline from 'node:readline';
import { Agent } from '../src/agent.js';
import { UI, c } from '../src/ui.js';

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
    this.sessionPermission = null; // 'always' | 'deny_all' | null
  }

  setAgent(agent) {
    this.#agent = agent;
  }

  pauseSpinner() {
    if (this.#spin) this.#spin.stop();
  }

  resumeSpinner() {
    if (this.#spin) this.#spin.start();
  }

  getRl() {
    return this.#rl;
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
    const startTime = Date.now();
    let answer;
    try {
      answer = await this.#agent.ask(question);
    } catch (err) {
      this.#spin.stop();
      this.#spin = null;
      process.stdout.write('\n  ' + c.red('✖ Error: ') + c.white(err?.message || String(err)) + '\n');
      if (this.#verbose && err?.stack) {
        process.stdout.write('\n' + c.dim(err.stack.split('\n').map(l => '    ' + l).join('\n')) + '\n');
      }
      process.stdout.write('\n');
      return;
    }
    this.#spin.stop();
    this.#spin = null;

    const duration = (Date.now() - startTime) / 1000;
    const raw = (answer ?? '').trim();
    const text = raw ? UI.renderMarkdown(raw) : c.dim('  (no response)');
    
    process.stdout.write('\n' + UI.label.agent() + '\n' + text + '\n');

    UI.renderTurnStats({
      tools: this.#turnTools,
      skills: this.#turnSkills,
      tokens: this.#turnTokens,
      duration,
    });
  }

  #mcpSummary() {
    const servers = this.#agent.mcpServers;
    if (!servers.length) {
      return UI.panel('MCP SERVER STATUS', [
        c.dim('No MCP servers configured — edit mcp.json to add servers.')
      ]);
    }

    const builtIns = new Set(['get_current_time', 'calculate']);
    const mcpToolCount = this.#agent.getAllTools().filter((t) => !builtIns.has(t.name)).length;
    
    const lines = [];
    lines.push(
      c.green('● ') + c.white(`${servers.length} server(s) active`) + c.dim(` (exposing ${mcpToolCount} tools)`)
    );
    lines.push('');
    for (const server of servers) {
      lines.push(
        `  ${c.cyan('◆')} ${c.bold(server.name)} ${c.dim(`[${server.transport}]`)}`
      );
    }
    return UI.panel('MCP SERVERS', lines);
  }

  #listTools() {
    const all = this.#agent.getAllTools();
    if (!all.length) {
      return UI.panel('REGISTERED TOOLS', [c.dim('No tools registered')]);
    }
    const lines = all.map(t => {
      const desc = (t.description || '').split('\n')[0];
      const descCut = desc.length > 42 ? desc.slice(0, 39) + '...' : desc;
      return ` ${c.cyan('⚙ ' + t.name.padEnd(18))} ${c.dim('—')} ${c.white(descCut)}`;
    });
    return UI.panel('REGISTERED TOOLS', lines);
  }

  #printStatus() {
    const servers = this.#agent.mcpServers;
    const mcpText = servers.length 
      ? c.green('● ') + c.white(`${servers.length} MCP server(s) active`) + c.dim(` [${servers.map(s => s.name).join(', ')}]`)
      : c.dim('○ No MCP servers connected');
      
    const skills = this.#agent.getAllSkills();
    const skillsText = skills.length
      ? c.magenta('● ') + c.white(`${skills.length} skill(s) loaded`) + c.dim(` [${skills.map(s => s.name).join(', ')}]`)
      : c.dim('○ No skills loaded');
      
    process.stdout.write('  ' + mcpText + '\n');
    process.stdout.write('  ' + skillsText + '\n\n');
  }

  #listSkills() {
    const all = this.#agent.getAllSkills();
    if (!all.length) {
      return UI.panel('LOADED SKILLS', [c.dim('No skills loaded')]);
    }
    const lines = all.map(s => {
      const tag = s.strategy === 'dynamic' ? c.yellow('dynamic') : c.blue('fixed');
      const desc = s.description.length > 42 ? s.description.slice(0, 39) + '...' : s.description;
      return ` ${c.magenta('⌘ ' + s.name.padEnd(14))} ${c.dim(`[${tag}]`)} ${c.dim('—')} ${c.white(desc)}`;
    });
    return UI.panel('LOADED SKILLS', lines);
  }

  async #handleCommand(input) {
    switch (input.toLowerCase()) {
      case '/exit':
      case '/quit':
        return this.#rl.close();
      case '/help':
        process.stdout.write(UI.getHelpPanel() + '\n\n');
        break;
      case '/clear':
        process.stdout.write('\x1b[2J\x1b[H');
        UI.printBanner({ model: this.#agent.model });
        this.#printStatus();
        break;
      case '/model':
        process.stdout.write('  ' + c.cyan('🤖 Active Model:') + ' ' + c.white(this.#agent.model) + '\n\n');
        break;
      case '/mcp':
        process.stdout.write(this.#mcpSummary() + '\n\n');
        break;
      case '/tools':
        process.stdout.write(this.#listTools() + '\n\n');
        break;
      case '/skills':
        process.stdout.write(this.#listSkills() + '\n\n');
        break;
      default:
        process.stdout.write(
          '  ' + c.red('✖ Unknown command: ') + c.white(input) + c.dim(' (try /help)') + '\n\n'
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
    await this.#ask(input);
    process.stdout.write('  ' + UI.rule() + '\n\n');
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
    this.#printStatus();

    this.#rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '  ' + UI.label.you() + c.dim(' › '),
    });

    this.#rl.prompt();

    this.#rl.on('line', (line) => {
      if (this.#busy) return;
      this.#handleLine(line);
    });

    this.#rl.on('close', async () => {
      process.stdout.write('\n  ' + c.gradient('Goodbye! ✦', [168, 85, 247], [56, 189, 248]) + '\n\n');
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
  agent = new Agent({
    verbose,
    onTrace: (e) => cli.handleTrace(e),
    onAsk: async (toolName, argsJson) => {
      if (cli.sessionPermission === 'always') return 'accept';
      if (cli.sessionPermission === 'deny_all') return 'deny';

      cli.pauseSpinner();
      const rl = cli.getRl();
      if (rl) rl.resume();

      const decision = await UI.promptPermission(toolName, argsJson, rl);

      if (rl) rl.pause();
      cli.resumeSpinner();

      if (decision === 'always') {
        cli.sessionPermission = 'always';
        return 'accept';
      }
      if (decision === 'deny_all') {
        cli.sessionPermission = 'deny_all';
        return 'deny';
      }
      return decision ? 'accept' : 'deny';
    }
  });
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
