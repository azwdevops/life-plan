import type { ExpressionNode, FormulaOperator } from "./types";

type ParserSuccess = {
  ok: true;
  tree: ExpressionNode;
};

type ParserFailure = {
  ok: false;
  message: string;
};

type ParserResult = ParserSuccess | ParserFailure;

type Token = {
  type: "number" | "variable" | "operator" | "lparen" | "rparen";
  value: string;
};

const PRECEDENCE: Record<FormulaOperator, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

function tokenize(expression: string): ParserResult & { tokens?: Token[] } {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch });
      i += 1;
      continue;
    }
    if (/[+\-*/]/.test(ch)) {
      tokens.push({ type: "operator", value: ch });
      i += 1;
      continue;
    }
    if (ch === "@") {
      const start = i;
      i += 1;
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) i += 1;
      const value = expression.slice(start, i);
      if (value.length <= 1) {
        return { ok: false, message: "Variable token missing after @." };
      }
      tokens.push({ type: "variable", value });
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      let dots = 0;
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        if (expression[i] === ".") dots += 1;
        i += 1;
      }
      const value = expression.slice(start, i);
      if (dots > 1 || Number.isNaN(Number(value))) {
        return { ok: false, message: `Invalid number: ${value}` };
      }
      tokens.push({ type: "number", value });
      continue;
    }
    return { ok: false, message: `Unsupported token: ${ch}` };
  }

  if (tokens.length === 0) {
    return { ok: false, message: "Formula cannot be empty." };
  }
  return { ok: true, tree: { type: "constant", value: 0 }, tokens };
}

function toRpn(tokens: Token[]): ParserResult & { rpn?: Token[] } {
  const output: Token[] = [];
  const ops: Token[] = [];

  for (const token of tokens) {
    if (token.type === "number" || token.type === "variable") {
      output.push(token);
      continue;
    }
    if (token.type === "operator") {
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.type !== "operator") break;
        const a = PRECEDENCE[token.value as FormulaOperator];
        const b = PRECEDENCE[top.value as FormulaOperator];
        if (b >= a) output.push(ops.pop() as Token);
        else break;
      }
      ops.push(token);
      continue;
    }
    if (token.type === "lparen") {
      ops.push(token);
      continue;
    }
    if (token.type === "rparen") {
      while (ops.length > 0 && ops[ops.length - 1].type !== "lparen") {
        output.push(ops.pop() as Token);
      }
      if (ops.length === 0) {
        return { ok: false, message: "Mismatched parentheses." };
      }
      ops.pop();
    }
  }

  while (ops.length > 0) {
    const op = ops.pop() as Token;
    if (op.type === "lparen" || op.type === "rparen") {
      return { ok: false, message: "Mismatched parentheses." };
    }
    output.push(op);
  }

  return { ok: true, tree: { type: "constant", value: 0 }, rpn: output };
}

function rpnToTree(
  rpn: Token[],
  aliasToAccountId: Record<string, string>
): ParserResult {
  const stack: ExpressionNode[] = [];

  for (const token of rpn) {
    if (token.type === "number") {
      stack.push({ type: "constant", value: Number(token.value) });
      continue;
    }
    if (token.type === "variable") {
      const alias = token.value.slice(1).toLowerCase();
      const accountId = aliasToAccountId[alias];
      if (!accountId) {
        return { ok: false, message: `Unknown variable: ${token.value}` };
      }
      stack.push({ type: "account", accountId });
      continue;
    }
    if (token.type === "operator") {
      const right = stack.pop();
      const left = stack.pop();
      if (!left || !right) {
        return { ok: false, message: "Invalid formula expression." };
      }
      stack.push({
        type: "operation",
        operator: token.value as FormulaOperator,
        left,
        right,
      });
    }
  }

  if (stack.length !== 1) {
    return { ok: false, message: "Invalid formula expression." };
  }
  return { ok: true, tree: stack[0] };
}

export function parseFormulaExpression(
  expression: string,
  aliasToAccountId: Record<string, string>
): ParserResult {
  const tokenized = tokenize(expression);
  if (!tokenized.ok || !tokenized.tokens) return tokenized;
  const rpn = toRpn(tokenized.tokens);
  if (!rpn.ok || !rpn.rpn) return rpn;
  return rpnToTree(rpn.rpn, aliasToAccountId);
}
