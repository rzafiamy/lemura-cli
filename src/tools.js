// A small set of safe, useful tools for the agent to call via lemura's ReAct loop.
// Each follows lemura's IToolDefinition shape: { name, description, parameters, execute }.

/** Current date & time — grounds the model in "now". */
export const getTime = {
  name: 'get_current_time',
  description:
    'Get the current date and time. Use whenever the user asks about today, now, or anything time-relative.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'IANA timezone, e.g. "Europe/Paris". Defaults to the local timezone.',
      },
    },
    required: [],
  },
  execute: async ({ timezone } = {}) => {
    try {
      const now = new Date();
      const opts = {
        dateStyle: 'full',
        timeStyle: 'long',
        ...(timezone ? { timeZone: timezone } : {}),
      };
      return new Intl.DateTimeFormat('en-US', opts).format(now);
    } catch {
      return `Invalid timezone "${timezone}". Current UTC time is ${new Date().toISOString()}.`;
    }
  },
};

/** Safe arithmetic evaluator — no eval, just a tiny shunting-yard calculator. */
export const calculate = {
  name: 'calculate',
  description:
    'Evaluate a basic arithmetic expression (+, -, *, /, %, parentheses). Use for any math.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The arithmetic expression, e.g. "(3 + 4) * 2 / 7".',
      },
    },
    required: ['expression'],
  },
  execute: async ({ expression }) => {
    const result = evalArithmetic(expression);
    return `${expression} = ${result}`;
  },
};

// --- safe arithmetic (no eval) -------------------------------------------------
function evalArithmetic(expr) {
  const tokens = expr.match(/(\d+\.?\d*|[()+\-*/%])/g);
  if (!tokens) throw new Error('No valid tokens in expression');

  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };
  const output = [];
  const ops = [];
  const apply = () => {
    const op = ops.pop();
    const b = output.pop();
    const a = output.pop();
    switch (op) {
      case '+': return output.push(a + b);
      case '-': return output.push(a - b);
      case '*': return output.push(a * b);
      case '/': return output.push(a / b);
      case '%': return output.push(a % b);
      default: throw new Error(`Unknown operator ${op}`);
    }
  };

  for (const t of tokens) {
    if (/^\d/.test(t)) output.push(parseFloat(t));
    else if (t === '(') ops.push(t);
    else if (t === ')') {
      while (ops.length && ops.at(-1) !== '(') apply();
      ops.pop();
    } else {
      while (ops.length && prec[ops.at(-1)] >= prec[t]) apply();
      ops.push(t);
    }
  }
  while (ops.length) apply();
  if (output.length !== 1 || Number.isNaN(output[0])) throw new Error('Malformed expression');
  return output[0];
}

export const tools = [getTime, calculate];
