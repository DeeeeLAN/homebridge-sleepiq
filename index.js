'use strict'
var Accessory, Service, Characteristic, UUIDGen
var snapi = require('./API.js')

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  homebridge.registerPlatform("homebridge-sleepiq", "SleepIQ", SleepIQPlatform, true)
}

class SleepIQPlatform {
  constructor (log, config, api) {
    this.log = log;
    
    if (!config) {
      log.warn("Ignoring SleepIQ setup because it is not configured.");
      this.disabled = true;
      return;
    }
    
    // Retrieve config settings
    this.config = config;
    this.username = config["email"];
    this.password = config["password"];
    this.refreshTime = (config["refreshTime"] || 5) * 1000; // update values from SleepIQ every 5 seconds
    this.sendDelay = (config["sendDelay"] || 2) * 1000; // delay updating bed numbers by 2 seconds
    this.warmingTimer = (config["warmingTimer"] || '6h'); // default timer for foot warming is 6h

    if (!this.username || !this.password) {
      log.warn("Ignoring SleepIQ setup because username or password was not provided.");
      this.disabled = true;
      return;
    }

    this.accessories = new Map();
    this.staleAccessories = []
    this.snapi = new snapi(this.username, this.password);

    // Set default available components
    this.hasFoundation = false;
    this.hasOutletLeft = false; // 2
    this.hasOutletRight = false; // 1
    this.hasLightstripLeft = false; // 3
    this.hasLightstripRight = false; // 4
    this.hasWarmers = false;

    if (api) {
      this.api = api;
      
      this.api.on('didFinishLaunching', function () {
        this.log.debug("API Finished Launching");
        this.didFinishLaunching();
      }.bind(this));
    }
    
  }

  removeMarkedAccessories () {
    this.log.debug("Checking accessories for any marked for removal");

    for (const index in this.staleAccessories) {
      const accessory = this.staleAccessories[index]
      if (accessory.context && accessory.context.remove === true) {
        this.log.debug("Removing accessory:", accessory.displayName)
        this.api.unregisterPlatformAccessories("homebridge-sleepiq", accessory._associatedPlatform, [accessory]);
        this.staleAccessories.splice(this.staleAccessories.indexOf(index))
      }
    }
  }
  
  async didFinishLaunching () {

    this.removeMarkedAccessories();

    await this.authenticate();
    if (!this.snapi.key) {
      return;
    }

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
      this.log("Failed to authenticate with SleepIQ. Please double-check your username and password. Disabling SleepIQ plugin. Error:",err.error);
      this.disabled = true;
    }
  }
  
  
  async addAccessories () {
    // Attempt to retrieve main dataset
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

    // Loop through each bed
    this.snapi.json.beds.forEach( async function (bed, index) {
      let bedName = "bed" + index
      let bedID = bed.bedId
      let sides = JSON.parse(JSON.stringify(bed))
      delete sides.status
      delete sides.bedId
      
      // Check if there is a foundation attached
      try {
        await this.snapi.foundationStatus((async (data, err=null) => {
          if (err) {
            this.log.debug(data, err);
          } else {
            this.log.debug("foundationStatus result:", data);
            let foundationStatus = JSON.parse(data);
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
      
      if (this.hasFoundation) {
        // check if the foundation has outlets
        try {
          await this.snapi.outletStatus('1', ((data, err=null) => {
            if (err) {
              this.log.debug(data, err);
            } else {
              this.log.debug("right outletStatus result:", data);
              let outletStatus = JSON.parse(data);
              if(outletStatus.hasOwnProperty('Error')) {
                if (outletStatus.Error.Code === 404) {
                  this.log("No right outlet detected");
                } else {
                  this.log("Unknown error occurred when checking the right outlet status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
                }
              } else {
                this.hasOutletRight = true
              }
            }
          }).bind(this));
        } catch(err) {
          if (typeof err === 'string' || err instanceof String)
            err = JSON.parse(err)
          if (!(err.statusCode === 404)) {
            this.log("Failed to retrieve right outlet status:", JSON.stringify(err));
          }
        }

        try {
          await this.snapi.outletStatus('2', ((data, err=null) => {
            if (err) {
              this.log.debug(data, err);
            } else {
              this.log.debug("left outletStatus result:", data);
              let outletStatus = JSON.parse(data);
              if(outletStatus.hasOwnProperty('Error')) {
                if (outletStatus.Error.Code === 404) {
                  this.log("No left outlet detected");
                } else {
                  this.log("Unknown error occurred when checking the left outlet status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
                }
              } else {
                this.hasOutletLeft = true
              }
            }
          }).bind(this));
        } catch(err) {
          if (typeof err === 'string' || err instanceof String)
            err = JSON.parse(err)
          if (!(err.statusCode === 404)) {
            this.log("Failed to retrieve left outlet status:", JSON.stringify(err));
          }
        }
  
        // check if the foundation has lightstrips
        try {
          await this.snapi.outletStatus('3', ((data, err=null) => {
            if (err) {
              this.log.debug(data, err);
            } else {
              this.log.debug("right lightstrip outletStatus result:", data);
              let outletStatus = JSON.parse(data);
              if(outletStatus.hasOwnProperty('Error')) {
                if (outletStatus.Error.Code === 404) {
                  this.log("No right lightstrip detected");
                } else {
                  this.log("Unknown error occurred when checking the right lightstrip status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
                }
              } else {
                this.hasLightstripRight = true
              }
            }
          }).bind(this));
        } catch(err) {
          if (typeof err === 'string' || err instanceof String)
            err = JSON.parse(err)
          if (!(err.statusCode === 404)) {
            this.log("Failed to retrieve right lightstrip status:", JSON.stringify(err));
          }
        }

        try {
          await this.snapi.outletStatus('4', ((data, err=null) => {
            if (err) {
              this.log.debug(data, err);
            } else {
              this.log.debug("left lightstrip outletStatus result:", data);
              let outletStatus = JSON.parse(data);
              if(outletStatus.hasOwnProperty('Error')) {
                if (outletStatus.Error.Code === 404) {
                  this.log("No left lightstrip detected");
                } else {
                  this.log("Unknown error occurred when checking the left lightstrip status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
                }
              } else {
                this.hasLightstripLeft = true
              }
            }
          }).bind(this));
        } catch(err) {
          if (typeof err === 'string' || err instanceof String)
            err = JSON.parse(err)
          if (!(err.statusCode === 404)) {
            this.log("Failed to retrieve left lightstrip status:", JSON.stringify(err));
          }
        }
  
        // check if the foundation has foot warmers
        try {
          await this.snapi.footWarmingStatus(((data, err=null) => {
            if (err) {
              this.log.debug(data, err);
            } else {
              this.log.debug("footWarmingStatus result:", data);
              let footWarmingStatus = JSON.parse(data);
              if(footWarmingStatus.hasOwnProperty('Error')) {
                if (footWarmingStatus.Error.Code === 404) {
                  this.log("No foot warmer detected");
                } else {
                  this.log("Unknown error occurred when checking the foot warmer status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
                }
              } else {
                this.hasWarmers = true
              }
            }
          }).bind(this));
        } catch(err) {
          if (typeof err === 'string' || err instanceof String)
            err = JSON.parse(err)
          if (!(err.statusCode === 404)) {
            this.log("Failed to retrieve foot warmer status:", JSON.stringify(err.error));
          }
        }
      }

      // Check if bed has privacy mode
      if(!this.accessories.has(bedID+'privacy')) {
        this.log("Found Bed Privacy Switch: ", bedName);
        
        let uuid = UUIDGen.generate(bedID+'privacy');
        let bedPrivacy = new Accessory(bedName+'privacy', uuid);
        
        bedPrivacy.context.sideID = bedID+'privacy';
        bedPrivacy.context.type = 'privacy';
        bedPrivacy.context.bedName = bedName;
        
        bedPrivacy.addService(Service.Switch, bedName+'Privacy');
        
        let bedPrivacyAccessory = new snPrivacy(this.log, bedPrivacy, this.snapi);
        bedPrivacyAccessory.getServices();
        
        this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedPrivacy]);
        this.accessories.set(bedID+'privacy', bedPrivacyAccessory);
      } else {
        this.log(bedName + " privacy already added from cache");
      }
      
      // function to register an occupancy sensor
      const registerOccupancySensor = (sideName, sideID) => {
        this.log("Found BedSide Occupancy Sensor: ", sideName);
        
        let uuid = UUIDGen.generate(sideID+'occupancy');
        let bedSideOcc = new Accessory(sideName+'occupancy', uuid);
        
        bedSideOcc.context.sideID = sideID+'occupancy';
        bedSideOcc.context.type = 'occupancy';
        
        bedSideOcc.addService(Service.OccupancySensor, sideName+'Occupancy');
        
        let bedSideOccAccessory = new snOccupancy(this.log, bedSideOcc);
        bedSideOccAccessory.getServices();
        
        this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedSideOcc]);
        this.accessories.set(sideID+'occupancy', bedSideOccAccessory);
      }
      
      // loop through each bed side
      Object.keys(sides).forEach( function (bedside, index) {
        try {
          let sideName = bedName+bedside
          let sideID = bedID+bedside

          // register side occupancy sensor
          if(!this.accessories.has(sideID+'occupancy')) {
            registerOccupancySensor(sideName, sideID);
          } else {
            this.log(sideName + " occupancy already added from cache");
          }
          
          // register side number control
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
            
            this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedSideNum])
            this.accessories.set(sideID+'number', bedSideNumAccessory);
          } else {
            this.log(sideName + " number control already added from cache");
          }
          
          // check for foundation
          if (this.hasFoundation) {
            // register side foundation head and foot control units
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
              
              this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedSideFlex])
              this.accessories.set(sideID+'flex', bedSideFlexAccessory)
            } else {
              this.log(sideName + " flex foundation already added from cache")
            }

            // register side outlet control
            if ((bedside === 'rightSide' && this.hasOutletRight) || (bedside === 'leftSide' && this.hasOutletLeft)) {
              if (!this.accessories.has(sideID+'outlet')) {
                // register outlet
                this.log("Found BedSide Outlet: ", sideName);
        
                let uuid = UUIDGen.generate(sideID+'outlet');
                let bedSideOutlet = new Accessory(sideName+'outlet', uuid);
                
                bedSideOutlet.context.side = bedside[0].toUpperCase();
                bedSideOutlet.context.sideID = sideID+'outlet';
                bedSideOutlet.context.sideName = sideName;
                bedSideOutlet.context.type = 'outlet';
                
                bedSideOutlet.addService(Service.Outlet, sideName+'Outlet')
                
                let bedSideOutletAccessory = new snOutlet(this.log, bedSideOutlet, this.snapi);
                bedSideOutletAccessory.getServices();
                
                this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedSideOutlet])
                this.accessories.set(sideID+'outlet', bedSideOutletAccessory)
              } else {
                this.log(sideName + ' outlet already added from cache')
              }
            }

            // register side lightstrip control
            if ((bedside === 'rightSide' && this.hasLightstripRight) || (bedside === 'leftSide' && this.hasLightstripLeft)) {
              if (!this.accessories.has(sideID+'lightstrip')) {
                // register lightstrip
                this.log("Found BedSide Lightstrip: ", sideName);
        
                let uuid = UUIDGen.generate(sideID+'lightstrip');
                let bedSideOutlet = new Accessory(sideName+'lightstrip', uuid);
                
                bedSideOutlet.context.side = bedside[0].toUpperCase();
                bedSideOutlet.context.sideID = sideID+'lightstrip';
                bedSideOutlet.context.sideName = sideName;
                bedSideOutlet.context.type = 'lightstrip';
                
                bedSideOutlet.addService(Service.Lightbulb, sideName+'Lightstrip')
                
                let bedSideOutletAccessory = new snLightStrip(this.log, bedSideOutlet, this.snapi);
                bedSideOutletAccessory.getServices();
                
                this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedSideOutlet])
                this.accessories.set(sideID+'lightstrip', bedSideOutletAccessory)
              } else {
                this.log(sideName + ' lightstrip already added from cache')
              }
            }

            // register side foot warmer control
            if (this.hasWarmers) {
              // register foot warmer
              if(!this.accessories.has(sideID+'footwarmer')) {
                this.log("Found BedSide Foot Warmer: ", sideName);
                    
                let uuid = UUIDGen.generate(sideID+'footwarmer');
                let bedSideFootWarmer = new Accessory(sideName+'footwarmer', uuid);
                
                bedSideFootWarmer.context.side = bedside[0].toUpperCase();
                bedSideFootWarmer.context.sideID = sideID+'footwarmer';
                bedSideFootWarmer.context.sideName = sideName;
                bedSideFootWarmer.context.type = 'footwarmer';
                
                bedSideFootWarmer.addService(Service.Lightbulb, sideName+'FootWarmer');
                let footwarmerService = bedSideFootWarmer.getService(Service.Lightbulb, sideName+'FootWarmer');
                footwarmerService.addCharacteristic(Characteristic.Brightness);

                
                let bedSideFootWarmerAccessory = new snFootWarmer(this.log, bedSideFootWarmer, this.snapi, this.warmingTimer);
                bedSideFootWarmerAccessory.getServices();
                
                this.api.registerPlatformAccessories('homebridge-sleepiq', 'SleepIQ', [bedSideFootWarmer])
                this.accessories.set(sideID+'footwarmer', bedSideFootWarmerAccessory);
              } else {
                this.log(bedName + ' foot warmer already added from cache')
              }
            }
          }

        } catch (err) {
          this.log('Error when setting up bedsides:',err);
        }
        
      }.bind(this))
      
      // add "anySide" occupancy sensor
      const anySideID = bedID + "anySide";
      const anySideName = bedName + "anySide";
      if (!this.accessories.has(anySideID+'occupancy')) {
        // register 'any' side occupancy sensor
        registerOccupancySensor(anySideName, anySideID);
      } else {
        this.log(anySideName + " occupancy already added from cache");
      }

      const bothSidesID = bedID + 'bothSides';
      const bothSidesName = bedName + 'bothSides';
      if (!this.accessories.has(bothSidesID + 'occupancy')) {
        registerOccupancySensor(bothSidesName, bothSidesID);
      } else {
        this.log(bothSidesName + ' occupancy already added from cache');
      }

    }.bind(this))
  }
  
  removeAccessory (side) {
    this.log('Remove Accessory: ', side.accessory.displayName)
    this.api.unregisterPlatformAccessories("homebridge-sleepiq", "SleepNumber", [side.accessory])
    this.accessories.delete(side.accessory.context.sideID)
  }
  
  // called during setup, restores from cache (reconfigure instead of create new)
  configureAccessory (accessory) {
    if (this.disabled) {
      return false;
    }

    this.log("Configuring Cached Accessory: ", accessory.displayName, "UUID: ", accessory.UUID);

    // remove old privacy accessory
    if (accessory.displayName.slice(-7) === 'privacy') {
      if (!accessory.context.bedName) {
        this.log("Stale accessory. Marking for removal");
        accessory.context.type = 'remove';
      }
    }
    
    if (accessory.displayName.slice(-4) === 'Side') {
      this.log("Stale accessory. Marking for removal");
      accessory.context.type = 'remove';
    }            
    
    if (Array.from(this.accessories.values()).map(a => a.accessory.displayName).includes(accessory.displayName)) {
      this.log("Duplicate accessory detected in cache: ", accessory.displayName, "If this appears incorrect, file a ticket on github. Removing duplicate accessory from cache.");
      this.log("You might need to restart homebridge to clear out the old data, especially if the accessory UUID got duplicated.");
      this.log("If the issue persists, try clearing your accessory cache.");
      accessory.context.type = 'remove';
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
      case 'outlet':
        accessory.reachable = true;
        let bedSideOutletAccessory = new snOutlet(this.log, accessory, this.snapi);
        bedSideOutletAccessory.getServices();
        this.accessories.set(accessory.context.sideID, bedSideOutletAccessory);
        break;
      case 'lightstrip':
        accessory.reachable = true;
        let bedSideLightStripAccessory = new snLightStrip(this.log, accessory, this.snapi);
        bedSideLightStripAccessory.getServices();
        this.accessories.set(accessory.context.sideID, bedSideLightStripAccessory);
        break;
      case 'footwarmer':
        accessory.reachable = true;
        let bedSideFootWarmerAccessory = new snFootWarmer(this.log, accessory, this.snapi, this.warmingTimer);
        bedSideFootWarmerAccessory.getServices();
        this.accessories.set(accessory.context.sideID, bedSideFootWarmerAccessory);
        break;
      case 'privacy':
        accessory.reachable = true;
        let bedPrivacyAccessory = new snPrivacy(this.log, accessory, this.snapi);
        bedPrivacyAccessory.getServices();
        this.accessories.set(accessory.context.sideID, bedPrivacyAccessory);
        break;
      default:
        this.log("Unknown accessory type. Removing from accessory cache.");
      case 'remove':
        accessory.context.remove = true;
        accessory.UUID = UUIDGen.generate(accessory.sideID+'remove');
        accessory._associatedHAPAccessory.UUID = accessory.UUID;
        this.staleAccessories.push(accessory);
        return false;
        
    }
    return true;
  }
  
  async fetchData () {
    this.log.debug('Getting SleepIQ JSON Data...')
    var bedData;
    var flexData;
    // Fetch main data set
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
    
    // Check if sign-out occurred and re-authentication is needed
    if(this.snapi.json.hasOwnProperty('Error')) {
      if (this.snapi.json.Error.Code == 50002 || this.snapi.json.Error.Code == 401) {
        this.log.debug('SleepIQ authentication failed, stand by for automatic re-authentication')
        await this.authenticate();
        //this.fetchData();
      } else {
        this.log('SleepIQ authentication failed with an unknown error code. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
      }
    } else {
      this.log.debug('SleepIQ JSON data successfully retrieved');
      bedData = JSON.parse(JSON.stringify(this.snapi.json));
      
      this.parseData(bedData);
      
    }
    
  }
  
  parseData (bedData) {
    if (bedData.beds) {
      bedData.beds.forEach(async function (bed, index) {
        let bedID = bed.bedId
        let sides = JSON.parse(JSON.stringify(bed))
        delete sides.status
        delete sides.bedId
        
        // check if new privacy switch detected
        if (!this.accessories.has(bedID+'privacy')) {
          this.log("New privacy switch detected.");
          this.addAccessories();
          return
        } else {
          this.snapi.bedID = bedID;
          
          // check privacy status
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
          
          // update privacy status
          let privacyData = JSON.parse(JSON.stringify(this.snapi.json));
          this.log.debug('SleepIQ Privacy Mode: ' + privacyData.pauseMode);
          let bedPrivacyAccessory = this.accessories.get(bedID+'privacy');
          bedPrivacyAccessory.updatePrivacy(privacyData.pauseMode);
        }

        // Fetch foundation data
        let flexData;
        if (this.hasFoundation) {
          try {
            await this.snapi.foundationStatus((data, err=null) => {
              if (err) {
                this.log.debug(data, err);
              } else {
                this.log.debug("Foundation Status GET results:", data);
                flexData = JSON.parse(data);
              }
            });          
          } catch(err) {
            this.log("Failed to fetch foundation status:", err.error);
          }
        }
        
        // fetch foot warmer data
        let footWarmerData;
        if (this.hasWarmers) {
          try {
            await this.snapi.footWarmingStatus((data, err=null) => {
              if (err) {
                this.log.debug(data, err);
              } else {
                this.log.debug("Foot Warmer Status GET results:", data);
                footWarmerData = JSON.parse(data);
                if(footWarmerData.hasOwnProperty('Error')) {
                  if (footWarmerData.Error.Code === 404) {
                    this.log('No foot warmer detected');
                  } else {
                    this.log('Unknown error occurred when checking the outlet status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
                  }
                }
              }
            });
          } catch(err) {
            this.log('Failed to fetch foot warmer status:', err.error);
          }
        }
        
        let anySideOccupied = false;
        let bothSidesOccupied = true;
        
        if (sides) {
          // check data on each bed side
          Object.keys(sides).forEach(async function (bedside, index) {
            let sideID = bedID+bedside

            // check if new side detected
            if(!this.accessories.has(sideID+'occupancy') || !this.accessories.has(sideID+'number')) {
              this.log("New bedside detected.")
              this.addAccessories();
              return
            } else {
              // update side occupancy
              let thisSideOccupied = sides[bedside].isInBed;
              this.log.debug('SleepIQ Occupancy Data: {' + bedside + ':' + thisSideOccupied + '}')
              let bedSideOccAccessory = this.accessories.get(sideID+'occupancy');
              bedSideOccAccessory.setOccupancyDetected(thisSideOccupied);
              anySideOccupied = anySideOccupied || thisSideOccupied;
              bothSidesOccupied = bothSidesOccupied && thisSideOccupied;
              
              // update side number
              this.log.debug('SleepIQ Sleep Number: {' + bedside + ':' + sides[bedside].sleepNumber + '}')
              let bedSideNumAccessory = this.accessories.get(sideID+'number');
              bedSideNumAccessory.updateSleepNumber(sides[bedside].sleepNumber);
              
              // update foundation data
              if (this.hasFoundation) {
                if (flexData) {
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

                // check outlet data
                if ((bedside === 'rightSide' && this.hasOutletRight) || (bedside === 'leftSide' && this.hasOutletLeft)) {
                  // fetch outlet data
                  try {
                    await this.snapi.outletStatus(bedside === 'rightSide' ? '1' : '2', (data, err=null) => {
                      if (err) {
                        this.log.debug(data, err);
                      } else {
                        this.log.debug("Outlet Status GET results:", data);
                        let outletData = JSON.parse(data);
                        if(outletData.hasOwnProperty('Error')) {
                          if (outletData.Error.Code === 404) {
                            this.log('No outlet detected');
                          } else {
                            this.log('Unknown error occurred when checking the outlet status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
                          }
                        } else {
                          // update outlet data
                          this.log.debug('SleepIQ outlet Data: {' + bedside + ':' + outletData.setting + '}');
                          let outletAccessory = this.accessories.get(sideID+'outlet');
                          outletAccessory.updateOutlet(outletData.setting);
                        }
                      }
                    });
                  } catch(err) {
                    this.log('Failed to fetch outlet status:', err.error);
                  }
                } // if(this.hasOutlets)

                // check lightstrip data
                if ((bedside === 'rightSide' && this.hasLightstripRight) || (bedside === 'leftSide' && this.hasLightstripLeft)) {
                  // fetch lightstrip data
                  try {
                    await this.snapi.outletStatus(bedside === 'rightSide' ? '3' : '4', (data, err=null) => {
                      if (err) {
                        this.log.debug(data, err);
                      } else {
                        this.log.debug("Lightstrip Status GET results:", data);
                        let lightstripData = JSON.parse(data);
                        if(lightstripData.hasOwnProperty('Error')) {
                          if (lightstripData.Error.Code === 404) {
                            this.log('No lightstrip detected');
                          } else {
                            this.log('Unknown error occurred when checking the outlet status. See previous output for more details. If it persists, please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
                          }
                        } else {
                          // update lightstrip data
                          this.log.debug('SleepIQ lightstrip Data: {' + bedside + ':' + lightstripData.setting + '}');
                          let lightstripAccessory = this.accessories.get(sideID+'lightstrip');
                          lightstripAccessory.updateLightStrip(lightstripData.setting);
                        }
                      }
                    });
                  } catch(err) {
                    this.log('Failed to fetch lightstrip status:', err.error);
                  }
                } // if(this.hasLightstrips)

                // update foot warmer data
                if (this.hasWarmers) {
                  if (footWarmerData) {
                    if (bedside === 'leftSide') {
                      this.log.debug('SleepIQ foot warmer Data: {' + bedside + ':' + footWarmerData.footWarmingTempLeft + '}');
                      let footWarmerAccessory = this.accessories.get(sideID+'footwarmer');
                      footWarmerAccessory.updateFootWarmer(footWarmerData.footWarmingTempLeft);
                    } else {
                      this.log.debug('SleepIQ foot warmer Data: {' + bedside + ':' + footWarmerData.footWarmingTempRight + '}');
                      let footWarmerAccessory = this.accessories.get(sideID+'footwarmer');
                      footWarmerAccessory.updateFootWarmer(footWarmerData.footWarmingTempRight);
                    }
                  }
                } // if(this.hasLightstrips)
              } // if(this.hasFoundation)
            }
          }.bind(this))  
        } else {
          this.log('Failed to detect a bed side. I am not sure why, so you might want to file a ticket.')
        }
        
        let anySideOccAccessory = this.accessories.get(bedID + 'anySide' + 'occupancy');
        anySideOccAccessory.setOccupancyDetected(anySideOccupied);

        let bothSidesOccAccessory = this.accessories.get(bedID + 'bothSides' + 'occupancy');
        bothSidesOccAccessory.setOccupancyDetected(bothSidesOccupied);
        
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
  setSleepNumber (value) {
    let side = this.accessory.context.side;
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
    .setProps({
      minValue: 5,
      maxValue: 100,
      minStep: 5
    });
    
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
  

  waitForBedToStopMoving (fn, value, delay) {
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
    .on('change', function (oldValue, newValue) {
      this.log.debug("Foundation Head -> "+newValue)
      this.setFoundation('H', newValue);
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
    .on('change', function (oldValue, newValue) {
      this.log.debug("Foundation Foot -> "+newValue)
      this.setFoundation('F', newValue);
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
    this.bedName = this.accessory.context.bedName
    
    this.privacyService = this.accessory.getService(this.bedName+'Privacy');
    
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


class snOutlet {
  constructor (log, accessory, snapi) {
    this.log = log;
    this.accessory = accessory;
    this.snapi = snapi;
    this.outlet = '0';
    this.sideName = this.accessory.context.sideName;
    
    this.outletService = this.accessory.getService(this.sideName+'Outlet');
    
    this.getOutlet = this.getOutlet.bind(this);
    this.setOutlet = this.setOutlet.bind(this);
    this.updateOutlet = this.updateOutlet.bind(this);
  }
  
  // Send a new Outlet value to the bed
  setOutlet (value) {
    let side = this.accessory.context.side;
    this.log.debug('Setting outlet on side='+side+' to='+value);
    try {
      this.snapi.outlet(side == 'R' ? 1 : 2, value ? 1 : 0, (data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("outlet PUT result:", data)
        }
      });
    } catch(err) {
      this.log('Failed to set outlet on side='+side+' to='+value+' :', err);
    }
  }
  
  // Keep Outlet mode updated with external changes through sleepIQ app
  updateOutlet(value) {
    this.outlet = value;
  }
  
  getOutlet (callback) {
    return callback(null, this.outlet == '1' ? true : false);
  }
  
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.outletService
    .getCharacteristic(Characteristic.On)
    .on('set', function (value, callback) {
      this.log.debug("Outlet -> "+value);
      this.setOutlet(value);
      callback();
    }.bind(this))
    .on('get', this.getOutlet);
    
    return [informationService, this.outletService]
  }
}


class snLightStrip {
  constructor (log, accessory, snapi) {
    this.log = log;
    this.accessory = accessory;
    this.snapi = snapi;
    this.lightStrip = '0';
    this.sideName = this.accessory.context.sideName;
    
    this.LightStripService = this.accessory.getService(this.sideName+'Lightstrip');
    
    this.getLightStrip = this.getLightStrip.bind(this);
    this.setLightStrip = this.setLightStrip.bind(this);
    this.updateLightStrip = this.updateLightStrip.bind(this);
  }
  
  // Send a new LightStrip value to the bed
  setLightStrip (value) {
    let side = this.accessory.context.side;
    this.log.debug('Setting light-strip on side='+side+' to='+value);
    try {
      this.snapi.outlet(side == 'R' ? 3 : 4, value ? 1 : 0, (data, err=null) => {
        if (err) {
          this.log.debug(data, err);
        } else {
          this.log.debug("light-strip PUT result:", data)
        }
      });
    } catch(err) {
      this.log('Failed to set light-strip on side='+side+' to='+value+' :', err);
    }
  }
  
  // Keep light-strip mode updated with external changes through sleepIQ app
  updateLightStrip(value) {
    this.lightStrip = value;
  }
  
  getLightStrip (callback) {
    return callback(null, this.lightStrip == '1' ? true : false);
  }
  
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.LightStripService
    .getCharacteristic(Characteristic.On)
    .on('set', function (value, callback) {
      this.log.debug("LightStrip -> "+value);
      this.setLightStrip(value);
      callback();
    }.bind(this))
    .on('get', this.getLightStrip);
    
    return [informationService, this.LightStripService]
  }
}


class snFootWarmer {
  constructor (log, accessory, snapi, timer) {
    this.log = log;
    this.accessory = accessory;
    this.snapi = snapi;
    this.warmingValue = 0;
    this.sideName = this.accessory.context.sideName;
    this.timer = timer;
    
    this.footWarmerService = this.accessory.getService(this.sideName+'FootWarmer');
    
    this.getFootWarmer = this.getFootWarmer.bind(this);
    this.setFootWarmer = this.setFootWarmer.bind(this);
    this.updateFootWarmer = this.updateFootWarmer.bind(this);
  }
  
  // Send a new sleep number to the bed
  setFootWarmer (value) {
    let side = this.accessory.context.side;
    let warmingValue;
    switch(value) {
      case 1  : warmingValue = '31'; break;
      case 2  : warmingValue = '57'; break;
      case 3  : warmingValue = '72'; break;
      default : warmingValue =  '0'; break;
    }
    this.log.debug('Setting foot warmer to='+warmingValue+' on side='+side+', with timer='+this.timer);
    try {
      this.snapi.footWarming(side, warmingValue, this.timer, (data, err=null) => {
      if (err) {
        this.log.debug(data, err);
      } else {
          this.log.debug("Foot Warmer PUT result:", data)
        }
      });
    } catch(err) {
      this.log('Failed to set sleep number='+warmingValue+' on side='+side+', with timer='+this.timer+' :', err);
    }
  }
  
  // Keep sleep number updated with external changes through sleepIQ app
  updateFootWarmer(value) {
    switch(value) {
      case '31': this.warmingValue = 1; break;
      case '57': this.warmingValue = 2; break;
      case '72': this.warmingValue = 3; break;
      default: this.warmingValue = 0; break;
    }
  }
  
  getFootWarmer (callback) {
    return callback(null, this.warmingValue);
  }
  
  getServices () {
    
    let informationService = this.accessory.getService(Service.AccessoryInformation);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
    .setCharacteristic(Characteristic.Model, "SleepIQ")
    .setCharacteristic(Characteristic.SerialNumber, "360");
    
    this.footWarmerService
    .getCharacteristic(Characteristic.Brightness)
    .on('set', function (value, callback) {
      this.log.debug("Foot Warmer -> "+value)
      this.setFootWarmer(value);
      callback();
    }.bind(this))
    .on('get', this.getFootWarmer.bind(this))
    .setProps({
      minValue: 0,
      maxValue: 3,
      minStep: 1
    });
    
    return [informationService, this.footWarmerService]
  }
}