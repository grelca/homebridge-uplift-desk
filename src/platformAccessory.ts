import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { UpliftDeskPlatform } from './platform.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class DeskHeightButton {
  private service: Service;

  constructor(
    private readonly platform: UpliftDeskPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'UPLIFT Desk')
      .setCharacteristic(this.platform.Characteristic.Model, 'Bluetooth Adapter')
      .setCharacteristic(this.platform.Characteristic.Name, accessory.context.config.label)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.UUID);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.config.label);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.platform.log.info('Set Characteristic On ->', value);
    if (!value) {
      return;
    }

    let height_in_mm;
    const height = this.accessory.context.config.value;
    const unit = this.accessory.context.config.unit;

    if (unit === 'inches') {
      height_in_mm = height * 25.4;
    } else if (unit === 'cm') {
      height_in_mm = height * 10;
    } else {
      this.platform.log.warn(`Unrecognized unit for ${this.accessory.displayName}: ${unit}`);
      return;
    }

    this.platform.bleAdapter.move(height_in_mm);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    return false;
  }
}
