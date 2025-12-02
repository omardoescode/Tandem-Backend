/* eslint-disable @typescript-eslint/no-explicit-any */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type UnionOmit<T, K extends keyof any> = Prettify<
  T extends any ? Omit<T, K> : never
>;
