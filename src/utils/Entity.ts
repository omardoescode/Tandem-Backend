export abstract class Entity<State extends Record<string, any>> {
  private state: State;
  private changes = new Map<keyof State, any>();

  constructor(
    initialState: State,
    { initiallyDirty = false }: { initiallyDirty: boolean } = {
      initiallyDirty: false,
    },
  ) {
    this.state = { ...initialState };
    if (initiallyDirty) {
      for (const key of Object.keys(initialState) as (keyof State)[]) {
        this.changes.set(key, initialState[key]);
      }
    }
  }

  public get<K extends keyof State>(key: K): State[K] {
    return this.changes.has(key) ? this.changes.get(key) : this.state[key];
  }

  public set<K extends keyof State>(key: K, value: State[K]) {
    const original = this.state[key];
    if (value === original) {
      this.changes.delete(key);
    } else {
      this.changes.set(key, value);
    }
  }

  public isDirty() {
    return this.changes.size > 0;
  }

  public getChanges(): Partial<State> {
    return Object.fromEntries(this.changes) as Partial<State>;
  }

  public commit() {
    for (const [key, value] of this.changes) {
      this.state[key] = value;
    }
    this.changes.clear();
  }

  public rollback() {
    this.changes.clear();
  }

  public getCommittedState() {
    return this.state;
  }
}
