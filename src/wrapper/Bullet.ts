'use strict';

import Gun from 'gun/gun';

export class Bullet {
  protected gun: any;
  protected Gun: any;
  protected _ctx: any = null;
  protected _ctxVal: any = null;
  protected _ready: boolean = true;
  protected _proxyEnable: boolean = true;

  protected immutable: boolean;
  protected _registerContext: any;
  protected rpcMethods: Map<string, Function> = new Map();
  protected rpcPeers: Map<string, any> = new Map();

  constructor(gun: any, opts?: { immutable?: boolean }) {
    this.gun = gun;
    this.Gun = (typeof window !== 'undefined') ? (window as any).Gun : Gun;

    this.immutable = opts?.immutable ?? false;

    this.Gun.on('opt', (context: any) => {
      this._registerContext = context;
      context.to.next(context);
    });
    this.gun = this.Gun(...arguments);

    this.mutate = this.mutate.bind(this);
    this.extend = this.extend.bind(this);

    return new Proxy(this, bulletProxy());
  }

  get value(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this || !this._ctx || !this._ctx.once) {
        return reject('No gun context');
      }

      this._ctx.once((data: any) => {
        let timer = setInterval(() => {
          if (this._ready) {
            resolve(data);
            clearInterval(timer);
          }
        }, 100);
      });
    });
  }

  get events(): any {
    return this._registerContext;
  }

  mutate(val?: any): void {
    if (!val && this._ctxVal) {
      this._ready = false;
      this._ctx.put(this._ctxVal, () => (this._ready = true));
    }
  }

  extend(classes: any | any[], opts?: any): void {
    this._proxyEnable = false;
    
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    
    for (let Cls of classes) {
      if (typeof Cls === 'function') {
        const instance = new Cls(this, opts, this._registerContext);
        (this as any)[instance.name] = instance;
        this._registerInstanceHooks(instance);
      }
    }
    this._proxyEnable = true;
  }

  protected _registerInstanceHooks(instance: any): void {
    if (typeof instance.events === 'object') {
      for (let event of Object.keys(instance.events)) {
        if (typeof instance.events[event] === 'function') {
          this._registerContext.on(event, instance.events[event]);
        }
      }
    }
  }

  remove(maxDepth?: number): void {
    this._ctx.once((props: any) => this._nullProps(this._ctx, props, maxDepth));
  }

  protected _nullProps(context: any, obj: any, maxDepth?: number, depth: number = 0): void {
    if (!obj) return;

    for (let key of Object.keys(obj)) {
      if (key === '_') continue;

      if (typeof obj[key] === 'string') {
        context.get(key).put(null);
      } else if (obj[key]) {
        let newContext = depth === 0 ? context.get(key) : context.back(depth).get(key);
        newContext.once((props: any) => this._nullProps(newContext, props, maxDepth, depth + 1));
      }
    }
  }

  rpc = {
    host: (peerName: string) => {
      this.rpcPeers.set(peerName, this.gun.get(peerName));
    },
    register: (procName: string, handler: Function) => {
      this.rpcMethods.set(procName, handler);
    },
    exec: (procName: string, data: any) => {
      if (this.rpcMethods.has(procName)) {
        return this.rpcMethods.get(procName)!(data);
      } else {
        console.warn(`RPC method ${procName} not found`);
      }
    },
    select: (peerName: string) => {
      return {
        exec: (procName: string, data: any) => {
          const peer = this.rpcPeers.get(peerName);
          if (peer) {
            peer.get(procName).put(data);
          } else {
            console.warn(`RPC peer ${peerName} not found`);
          }
        }
      };
    }
  };
}

function bulletProxy() {
  return {
    get(target: any, prop: string | symbol, receiver: any) {
      if (prop in target || prop === 'inspect' || prop === 'constructor' || typeof prop === 'symbol') {
        if (typeof target[prop] === 'function') {
          target[prop] = target[prop].bind(target);
        }
        return Reflect.get(target, prop, receiver);
      }

      target._ctx = new Proxy(target.gun.get(prop), bulletProxy());
      return target._ctx;
    },

    set(target: any, prop: string, receiver: any) {
      if (prop in target || !target._proxyEnable) {
        return (target as any)[prop] = receiver;
      }

      if (!target.immutable) {
        target._ready = false;
        target.gun.get(prop).put(receiver, () => (target._ready = true));
      } else {
        console.warn('You have immutable turned on; be sure to .mutate()');
        target._ctxVal = receiver;
        target._ready = true;
      }
      return target;
    },
  };
}

if (typeof window === 'undefined') {
  module.exports = Bullet;
}
