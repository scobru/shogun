import { IGunChainReference } from "./types/chain";
import { IGunSubscription, GunSubscriptionCallback, IGunSubscriptionOptions } from "./types";
/**
 * Subscribe to a Gun node `ref` and return
 * a subscription.
 *
 * Unsubscribes automatically on uncaught errors
 * inside the callback and rethrows.
 *
 * **Why not just use `ref.on()`?**
 *
 * Calling `ref.off()` unsubscribes all listeners,
 * not just the last one. This method provides a
 * way to unsubscribe only a single listener inline.
 *
 * *It is only possible to unsubscribe once the internal `on()` callback
 * has been fired once. See [issue](https://github.com/amark/gun/issues/713).*
 * @param ref
 */
export declare function subscribe<T = any>(ref: IGunChainReference<T>, callback: GunSubscriptionCallback<T>, opt?: IGunSubscriptionOptions): IGunSubscription;
