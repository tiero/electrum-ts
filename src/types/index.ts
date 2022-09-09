import type { ElectrumClient } from '../index';

export type Protocol = 'ssl' | 'tcp' | 'tls';

export interface Callbacks {
  onConnect?: (client: ElectrumClient, versionInfo: [string, string]) => void;
  onClose?: (client: ElectrumClient) => void;
  onLog?: (str: string) => void;
  onError?: (e: Error) => void;
}

export interface PersistencePolicy {
  retryPeriod?: number;
  maxRetry?: number;
  pingPeriod?: number;
  callback?: (() => void) | null;
}

export interface ElectrumConfig {
  client: string;
  version: string | [string, string];
}

export type ElectrumRequestParams = Array<any[] | boolean | number | string>;

export type ElectrumRequestBatchParams = boolean | number | string | undefined;

export type BufferEncoding =
  | 'ascii'
  | 'base64'
  | 'binary'
  | 'hex'
  | 'latin1'
  | 'ucs-2'
  | 'ucs2'
  | 'utf-8'
  | 'utf8'
  | 'utf16le';
