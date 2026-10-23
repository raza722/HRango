/**
 * Evaluates a pay item / formula expression such as
 * `{gross_salary} / {applicable_days} * {absent_days}`: numbers, `{variables}`,
 * + - * / and brackets. A variable the run does not know is a text value, so
 * using it in arithmetic fails the way the design's error does
 * ("Unsupported Operand Types String * Float").
 */
export class ExpressionError extends Error {}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' }
  | { kind: 'open' }
  | { kind: 'close' }

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < expression.length) {
    const char = expression.charAt(index)
    if (/\s/.test(char)) {
      index += 1
    } else if (/[\d.]/.test(char)) {
      const match = /^\d*\.?\d+/.exec(expression.slice(index))
      if (!match) throw new ExpressionError(`Unexpected "${char}"`)
      tokens.push({ kind: 'number', value: Number(match[0]) })
      index += match[0].length
    } else if (char === '{') {
      const end = expression.indexOf('}', index)
      if (end === -1) throw new ExpressionError('A { has no closing }')
      tokens.push({
        kind: 'variable',
        name: expression
          .slice(index + 1, end)
          .trim()
          .toLowerCase(),
      })
      index = end + 1
    } else if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ kind: 'operator', value: char })
      index += 1
    } else if (char === '(') {
      tokens.push({ kind: 'open' })
      index += 1
    } else if (char === ')') {
      tokens.push({ kind: 'close' })
      index += 1
    } else {
      throw new ExpressionError(`Unexpected "${char}"`)
    }
  }
  return tokens
}

/** A known number, or the name of a variable the run could not supply. */
type Value = number | { text: string }

const operand = (value: Value) => (typeof value === 'number' ? 'Float' : 'String')

function apply(operator: '+' | '-' | '*' | '/', left: Value, right: Value): number {
  if (typeof left !== 'number' || typeof right !== 'number') {
    throw new ExpressionError(
      `Unsupported Operand Types ${operand(left)} ${operator} ${operand(right)}`,
    )
  }
  if (operator === '+') return left + right
  if (operator === '-') return left - right
  if (operator === '*') return left * right
  return right === 0 ? 0 : left / right
}

export function evaluate(expression: string, variables: Readonly<Record<string, number>>): number {
  const tokens = tokenize(expression)
  if (tokens.length === 0) return 0
  let position = 0
  const peek = () => tokens[position]

  const primary = (): Value => {
    const token = tokens[position]
    position += 1
    if (!token) throw new ExpressionError('The expression ends too early')
    if (token.kind === 'number') return token.value
    if (token.kind === 'variable') {
      const value = variables[token.name]
      return value ?? { text: token.name }
    }
    if (token.kind === 'open') {
      const value = sum()
      if (peek()?.kind !== 'close') throw new ExpressionError('A ( has no closing )')
      position += 1
      return value
    }
    if (token.kind === 'operator' && token.value === '-') {
      const value = primary()
      return apply('*', -1, value)
    }
    throw new ExpressionError('Unexpected operator')
  }

  const product = (): Value => {
    let left = primary()
    for (
      let token = peek();
      token?.kind === 'operator' && (token.value === '*' || token.value === '/');
      token = peek()
    ) {
      position += 1
      left = apply(token.value, left, primary())
    }
    return left
  }

  const sum = (): Value => {
    let left = product()
    for (
      let token = peek();
      token?.kind === 'operator' && (token.value === '+' || token.value === '-');
      token = peek()
    ) {
      position += 1
      left = apply(token.value, left, product())
    }
    return left
  }

  const result = sum()
  if (position < tokens.length) throw new ExpressionError('Unexpected text after the expression')
  if (typeof result !== 'number') {
    throw new ExpressionError(`Unsupported Operand Types String * Float`)
  }
  return Number.isFinite(result) ? result : 0
}

/** Checks an expression's syntax (variables may be unknown); returns the problem, if any. */
export function expressionProblem(expression: string): string | null {
  try {
    const known = new Proxy({}, { get: () => 1 })
    evaluate(expression, known)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'The expression is not valid'
  }
}
