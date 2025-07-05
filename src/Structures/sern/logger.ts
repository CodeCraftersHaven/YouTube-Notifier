import type { Logging, LogPayload } from '@sern/handler';
import { Logger, type LogLevel, type LogStyle } from '@spark.ts/logger';
import { bold, italic } from 'colorette';

export class Sparky implements Logging {
  private _spark!: Logger;
  private _date!: Date;
  constructor(logLevel: LogLevel, logStyle: LogStyle) {
    console.clear();
    this._spark = new Logger({ logLevel, logStyle });
    this._date = new Date();
  }

  public warn = this.warning;

  success(payload: LogPayload<unknown> | any) {
    payload = payload.message || { payload }.payload;
    let entry = bold(italic(this._date.toISOString() + ' => ' + payload));
    this._spark.success(entry);
  }
  info(payload: LogPayload<unknown> | any): void {
    payload = payload.message || { payload }.payload;
    let entry = bold(italic(this._date.toISOString() + ' => ' + payload))
    this._spark.info(entry);
  }
  warning(payload: LogPayload<unknown> | any): void {
    payload = payload.message || { payload }.payload;
    let entry =bold(italic(this._date.toISOString() + ' => ' + payload))
    this._spark.warn(entry);
  }
  debug(payload: LogPayload<unknown> | any): void {
    payload = payload.message || { payload }.payload;
    let entry =bold(italic(this._date.toISOString() + ' => ' + payload))
    this._spark.debug(entry);
  }
  error(payload: LogPayload<unknown> | any): void {
    payload = payload.message || { payload }.payload;
    let entry = bold(italic(this._date.toISOString() + ' => ' + payload))
    this._spark.error(entry);
  }
}
