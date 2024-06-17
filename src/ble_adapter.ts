import { Logging } from 'homebridge';

import noble from '@abandonware/noble';

const BLE_SERVICE_UUID = 'fe60';
const BLE_WRITER_UUID = 'fe61';
const BLE_NOTIFIER_UUID = 'fe62';
const DISCOVERY_TIMEOUT = 10000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class BluetoothAdapter {
  private peripheral?: noble.Peripheral;
  private service?: noble.Service;
  private writer?: noble.Characteristic;
  private notifier?: noble.Characteristic;

  private ready = false;

  constructor(
    private readonly deviceName: string,
    private readonly logger: Logging,
  ) {

  }

  isReady() {
    return this.ready;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      if (noble._state === 'poweredOn') {
        return resolve(true);
      }

      noble.once('stateChange', state => {
        if (state === 'poweredOn') {
          return resolve(true);
        } else {
          return reject(`invalid noble state (${state})`);
        }
      });
    });
  }

  async startDiscovery() {
    try {
      await this.initialize();
      noble.on('discover', peripheral => this.handlePeripheral(peripheral));

      const timeout = sleep(DISCOVERY_TIMEOUT);
      const scanStop = new Promise(resolve => {
        noble.once('scanStop', () => {
          resolve(true);
        });
      });

      await noble.startScanningAsync([BLE_SERVICE_UUID], false);
      await Promise.race([timeout, scanStop]);
    } catch (error) {
      this.logger.error(`bluetooth discovered failed: ${error}`);
    } finally {
      await this.stopDiscovery();
    }
  }

  async handlePeripheral(peripheral: noble.Peripheral) {
    if (peripheral.advertisement.localName !== this.deviceName) {
      return;
    }

    this.peripheral = peripheral;
    this.logger.success(`BLE device found: ${this.deviceName}`);

    try {
      await this.peripheral.connectAsync();
      await this.findService();
      await this.findCharacteristics();

      this.ready = true;
    } catch (error) {
      this.logger.error(`BLE device setup failed: ${error}`);
    } finally {
      await this.stopDiscovery();
    }
  }

  async findService() {
    if (!this.peripheral) {
      throw new Error('BLE peripheral is not configured');
    }

    const services = await this.peripheral.discoverServicesAsync([BLE_SERVICE_UUID]);
    for (const service of services) {
      if (service.uuid === BLE_SERVICE_UUID) {
        this.service = service;
      }
    }

    if (!this.service) {
      throw new Error('BLE service not found');
    }
  }

  async findCharacteristics() {
    if (!this.service) {
      throw new Error('BLE service is not configured');
    }

    const characteristics = await this.service.discoverCharacteristicsAsync([BLE_WRITER_UUID, BLE_NOTIFIER_UUID]);
    for (const characteristic of characteristics) {
      if (characteristic.uuid === BLE_WRITER_UUID) {
        this.writer = characteristic;
      } else if (characteristic.uuid === BLE_NOTIFIER_UUID) {
        this.notifier = characteristic;
      }
    }

    if (!this.writer) {
      throw new Error('BLE writer characteristic not found');
    }

    if (!this.notifier) {
      throw new Error('BLE notifier characteristic not found');
    }
  }

  async stopDiscovery() {
    noble.removeAllListeners('discover');
    await noble.stopScanningAsync();
  }

  move(height_in_mm: number) {
    height_in_mm = Math.round(height_in_mm);
    const height_in_hex = this.dec_to_hex(height_in_mm);
    const checksum_hex = this.checksum(height_in_hex);

    const full_hex = `f1f1 1b02 ${height_in_hex} ${checksum_hex} 7e`;
    this.logger.debug(`calculated hex for ${height_in_mm} mm: ${full_hex}`);
    this.writer?.write(this.buffer(full_hex), false);
  }

  dec_to_hex(num: number) {
    return this.pad_hex(num.toString(16));
  }

  checksum(height_hex: string) {
    // get the sum of the two command bytes and the two value bytes
    const buffer = this.buffer(height_hex);
    const sum = 0x1b + 0x02 + buffer[0] + buffer[1];

    // take the last byte of that sum
    const instruction_hex = sum.toString(16);
    const last = this.buffer(instruction_hex).slice(-1)[0];

    return this.pad_hex(last.toString(16));
  }

  buffer(hex: string) {
    hex = hex.replace(/ /g, '');
    return Buffer.from(this.pad_hex(hex), 'hex');
  }

  pad_hex(hex: string) {
    if (hex.length % 2 === 1) {
      hex = `0${hex}`;
    }

    return hex;
  }
}