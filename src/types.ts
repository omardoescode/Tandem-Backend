import type { QueryArrayConfig, QueryArrayResult } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type UnionOmit<T, K extends keyof any> = Prettify<
  T extends any ? Omit<T, K> : never
>;

export interface Client {
  query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export type KeysWithType<T, L> = {
  [K in keyof T]: T[K] extends L ? K : never;
}[keyof T];

export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};
