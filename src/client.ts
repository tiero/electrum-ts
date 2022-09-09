import net from 'net';
import { EventEmitter } from 'events';
import type { Buffer } from 'buffer';
import { TlsSocketWrapper } from './tls';
import * as helper from './helper';
import type {
  Protocol,
  Callbacks,
  ElectrumRequestBatchParams,
  ElectrumRequestParams,
} from './types';

const TIMEOUT = 5000;

export abstract class Client {
  protected subscribe: EventEmitter;

  private id: number;
  private port: number;
  private host: string;
  private callback_message_queue: Map<
    number,
    (err: Error | null, result?: any) => void
  >;

  private mp: helper.MessageParser;
  private conn: net.Socket | TlsSocketWrapper | null;
  private status: number;
  private protocol: Protocol;
  private onErrorCallback: ((e: Error) => void) | null;

  constructor(
    port: number,
    host: string,
    protocol: Protocol,
    callbacks?: Callbacks
  ) {
    this.id = 0;
    this.port = port;
    this.host = host;
    this.callback_message_queue = new Map();
    this.subscribe = new EventEmitter();
    this.mp = new helper.MessageParser(
      (body: string | undefined, n: number) => {
        this.onMessage(body, n);
      }
    );
    this.conn = null;
    this.status = 0;
    this.protocol = protocol; // saving defaults

    this.onErrorCallback =
      callbacks && callbacks.onError ? callbacks.onError : null;

    this.initSocket(protocol);
  }

  protected initSocket(protocol: Protocol = this.protocol): void {
    switch (protocol) {
      case 'tcp':
        this.conn = new net.Socket();
        break;
      case 'tls':
      case 'ssl':
        this.conn = new TlsSocketWrapper();
        break;
      default:
        throw new Error('unknown protocol');
    }

    this.conn.setTimeout(TIMEOUT);
    this.conn.setEncoding('utf8');
    this.conn.setKeepAlive(true, 0);
    this.conn.setNoDelay(true);
    this.conn.on('connect', () => {
      this.onConnect();
    });
    this.conn.on('close', () => {
      this.onClose();
    });
    this.conn.on('data', (chunk: Buffer) => {
      if (this.conn) {
        this.conn.setTimeout(0);
      }
      this.onRecv(chunk);
    });
    this.conn.on('error', (e: Error) => {
      this.onError(e);
    });
    this.status = 0;
  }

  protected request(method: string, params: ElectrumRequestParams) {
    if (this.status === 0) {
      return Promise.reject(
        new Error('Connection to server lost, please retry')
      );
    }
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const content = helper.makeRequest(method, params, id);
      this.callback_message_queue.set(
        id,
        helper.createPromiseResult(resolve, reject)
      );
      if (this.conn) {
        this.conn.write(`${content}\n`);
      }
    });
  }

  protected requestBatch(
    method: string,
    params: ElectrumRequestParams,
    secondParam: ElectrumRequestBatchParams
  ) {
    if (this.status === 0) {
      return Promise.reject(
        new Error('Connection to server lost, please retry')
      );
    }
    return new Promise((resolve, reject) => {
      const argsForCalls: Record<number, any> = {};
      const contents = [];
      for (const param of params) {
        const id = ++this.id;
        if (secondParam == null) {
          contents.push(helper.makeRequest(method, [param], id));
        } else {
          contents.push(helper.makeRequest(method, [param, secondParam], id));
        }
        argsForCalls[id] = param;
      }
      const content = `[${contents.join(',')}]`;
      this.callback_message_queue.set(
        this.id,
        helper.createPromiseResultBatch(resolve, reject, argsForCalls)
      );
      if (this.conn) {
        this.conn.write(`${content}\n`);
      }
    });
  }

  protected connect(): Promise<void> {
    if (this.conn) {
      if (this.status === 1) {
        return Promise.resolve();
      }
      this.status = 1;
      return this.connectSocket(this.conn, this.port, this.host);
    } else {
      return Promise.reject(
        new Error('There is no socket to initialize connection on.')
      );
    }
  }

  close(): void {
    if (this.status === 0) {
      return;
    }

    if (this.conn) {
      this.conn.end();
      this.conn.destroy();
    }

    this.status = 0;
  }

  private connectSocket(
    conn: net.Socket | TlsSocketWrapper,
    port: number,
    host: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const errorHandler = (e: Error) => {
        reject(e);
      };

      conn.on('error', errorHandler);

      conn.connect(port, host, () => {
        conn.removeListener('error', errorHandler);

        resolve();
      });
    });
  }

  private response(msg: any) {
    let callback;
    if (!msg.id && msg[0] && msg[0].id) {
      for (const m of msg) {
        if (m.id && this.callback_message_queue.has(m.id)) {
          callback = this.callback_message_queue.get(m.id);
          this.callback_message_queue.delete(m.id);
        }
      }
    } else {
      callback = this.callback_message_queue.get(msg.id);
    }

    if (callback) {
      this.callback_message_queue.delete(msg.id);
      if (msg.error) {
        callback(msg.error);
      } else {
        callback(null, msg.result || msg);
      }
    } else {
      throw new Error('Error getting callback while handling response');
    }
  }

  private onMessage(body: string | undefined, n: number): void {
    const msg = JSON.parse(body ? body : '');
    if (Array.isArray(msg)) {
      this.response(msg);
    } else if (msg.id == null) {
      this.subscribe.emit(msg.method, msg.params);
    } else {
      this.response(msg);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onConnect(): void {}

  protected onClose(): void {
    this.status = 0;

    for (const [key, fn] of this.callback_message_queue.entries()) {
      fn(new Error('close connect'));
      this.callback_message_queue.delete(key);
    }
  }

  protected onError(e: Error): void {
    if (this.onErrorCallback != null) {
      this.onErrorCallback(e);
    }
  }

  private onRecv(chunk: Buffer): void {
    this.mp.run(chunk);
  }
}
