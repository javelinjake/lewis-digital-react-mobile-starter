/**
 * A request the rules refuse: someone else's card, a duplicate in the lineup, not enough coins. The api turns it into
 * a 400 with `code`, and the app shows `message`. Anything else thrown from `core` is a bug.
 */
export class GameRuleError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'GameRuleError'
  }
}

export function isGameRuleError(error: unknown): error is GameRuleError {
  return error instanceof GameRuleError
}
