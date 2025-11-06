import { UnwrappingError } from "./errors";

export default abstract class Option<T> {
  abstract map<D>(fn: (value: T) => D): Option<D>;
  abstract bind<D>(fn: (value: T) => Option<D>): Option<D>;
  abstract orElse(value: T): Option<T>;
  abstract ensure(predicate: (value: T) => boolean): Option<T>;
  abstract match<SD, ND>(matcher: {
    ifSome: (value: T) => SD;
    ifNone: () => ND;
  }): SD | ND;
  abstract isSome(): this is some<T>;
  abstract isNone(): this is none<T>;
  abstract unwrap(): T;
  abstract unwrapOr(defaultValue: T): T;
  abstract unwrapOrThrow(err: () => Error): T;
  abstract tap(fn: (value: T) => void): Option<T>;

  static fromNullable<T>(fn: () => T | null | undefined): Option<T> {
    const value = fn();
    if (value === undefined || value === null) return None();
    return Some(value);
  }
}

export function Some<T>(value: T): Option<T> {
  return new some(value);
}
export function None<T>(): Option<T> {
  return none.getInstance<T>();
}

class some<T> extends Option<T> {
  private readonly value: T;
  constructor(value: T) {
    super();
    this.value = value;
  }
  map<D>(fn: (value: T) => D): Option<D> {
    return Some(fn(this.value));
  }

  isSome(): this is some<T> {
    return true;
  }
  isNone(): this is none<T> {
    return false;
  }
  bind<D>(fn: (value: T) => Option<D>): Option<D> {
    return fn(this.value);
  }

  orElse(): Option<T> {
    return this;
  }

  ensure(predicate: (value: T) => boolean): Option<T> {
    if (predicate(this.value)) return this;
    else return None();
  }
  match<D>({ ifSome }: { ifSome: (value: T) => D }) {
    return ifSome(this.value);
  }

  unwrap(): T {
    return this.value;
  }
  unwrapOr(): T {
    return this.value;
  }

  unwrapOrThrow(): T {
    return this.value;
  }

  tap(fn: (value: T) => void): Option<T> {
    fn(this.value);
    return this;
  }
}

class none<T> extends Option<T> {
  private static instance = new none();
  static getInstance<T>(): none<T> {
    return this.instance as none<T>;
  }
  private constructor() {
    super();
  }
  map<D>(): Option<D> {
    return None();
  }
  bind<D>(): Option<D> {
    return None();
  }
  orElse(): Option<T> {
    return None();
  }
  ensure(): Option<T> {
    return None();
  }
  match<D>({ ifNone }: { ifNone: () => D }) {
    return ifNone();
  }
  isSome(): this is some<T> {
    return false;
  }
  isNone(): this is none<T> {
    return true;
  }
  unwrap(): T {
    throw new UnwrappingError("Unwrapping a none value");
  }
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }
  tap(): Option<T> {
    return this;
  }
  unwrapOrThrow(err: () => Error): T {
    throw err();
  }
}
