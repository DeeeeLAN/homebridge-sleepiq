'use strict'
var Accessory, Service, Characteristic, UUIDGen
var snapi = require('./API.js')

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    UUIDGen = homebridge.hap.uuid
    homebridge.registerPlatform("homebridge-SleepIQ", "SleepNumber", SleepNumberPlatform, true)
}

class SleepNumberPlatform {
    constructor (log, config, api) {
	this.log = log;
	this.config = config;
	this.username = config["username"];
	this.password = config["password"];
	this.refreshTime = (config["refreshTime"] || 5) * 1000;
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

    didFinishLaunching () {
        // await this.authenticate();
        // await this.snapi.
        // await this.addAccessories();
        setInterval(this.fetchData.bind(this), this.refreshTime) // continue to grab data every few seconds
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
            this.log("Promise error:",err);
        }
    }


    addAccessories () {
	this.snapi.json.beds.forEach( async function (bed, index) {
	    let bedName = "bed" + index
	    let bedID = bed.bedId
	    let sides = JSON.parse(JSON.stringify(bed))
	    delete sides.status
	    delete sides.bedId

	    var foundationStatus;
            try {
	        await this.snapi.foundationStatus((data, err=null) => {
		    if (err) {
		        this.log.debug(data, err);
		    } else {
		        this.log.debug("foundationStatus result:", data);
		        foundationStatus = JSON.parse(data);
		        if(foundationStatus.hasOwnProperty('Error')) {
			    if (foundationStatus.Error.Code == 404) {
			        this.log("No foundation detected");
			    } else {
			        this.log("Unknown error occured when checking the foundation status. See previous output for more details. Please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new");
			        this.log("Exiting...");
			        process.exit(1);
			    }
		        } else {
			    this.hasFoundation = true;
		        }
		    }
	        });
            } catch(err) {
                if (!err.StatusCodeError === 404) {
                    this.log("Promise error:", err);
                    process.exit(1);
                }
            }

	    
	    Object.keys(sides).forEach( function (bedside, index) {
		let sideName = bedName+bedside
		let sideID = bedID+bedside
		if(!this.accessories.has(sideID+'occupancy')) {
		    this.log("Found BedSide Occupancy Sensor: ", sideName);
		    
		    let uuid = UUIDGen.generate(sideID+'occupancy');
		    let bedSideOcc = new Accessory(sideName, uuid);

                    bedSideOcc.context.sideID = sideID+'occupancy';
                    bedSideOcc.context.type = 'occupancy';
                    
                    bedSideOcc.addService(Service.OccupancySensor, sideName+'Occupancy');

		    let bedSideOccAccessory = new snOccupancy(this.log, bedSideOcc);
		    bedSideOccAccessory.getServices();
		    
		    this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSideOcc]);
		    this.accessories.set(sideID+'occupancy', bedSideOccAccessory);
                } else {
		    this.log(sideName + " occupancy already added from cache");
		}

                if (!this.accessories.has(sideID+'number')) {
                    this.log("Found BedSide Number Control: ", sideName);

                    let uuid = UUIDGen.generate(sideID+'number');
                    let bedSideNum = new Accessory(sideName, uuid);

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
                        let bedSideFlex = new Accessory(sideName, uuid);

                        bedSideFlex.context.side = bedside[0].toUpperCase();
                        bedSideFlex.context.sideID = sideID+'flex';
                        bedSideFlex.context.sideName = sideName;
                        bedSideFlex.context.type = 'flex';

		        bedSideFlex.addService(Service.Lightbulb, sideName+'FlexHead');
		        let flexHeadService = bedSide.getService(Service.Lightbulb, sideName+'FlexHead');
		        flexHeadService.addCharacteristic(Characteristic.Brightness);
		        bedSideFlex.addService(Service.Lightbulb, sideName+'FlexFoot');
		        let flexFootService = bedSide.getService(Service.Lightbulb, sideName+'FlexFoot');
		        flexFootService.addCharacteristic(Characteristic.Brightness);

                        let bedSideFlexAccessory = new snFlex(this.log, bedSideFlex, this.snapi);
                        bedSideFlexAccessory.getServices();

                        this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSideFlex])
		        this.accessories.set(sideID+'flex', bedSideFlexAccessory)
                    } else {
		        this.log(sideName + " flex foundation already added from cache")
		    }
                }

	    }.bind(this))
	}.bind(this))
    }
    
    removeAccessory (side) {
    	this.log('Remove Accessory: ', side.accessory.displayName)
    	this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [side.accessory])
    	this.accessories.delete(side.accessory.context.sideID)
    }

    // called during setup, restores from cache (reconfigure instead of create new)
    configureAccessory (accessory) {
	this.log("Configuring Accessory: ", accessory.displayName)
        switch(accessory.context.type) {
        case 'occupancy':
            accessory.reachable = true;
            let bedSideOccAccessory = new snOccupancy(this.log, accessory);
            bedSideOccAccessory.getServices();
            this.accessories.set(accessory.context.sideID, bedSideOccAccessory);
            break;
        case 'number':
            accessory.reachable = true;
            let bedSideNumAccessory = new snNumber(this.log, accessory, this.snapi);
            bedSideNumAccessory.getServices();
            this.accessories.set(accessory.context.sideID, bedSideNumAccessory);
            break;
        case 'flex':
            accessory.reachable = true;
            let bedSideFlexAccessory = new snOccupancy(this.log, accessory, this.snapi);
            bedSideFlexAccessory.getServices();
            this.accessories.set(accessory.context.sideID, bedSideFlexAccessory);
            break;
        default:
            this.log.debug("Unkown accessory type. Removing from accessory cache.");
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
		    this.log.debug(data, JSON.stringify(err));
	        } else {
	   	    this.log.debug("Family Status GET results:", data);
	        }
	    });
        } catch(err) {
            if (!err.StatusCodeError === 401) {
                this.log("Promise error:",err);
                process.exit(1);
            }
        }

	if(this.snapi.json.hasOwnProperty('Error')) {
	    if (this.snapi.json.Error.Code == 50002 || this.snapi.json.Error.Code == 401) {
		this.log.debug('SleepIQ authentication failed, stand by for automatic reauthentication')
		await this.authenticate();
		//this.fetchData();
	    } else {
		this.log('SleepIQ authentication failed with an unknown error code. Please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
		this.log('Exiting...');
		process.exit(1);
	    }
	} else {
            bedData = JSON.parse(JSON.stringify(this.snapi.json));

            if (this.hasFoundation) {
	        await this.snapi.foundationStatus( (data, err=null) => {
	            if (err) {
		        this.log.debug(data, JSON.stringify(err));
	            } else {
	   	        this.log.debug("Foundation Status GET results:", data);
	            }
                });
                
                flexData = JSON.parse(JSON.stringify(this.snapi.json));
	    }
            
            this.log.debug('SleepIQ JSON data successfully retrieved')
            this.parseData(bedData, flexData);

	}
        
    }

    parseData (bedData, flexData) {
	bedData.beds.forEach(function (bed, index) {
	    let bedID = bed.bedId
	    let sides = JSON.parse(JSON.stringify(bed))
	    delete sides.status
	    delete sides.bedId

	    Object.keys(sides).forEach(function (bedside, index) {
		let sideID = bedID+bedside
		if(!this.accessories.has(sideID+'occupancy')) {
		    this.log("New bedside detected.")
		    this.addAccessories();
		    return
		} else {
		    this.log.debug('SleepIQ Occupancy Data: {' + bedside + ':' + sides[bedside].isInBed + '}')
                    let bedSideOccAccessory = this.accessories.get(sideID+'occupancy');
		    bedSideOccAccessory.setOccupancyDetected(sides[bedside].isInBed);
		    
                    this.log.debug('SleepIQ Sleep Number: {' + bedside + ':' + sides[bedside].sleepNumber + '}')
                    let bedSideNumAccessory = this.accessories.get(sideID+'number');
                    bedSideNumAccessory.updateSleepNumber(sides[bedside].sleepNumber);

		    if (this.hasFoundation) {
			if (bedSide == 'leftSide') {
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
	}.bind(this))
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
    constructor (log, accessory, snapi) {
	this.log = log;
	this.accessory = accessory;
	this.snapi = snapi;
	this.sleepNumber = 50;
	this.sideName = this.accessory.context.sideName;
        
	this.numberService = this.accessory.getService(Service.Lightbulb, this.sideName+'Number');
	this.numberService.setCharacteristic(Characteristic.On, true);
	

	this.getSleepNumber = this.getSleepNumber.bind(this);
	this.setSleepNumber = this.setSleepNumber.bind(this);
	this.updateSleepNumber = this.updateSleepNumber.bind(this);
    }

    // Send a new sleep number to the bed
    setSleepNumber (value) {
	let side = this.accessory.context.side;
	this.log.debug('Setting sleep number='+value+' on side='+side);
	this.snapi.sleepNumber(side, value, (data, err=null) => {
	    if (err) {
		this.log.debug(data, err);
	    } else {
		this.log.debug("Sleep Number PUT result:", data)
	    }
	});
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
		this.setSleepNumber(value);
		callback()
	    }.bind(this))
	    .on('get', this.getSleepNumber.bind(this))

	this.numberService
	    .getCharacteristic(Characteristic.On)
	    .on('change', function (oldValue, newValue) {
		if (!newValue) {
		    setTimeout(() => this.numberService.setCharacteristic(Characteristic.On, true), 250);
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
        
	this.foundationHeadService = this.accessory.getService(Service.Lightbulb, this.sideName+'FoundationHead');
	this.foundationFootService = this.accessory.getService(Service.Lightbulb, this.sideName+'FoundationFoot');

        this.setFoundation = this.setFoundation.bind(this);
        this.updateFoundation = this.updateFoundation.bind(this);
        this.getFoundation = this.getFoundation.bind(this);
        
    }


    // Send a new foundation position to the bed
    setFoundation (actuator, value) {
	let side = this.accessory.context.side;
	this.log.debug('Setting foundation position='+value+' on side='+side+' for position='+actuator);
	this.snapi.adjust(side, actuator, value, (data, err=null) => {
	    if (err) {
		this.log.debug(data, err);
	    } else {
		this.log.debug("adjust PUT result:", data)
	    }
	});
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
	
	this.foundationFootService
	    .getCharacteristic(Characteristic.Brightness)
	    .on('set', function (value, callback) {
		this.log.debug("Foundation Foot -> "+value);
		this.setFoundation('F', value);
		callback();
	    }.bind(this))
	    .on('get', (callback) => this.getFoundation('F', callback))

	return [informationService, this.foundationHeadService, this.foundationFootService]
    }
}



