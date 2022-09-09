import tls, { type TLSSocket } from 'tls';
import type { BufferEncoding } from './types';
import { EventEmitter } from 'events';

export class TlsSocketWrapper extends EventEmitter {
  private _socket: TLSSocket | null;
  private _timeout: number;
  private _encoding: BufferEncoding;
  private _keepAliveEneblad: boolean;
  private _keepAliveinitialDelay: number;
  private _noDelay: boolean;

  constructor() {
    super();
    this._socket = null;
    this._timeout = 5000;
    this._encoding = 'utf8';
    this._keepAliveEneblad = true;
    this._keepAliveinitialDelay = 0;
    this._noDelay = true;
  }

  setTimeout(timeout: number) {
    if (this._socket) {
      this._socket.setTimeout(timeout);
    }
    this._timeout = timeout;
  }

  setEncoding(encoding: BufferEncoding) {
    if (this._socket) {
      this._socket.setEncoding(encoding);
    }
    this._encoding = encoding;
  }

  setKeepAlive(enabled: boolean, initialDelay: number) {
    if (this._socket) {
      this._socket.setKeepAlive(enabled, initialDelay);
    }
    this._keepAliveEneblad = enabled;
    this._keepAliveinitialDelay = initialDelay;
  }

  setNoDelay(noDelay: boolean) {
    if (this._socket) {
      this._socket.setNoDelay(noDelay);
    }
    this._noDelay = noDelay;
  }

  connect(port: number, host: string, callback: () => void) {
    this._socket = tls.connect(
      { port, host, rejectUnauthorized: false },
      () => {
        callback();
      }
    );

    this._socket.setTimeout(this._timeout);
    this._socket.setEncoding(this._encoding);
    this._socket.setKeepAlive(
      this._keepAliveEneblad,
      this._keepAliveinitialDelay
    );
    this._socket.setNoDelay(this._noDelay);

    this._socket.on('data', (data) => {
      this.emit('data', data);
    });
    this._socket.on('error', (data) => {
      this.emit('error', data);
    });
    this._socket.on('close', (data) => {
      this.emit('close', data);
    });
    this._socket.on('connect', (data) => {
      this.emit('connect', data);
    });
    this._socket.on('connection', (data) => {
      this.emit('connection', data);
    });
  }

  end() {
    if (this._socket) {
      this._socket.end();
    }
  }

  destroy() {
    if (this._socket) {
      this._socket.destroy();
    }
  }

  write(data: Uint8Array | string) {
    if (this._socket) {
      this._socket.write(data);
    }
  }
}
