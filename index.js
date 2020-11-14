'use strict'
var Accessory, Service, Characteristic, UUIDGen

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  homebridge.registerPlatform("homebridge-sleepiq", "SleepIQ", SleepIQPlatform, true)
}

class SleepIQPlatform {

}