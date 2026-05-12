export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number
  ) {
    super(`Parse error at line ${line}, col ${col}: ${message}`)
    this.name = 'ParseError'
  }
}
