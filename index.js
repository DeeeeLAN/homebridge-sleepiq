'use strict'
var Accessory, Service, Characteristic, UUIDGen
var snapi = require('./API.js')

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  homebridge.registerPlatform("homebridge-SleepIQ", "SleepIQ", SleepNumberPlatform, true)
}

class SleepNumberPlatform {
  constructor (log, config, api) {
    this.log = log;
    
    if (!config) {
      log.warn("Ignoring SleepIQ setup because it is not configured.");
      this.disabled = true;
      return;
    }
    
    this.config = config;
    this.username = config["username"];
    this.password = config["password"];
    this.refreshTime = (config["refreshTime"] || 5) * 1000; // update values from SleepIQ every 5 seconds
    this.sendDelay = (config["sendDelay"] || 2) * 1000; // delay updating bed numbers by 2 seconds
    this.accessories = new Map();
    this.snapi = new snapi(this.username, this.password);
    this.hasFoundation = false;
    if (api) {
      this.api = api;
      
      this.api.on('didFinishLaunching', function () {
        this.log.debug("API Finished Launching");
        this.didFinishLaunching();
      }.bind(this));
    }
    
  }
  
  async didFinishLaunching () {
    await this.authenticate();
    await this.addAccessories();
    setInterval(this.fetchData.bind(this), this.refreshTime); // continue to grab data every few seconds
  }
  
  async authenticate () {
    try {
      this.log.debug('SleepIQ Authenticating...')
      await this.snapi.login((data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("Login result:", data);
        }
      });
    } catch(err) {
      this.log("Failed to authenticate with SleepIQ:",err);
    }
  }
  
  
  async addAccessories () {
    try {
      await this.snapi.familyStatus( (data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("Family Status GET results:", data);
        }
      });
    } catch(err) {
      if (typeof err === 'string' || err instanceof String)
        err = JSON.parse(err)
      if (!(err.statusCode === 401) && !(err.statusCode === 50002)) {
        this.log("Failed to retrieve family status:",JSON.stringify(err));
      }
    }
    this.snapi.json.beds.forEach( async function (bed, index) {
      let bedName = "bed" + index
      let bedID = bed.bedId
      let sides = JSON.parse(JSON.stringify(bed))
      delete sides.status
      delete sides.bedId
      
      var foundationStatus;
      try {
        await this.snapi.foundationStatus(((data, err=null) => {
          if (err) {
            this.log.debug(data, err);
          } else {
            this.log.debug("foundationStatus result:", data);
            foundationStatus = JSON.parse(data);
            if(foundationStatus.hasOwnProperty('Error')) {
              if (foundationStatus.Error.Code === 404) {
                this.log("No foundation detected");
              } else {
                this.log("Unknown error occurred when checking the foundation status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
              }
            } else {
              this.hasFoundation = true;
            }
          }
        }).bind(this));
      } catch(err) {
        if (typeof err === 'string' || err instanceof String)
          err = JSON.parse(err)
        if (!(err.statusCode === 404)) {
          this.log("Failed to retrieve foundation status:", JSON.stringify(err));
        }
      }
      
      if(!this.accessories.has(bedID+'privacy')) {
        this.log("Found Bed Privacy Switch: ", bedName);
        
        let uuid = UUIDGen.generate(bedID+'privacy');
        let bedPrivacy = new Accessory(bedName+'privacy', uuid);
        
        bedPrivacy.context.sideID = bedID+'privacy';
        bedPrivacy.context.type = 'privacy';
        
        bedPrivacy.addService(Service.Switch, bedName+'Privacy');
        
        let bedPrivacyAccessory = new snPrivacy(this.log, bedPrivacy, this.snapi);
        bedPrivacyAccessory.getServices();
        
        this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedPrivacy]);
        this.accessories.set(bedID+'privacy', bedPrivacyAccessory);
      } else {
        this.log(bedName + " privacy already added from cache");
      }
      
      const registerOccupancySensor = (sideName, sideID) => {
        this.log("Found BedSide Occupancy Sensor: ", sideName);
        
        let uuid = UUIDGen.generate(sideID+'occupancy');
        let bedSideOcc = new Accessory(sideName+'occupancy', uuid);
        
        bedSideOcc.context.sideID = sideID+'occupancy';
        bedSideOcc.context.type = 'occupancy';
        
        bedSideOcc.addService(Service.OccupancySensor, sideName+'Occupancy');
        
        let bedSideOccAccessory = new snOccupancy(this.log, bedSideOcc);
        bedSideOccAccessory.getServices();
        
        this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSideOcc]);
        this.accessories.set(sideID+'occupancy', bedSideOccAccessory);
      }
      
      Object.keys(sides).forEach( function (bedside, index) {
        try {
          let sideName = bedName+bedside
          let sideID = bedID+bedside
          if(!this.accessories.has(sideID+'occupancy')) {
            registerOccupancySensor(sideName, sideID);
          } else {
            this.log(sideName + " occupancy already added from cache");
          }
          
          if (!this.accessories.has(sideID+'number')) {
            this.log("Found BedSide Number Control: ", sideName);
            
            let uuid = UUIDGen.generate(sideID+'number');
            let bedSideNum = new Accessory(sideName+'number', uuid);
            
            bedSideNum.context.side = bedside[0].toUpperCase();
            bedSideNum.context.sideID = sideID+'number';
            bedSideNum.context.sideName = sideName;
            bedSideNum.context.type = 'number';
            
            bedSideNum.addService(Service.Lightbulb, sideName+'Number');
            let numberService = bedSideNum.getService(Service.Lightbulb, sideName+'Number');
            numberService.addCharacteristic(Characteristic.Brightness);
            
            let bedSideNumAccessory = new snNumber(this.log, bedSideNum, this.snapi);
            bedSideNumAccessory.getServices();
            
            this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSideNum])
            this.accessories.set(sideID+'number', bedSideNumAccessory);
          } else {
            this.log(sideName + " number control already added from cache");
          }
          
          if (this.hasFoundation) {
            if (!this.accessories.has(sideID+'flex')) {
              this.log("Found BedSide Flex Foundation: ", sideName);
              
              let uuid = UUIDGen.generate(sideID+'flex');
              let bedSideFlex = new Accessory(sideName+'flex', uuid);
              
              bedSideFlex.context.side = bedside[0].toUpperCase();
              bedSideFlex.context.sideID = sideID+'flex';
              bedSideFlex.context.sideName = sideName;
              bedSideFlex.context.type = 'flex';
              
              bedSideFlex.addService(Service.Lightbulb, sideName+'FlexHead', 'head')
              .addCharacteristic(Characteristic.Brightness);
              bedSideFlex.addService(Service.Lightbulb, sideName+'FlexFoot', 'foot')
              .addCharacteristic(Characteristic.Brightness);
              
              let bedSideFlexAccessory = new snFlex(this.log, bedSideFlex, this.snapi);
              bedSideFlexAccessory.getServices();
              
              this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSideFlex])
              this.accessories.set(sideID+'flex', bedSideFlexAccessory)
            } else {
              this.log(sideName + " flex foundation already added from cache")
            }
          }
        } catch (err) {
          this.log('Error when setting up bedsides:',err);
        }
        
      }.bind(this))
      
      const anySideID = bedID + "anySide";
      const anySideName = bedName + "anySide";
      if(!this.accessories.has(anySideID+'occupancy')) {
        // register 'any' side occupancy sensor
        registerOccupancySensor(anySideName, anySideID);
      } else {
        this.log(anySideName + " occupancy already added from cache");
      }
    }.bind(this))
  }
  
  removeAccessory (side) {
    this.log('Remove Accessory: ', side.accessory.displayName)
    this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [side.accessory])
    this.accessories.delete(side.accessory.context.sideID)
  }
  
  // called during setup, restores from cache (reconfigure instead of create new)
  configureAccessory (accessory) {
    if (this.disabled) {
      return false;
    }
    this.log("Configuring Cached Accessory: ", accessory.displayName, "UUID: ", accessory.UUID);
    
    if (accessory.displayName.slice(-4) === 'Side') {
      this.log("Stale accessory. Removing");
      this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [accessory]);
      return;
    }            
    
    if (Array.from(this.accessories.values()).map(a => a.accessory.displayName).includes(accessory.displayName)) {
      this.log("Duplicate accessory detected in cache: ", accessory.displayName, "If this appears incorrect, file a ticket on github. Removing duplicate accessory from cache.");
      this.log("You might need to restart homebridge to clear out the old data, especially if the accessory UUID got duplicated.");
      this.log("If the issue persists, try clearing your accessory cache.");
      this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [accessory]);
      return;
    }
    
    switch(accessory.context.type) {
      case 'occupancy':
      accessory.reachable = true;
      let bedSideOccAccessory = new snOccupancy(this.log, accessory);
      bedSideOccAccessory.getServices();
      this.accessories.set(accessory.context.sideID, bedSideOccAccessory);
      break;
      case 'number':
      accessory.reachable = true;
      let bedSideNumAccessory = new snNumber(this.log, accessory, this.snapi, this.sendDelay);
      bedSideNumAccessory.getServices();
      this.accessories.set(accessory.context.sideID, bedSideNumAccessory);
      break;
      case 'flex':
      accessory.reachable = true;
      let bedSideFlexAccessory = new snFlex(this.log, accessory, this.snapi);
      bedSideFlexAccessory.getServices();
      this.accessories.set(accessory.context.sideID, bedSideFlexAccessory);
      break;
      case 'privacy':
      accessory.reachable = true;
      let bedPrivacyAccessory = new snPrivacy(this.log, accessory, this.snapi);
      bedPrivacyAccessory.getServices();
      this.accessories.set(accessory.context.sideID, bedPrivacyAccessory);
      break;
      default:
      this.log.debug("Unknown accessory type. Removing from accessory cache.");
      this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [accessory]);
    }
  }
  
  async fetchData () {
    this.log.debug('Getting SleepIQ JSON Data...')
    var bedData;
    var flexData;
    try {
      await this.snapi.familyStatus( (data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("Family Status GET results:", data);
        }
      });
    } catch(err) {
      if (typeof err === 'string' || err instanceof String)
        err = JSON.parse(err)
      if (!err.statusCode === 401 && !err.statusCode === 50002) {
        this.log("Unknown promise error. If it persists, please report it at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new:",JSON.stringify(err));
      }
    }
    
    if(this.snapi.json.hasOwnProperty('Error')) {
      if (this.snapi.json.Error.Code == 50002 || this.snapi.json.Error.Code == 401) {
        this.log.debug('SleepIQ authentication failed, stand by for automatic re-authentication')
        await this.authenticate();
        //this.fetchData();
      } else {
        this.log('SleepIQ authentication failed with an unknown error code. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
      }
    } else {
      bedData = JSON.parse(JSON.stringify(this.snapi.json));
      
      if (this.hasFoundation) {
        try {
          await this.snapi.foundationStatus( (data, err=null) => {
            if (err) {
              this.log.debug(data, err);
            } else {
              this.log.debug("Foundation Status GET results:", data);
            }
          });          
        } catch(err) {
          this.log("Failed to fetch foundation status:", err);
        }
        
        flexData = JSON.parse(JSON.stringify(this.snapi.json));
      }
      
      
      this.log.debug('SleepIQ JSON data successfully retrieved');
      this.parseData(bedData, flexData);
      
    }
    
  }
  
  parseData (bedData, flexData) {
    if (bedData.beds) {
      bedData.beds.forEach(async function (bed, index) {
        let bedID = bed.bedId
        let sides = JSON.parse(JSON.stringify(bed))
        delete sides.status
        delete sides.bedId
        
        if (!this.accessories.has(bedID+'privacy')) {
          this.log("New privacy switch detected.");
          this.addAccessories();
          return
        } else {
          this.snapi.bedID = bedID;
          
          try {
            await this.snapi.bedPauseMode( (data, err=null) => {
              if (err) {
                this.log.debug(data, err);
              } else {
                this.log.debug("Privacy mode GET results:", data);
              }
            });
          } catch(err) {
            this.log('Failed to retrieve bed pause mode:', err);
          }
          
          let privacyData = JSON.parse(JSON.stringify(this.snapi.json));
          this.log.debug('SleepIQ Privacy Mode: ' + privacyData.pauseMode);
          let bedPrivacyAccessory = this.accessories.get(bedID+'privacy');
          bedPrivacyAccessory.updatePrivacy(privacyData.pauseMode);
        }
        
        let anySideOccupied = false;
        
        if (sides) {
          Object.keys(sides).forEach(function (bedside, index) {
            let sideID = bedID+bedside
            if(!this.accessories.has(sideID+'occupancy') || !this.accessories.has(sideID+'number')) {
              this.log("New bedside detected.")
              this.addAccessories();
              return
            } else {
              let thisSideOccupied = sides[bedside].isInBed;
              this.log.debug('SleepIQ Occupancy Data: {' + bedside + ':' + thisSideOccupied + '}')
              let bedSideOccAccessory = this.accessories.get(sideID+'occupancy');
              bedSideOccAccessory.setOccupancyDetected(thisSideOccupied);
              anySideOccupied = anySideOccupied || thisSideOccupied;
              
              this.log.debug('SleepIQ Sleep Number: {' + bedside + ':' + sides[bedside].sleepNumber + '}')
              let bedSideNumAccessory = this.accessories.get(sideID+'number');
              bedSideNumAccessory.updateSleepNumber(sides[bedside].sleepNumber);
              
              if (this.hasFoundation) {
                if (bedside == 'leftSide') {
                  this.log.debug('SleepIQ Flex Data: {' + bedside + ': Head: ' + flexData.fsLeftHeadPosition + ", Foot:" + flexData.fsLeftFootPosition + '}')
                  let bedSideFlexLeftAccessory = this.accessories.get(sideID+'flex');
                  bedSideFlexLeftAccessory.updateFoundation(flexData.fsLeftHeadPosition, flexData.fsLeftFootPosition);
                } else {
                  this.log.debug('SleepIQ Flex Data: {' + bedside + ': Head: ' + flexData.fsRightHeadPosition + ", Foot:" + flexData.fsRightFootPosition + '}')
                  let bedSideFlexRightAccessory = this.accessories.get(sideID+'flex');
                  bedSideFlexRightAccessory.updateFoundation(flexData.fsRightHeadPosition, flexData.fsRightFootPosition);
                }
              }
            }
          }.bind(this))  
        } else {
          this.log('Failed to detect a bed side. I am not sure why, so you might want to file a ticket.')
        }
        
        let anySideOccAccessory = this.accessories.get(bedID + 'anySide' + 'occupancy');
        anySideOccAccessory.setOccupancyDetected(anySideOccupied);
        
      }.bind(this))
    } else {
      this.log('Failed to find a bed, I think. I am not sure why, but if you have a bed attached to your account, you should probably file a bug.')
    }
  }
  
}

class snOccupancy {
  constructor (log, accessory) {
    this.log = log;
    this.accessory = accessory;
    
    this.occupancyService = this.accessory.getService(Service.OccupancySensor);
    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
  }
  
  setOccupancyDetected (value) {
    if (value == true) {
      this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED	    
    }
    else {
      this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
    }
    return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
  }
  
  getOccupancyDetected (callback) {
    return callback(null, this.occupancyDetected)
  }
  
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.occupancyService
    .getCharacteristic(Characteristic.OccupancyDetected)
    .on('get', this.getOccupancyDetected.bind(this))
    
    
    return [informationService, this.occupancyService]
  }
}

class snNumber {
  constructor (log, accessory, snapi, sendDelay) {
    this.log = log;
    this.accessory = accessory;
    this.snapi = snapi;
    this.sendDelay = sendDelay;
    this.sleepNumber = 50;
    this.sideName = this.accessory.context.sideName;
    
    this.numberService = this.accessory.getService(this.sideName+'Number');
    this.numberService.setCharacteristic(Characteristic.On, true);
    
    this.debounce = this.debounce.bind(this);
    this.getSleepNumber = this.getSleepNumber.bind(this);
    this.setSleepNumber = this.setSleepNumber.bind(this);
    this.updateSleepNumber = this.updateSleepNumber.bind(this);
  }


  debounce (fn, value, delay) {
    let timeOutId;
    return function() {
      if(timeOutId) {
        clearTimeout(timeOutId);
      }
      timeOutId = setTimeout(() => {
        fn(value);
      },delay);
    }()
  }
  
  // Send a new sleep number to the bed
  setSleepNumber (rawValue) {
    let side = this.accessory.context.side;
    let value = Math.max(rawValue - rawValue % 5, 5);
    this.log.debug('Setting sleep number='+value+' on side='+side);
    try {
      this.snapi.sleepNumber(side, value, (data, err=null) => {
      if (err) {
        this.log.debug(data, err);
      } else {
          this.log.debug("Sleep Number PUT result:", data)
        }
      });
    } catch(err) {
      this.log('Failed to set sleep number='+value+' on side='+side+' :', err);
    }
  }
  
  // Keep sleep number updated with external changes through sleepIQ app
  updateSleepNumber(value) {
    this.sleepNumber = value;
  }
  
  getSleepNumber (callback) {
    return callback(null, this.sleepNumber);
  }
  
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.numberService
    .getCharacteristic(Characteristic.Brightness)
    .on('set', function (value, callback) {
      this.log.debug("Sleep Number -> "+value)
      this.debounce(this.setSleepNumber, value, this.sendDelay);
      callback()
    }.bind(this))
    .on('get', this.getSleepNumber.bind(this))
    
    this.numberService
    .getCharacteristic(Characteristic.On)
    .on('change', function (oldValue, newValue) {
      if (!newValue) {
        setTimeout(() => this.numberService.setCharacteristic(Characteristic.On, true), 250); // if "light" turned off, turn back on after 250ms
      }
    }.bind(this))
    
    return [informationService, this.numberService]
  }
}

class snFlex {
  constructor (log, accessory, snapi) {
    this.log = log;
    this.accessory = accessory;
    this.snapi = snapi;
    this.headPosition = 0;
    this.footPosition = 0;
    this.sideName = this.accessory.context.sideName;
    
    this.foundationHeadService = this.accessory.getService(this.sideName+'FlexHead');
    this.foundationFootService = this.accessory.getService(this.sideName+'FlexFoot');
    
    this.setFoundation = this.setFoundation.bind(this);
    this.updateFoundation = this.updateFoundation.bind(this);
    this.getFoundation = this.getFoundation.bind(this);
    
  }
  
  
  // Send a new foundation position to the bed
  setFoundation (actuator, value) {
    let side = this.accessory.context.side;
    this.log.debug('Setting foundation position='+value+' on side='+side+' for position='+actuator);
    try {
      this.snapi.adjust(side, actuator, value, (data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("adjust PUT result:", data)
        }
      });
    } catch(err) {
      this.log('Failed to set foundation position='+value+' on side='+side+' for position='+actuator+' :', err);
    }
  }
  
  // Keep foundation position updated with external changes through sleepIQ app
  updateFoundation(head, foot) {
    this.headPosition = head;
    this.footPosition = foot;
  }
  
  getFoundation (actuator, callback) {
    if (actuator == 'H') {
      return callback(null, this.headPosition);
    } else {
      return callback(null, this.footPosition);
    }
  }
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.foundationHeadService
    .getCharacteristic(Characteristic.Brightness)
    .on('set', function (value, callback) {
      this.log.debug("Foundation Head -> "+value);
      this.setFoundation('H', value);
      callback();
    }.bind(this))
    .on('get', (callback) => this.getFoundation('H', callback))

    this.foundationHeadService
    .getCharacteristic(Characteristic.On)
    .on('change', function (oldValue, newValue, callback) {
      this.log.debug("Foundation Head -> "+newValue)
      this.setFoundation('H', newValue);
      callback();
    }.bind(this));
    
    this.foundationFootService
    .getCharacteristic(Characteristic.Brightness)
    .on('set', function (value, callback) {
      this.log.debug("Foundation Foot -> "+value);
      this.setFoundation('F', value);
      callback();
    }.bind(this))
    .on('get', (callback) => this.getFoundation('F', callback))

    this.foundationFootService
    .getCharacteristic(Characteristic.On)
    .on('change', function (oldValue, newValue, callback) {
      this.log.debug("Foundation Foot -> "+newValue)
      this.setFoundation('F', newValue);
      callback();
    }.bind(this));
    
    return [informationService, this.foundationHeadService, this.foundationFootService]
  }
}

class snPrivacy {
  constructor (log, accessory, snapi) {
    this.log = log;
    this.accessory = accessory;
    this.snapi = snapi;
    this.privacy = 'off';
    
    this.privacyService = this.accessory.getService(Service.Switch);
    
    this.getPrivacy = this.getPrivacy.bind(this);
    this.setPrivacy = this.setPrivacy.bind(this);
    this.updatePrivacy = this.updatePrivacy.bind(this);
  }
  
  // Send a new privacy value to the bed
  setPrivacy (value) {
    this.log.debug('Setting privacy mode to', value);
    try {
      this.snapi.setBedPauseMode(value ? 'on' : 'off', (data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("privacy PUT result:", data)
        }
      });
    } catch(err) {
      this.log('Failed to set privacy mode to '+value+' :', err);
    }
  }
  
  // Keep privacy mode updated with external changes through sleepIQ app
  updatePrivacy(value) {
    this.privacy = value;
  }
  
  getPrivacy (callback) {
    return callback(null, this.privacy == 'on' ? true : false);
  }
  
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.privacyService
    .getCharacteristic(Characteristic.On)
    .on('set', function (value, callback) {
      this.log.debug("Privacy -> "+value);
      this.setPrivacy(value);
      callback();
    }.bind(this))
    .on('get', this.getPrivacy);
    
    return [informationService, this.privacyService]
  }
}


