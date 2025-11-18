import { UnwrappingError } from "./errors";

export default abstract class Result<T, E extends Error = Error> {
  abstract isOk(): this is ok<T, E>;
  abstract isErr(): this is err<T, E>;
  abstract unwrap(): T;
  abstract unwrapErr(): E;
  abstract map<U>(fn: (value: T) => U): Result<U, E>;
  abstract safeMap<U, F extends Error>(
    fn: (value: T) => U,
    errFactory: () => F,
  ): Result<U, E | F>;
  abstract mapErr<U extends Error>(fn: (err: E) => U): Result<T, U>;
  abstract bind<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  abstract safeBind<U, F extends Error>(
    fn: (value: T) => Result<U, E>,
    err: () => F,
  ): Result<U, E | F>;
  abstract ensure<F extends Error>(
    predicate: (value: T) => boolean,
    err: () => F,
  ): Result<T, E | F>;
  abstract match<TD, ED>(matcher: {
    ifOk: (value: T) => TD;
    ifErr: (error: E) => ED;
  }): TD | ED;
  abstract orElse(defaultValue: T): Result<T, E>;
  abstract tap(matcher: {
    ifOk?: (value: T) => void;
    ifErr: (error: E) => void;
  }): Result<T, E>;

  static from<T>(fn: () => T): Result<T> {
    try {
      const value = fn();
      return new ok(value);
    } catch (error) {
      return new err(error instanceof Error ? error : Error(String(error)));
    }
  }

  static async fromAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
    try {
      const value = await fn();
      return new ok(value);
    } catch (error) {
      return new err(error instanceof Error ? error : Error(String(error)));
    }
  }
}

export function Ok<T, E extends Error = Error>(value: T): Result<T, E> {
  return new ok(value);
}

export function Err<T, E extends Error = Error>(error: E): Result<T, E> {
  return new err(error);
}

class ok<T, E extends Error> extends Result<T, E> {
  private value: T;

  constructor(value: T) {
    super();
    this.value = value;
  }

  isOk(): this is ok<T, E> {
    return true;
  }
  isErr(): this is err<T, E> {
    return false;
  }

  unwrap(): T {
    return this.value;
  }
  unwrapErr(): E {
    throw new UnwrappingError("Unwrapping an error from an Ok value");
  }
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new ok(fn(this.value));
  }
  safeMap<U, F extends Error>(
    fn: (value: T) => U,
    errFactory: () => F,
  ): Result<U, F> {
    try {
      return Ok(fn(this.value));
    } catch {
      return Err(errFactory());
    }
  }

  mapErr<U extends Error>(): Result<T, U> {
    return new ok(this.value);
  }
  bind<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }
  safeBind<U, F extends Error>(
    fn: (value: T) => Result<U, E>,
    errFactory: () => F,
  ): Result<U, E | F> {
    try {
      return fn(this.value);
    } catch {
      return Err(errFactory());
    }
  }
  ensure<F extends Error>(
    predicate: (value: T) => boolean,
    errFactory: () => F,
  ): Result<T, F> {
    if (!predicate(this.value)) return new err(errFactory());
    return new ok(this.value);
  }

  match<D>({ ifOk }: { ifOk: (value: T) => D }): D {
    return ifOk(this.value);
  }
  orElse(): Result<T, E> {
    return this;
  }

  tap({ ifOk }: { ifOk?: (value: T) => void }) {
    if (ifOk) ifOk(this.value);
    return this;
  }
}

class err<T, E extends Error> extends Result<T, E> {
  private err: E;

  constructor(err: E) {
    super();
    this.err = err;
  }

  isOk(): this is ok<T, E> {
    return false;
  }

  isErr(): this is err<T, E> {
    return true;
  }

  unwrap(): T {
    throw new UnwrappingError("Unwrapping an Ok value from an error");
  }
  unwrapErr(): E {
    return this.err;
  }
  map<U>(): Result<U, E> {
    return new err(this.err);
  }
  safeMap<U>(): Result<U, E> {
    return Err(this.err);
  }
  mapErr<U extends Error>(fn: (err: E) => U): Result<T, U> {
    return new err(fn(this.err));
  }

  bind<U>(): Result<U, E> {
    return new err(this.err);
  }

  ensure(): Result<T, E> {
    return new err(this.err);
  }

  match<D>({ ifErr }: { ifErr: (error: E) => D }): D {
    return ifErr(this.err);
  }

  orElse(defaultValue: T): Result<T, E> {
    return Ok(defaultValue);
  }

  tap({ ifErr }: { ifErr?: (err: E) => void }) {
    if (ifErr) ifErr(this.err);
    return this;
  }

  safeBind<U>(): Result<U, E> {
    return Err(this.unwrapErr());
  }
}
