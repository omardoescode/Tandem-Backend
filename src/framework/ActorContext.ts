import type { Actor, ActorMessage } from "./Actor";
import { ActorRef } from "./ActorRef";
import { SpawningError } from "./Errors";

export default abstract class ActorContext<MessageType extends ActorMessage> {
  public abstract readonly actor_category: `${string}`;
  private refs = new Map<string, ActorRef<MessageType>>();
  private actors = new Map<string, Promise<Actor<MessageType>>>();

  public spawn(
    id: string,
  ): ActorRef<MessageType> | Promise<ActorRef<MessageType>> {
    if (this.actors.has(id)) {
      throw new SpawningError(this.actor_category.toLowerCase(), id);
    }

    const actorPromise = Promise.resolve(this.create_actor(id)).then(
      (actor) => {
        actor.start();
        return actor;
      },
    );

    this.actors.set(id, actorPromise);

    const ref = this.get_or_create_ref(id);
    return ref;
  }

  public get_ref(id: string): ActorRef<MessageType> {
    return this.get_or_create_ref(id);
  }

  public get_actor(id: string): Promise<Actor<MessageType>> {
    const exists = this.actors.get(id);
    if (exists) return exists;

    const actorPromise = Promise.resolve(this.create_actor(id)).then(
      (actor) => {
        actor.start();
        return actor;
      },
    );

    this.actors.set(id, actorPromise);
    this.get_or_create_ref(id);
    return actorPromise;
  }

  public async ensure(id: string): Promise<ActorRef<MessageType>> {
    if (!this.actors.has(id)) {
      await this.spawn(id);
    }
    return this.get_ref(id);
  }

  public async stop(id: string) {
    const actorPromise = this.actors.get(id);
    if (!actorPromise) {
      this.refs.delete(id); // delete the reference in case it exists
      return;
    }

    const actor = await actorPromise;
    actor.stop();
    this.actors.delete(id);
    this.refs.delete(id);
  }

  private get_or_create_ref(id: string): ActorRef<MessageType> {
    let ref = this.refs.get(id);
    if (!ref) {
      ref = new ActorRef<MessageType>(this, id);
      this.refs.set(id, ref);
    }
    return ref;
  }

  protected abstract create_actor(id: string): Actor<MessageType>;
}
