'use strict'
var request = require("request");
var request = request.defaults({jar: true})
var EventEmitter = require("events").EventEmitter
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
	this.key = new EventEmitter();
	this.json = new EventEmitter();
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
	this.json.on('updateData', this.checkOccupancy.bind(this)) // processes new JSON every time data is updated
	this.fetchData() // initial data grab
	setInterval(this.fetchData.bind(this), this.refreshTime) // continue to grab data every few seconds
    }

    addAccessories () {
	this.snapi.json.beds.forEach( async function (bed, index) {
	    let bedName = "bed" + index
	    let bedID = bed.bedId
	    let sides = JSON.parse(JSON.stringify(bed))
	    delete sides.status
	    delete sides.bedId

	    var foundationStatus;
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
	    
	    Object.keys(sides).forEach( function (bedside, index) {
		let sideName = bedName+bedside
		let sideID = bedID+bedside
		if(!this.accessories.has(sideID)) {
		    this.log("Found BedSide: ", sideName)
		    
		    let uuid = UUIDGen.generate(sideID)
		    let bedSide = new Accessory(sideName, uuid)
		    bedSide.context.sideId = bedID+bedside;
		    bedSide.context.side = bedside[0].toUpperCase();
		    bedSide.context.sideName = sideName;
		    bedSide.context.hasFoundation = this.hasFoundation;
		    bedSide.addService(Service.Lightbulb, sideName+'Number');
		    bedSide.addService(Service.OccupancySensor, sideName+'Occupancy');
		    let numberService = bedSide.getService(Service.Lightbulb, sideName+'Number');
		    numberService.addCharacteristic(Characteristic.Brightness);

		    if(this.hasFoundation) {
			this.log("Foundation detected");
			bedSide.addService(Service.Lightbulb, sideName+'FoundationHead');
			let foundationHeadService = bedSide.getService(Service.Lightbulb, sideName+'FoundationHead');
			foundationHeadService.addCharacteristic(Characteristic.Brightness);
			bedSide.addService(Service.Lightbulb, sideName+'FoundationFoot');
			let foundationFootService = bedSide.getService(Service.Lightbulb, sideName+'FoundationFoot');
			foundationFootService.addCharacteristic(Characteristic.Brightness);
		    }

		    
		    let bedSideAccessory = new SleepNumber(this.log, bedSide, this.snapi)
		    bedSideAccessory.getServices()
		    
		    this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSide])
		    this.accessories.set(sideID, bedSideAccessory)
		} else {
		    this.log(sideName + " already added from cache")
		}
	    }.bind(this))
	}.bind(this))
    }
    
    removeAccessory (side) {
    	this.log('Remove Accessory: ', side.accessory.displayName)
    	this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [side.accessory])
    	this.accessories.delete(side.accessory.context.sideId)
    }

    // called during setup, restores from cache (reconfigure instead of create new)
    configureAccessory (accessory) {
	this.log("Configuring Accessory: ", accessory.displayName)
	accessory.reachable = true
	let bedSideAccessory = new SleepNumber(this.log, accessory, this.snapi)
	bedSideAccessory.getServices()
	this.accessories.set(accessory.context.sideId, bedSideAccessory)

    }
    
    authenticate () {
	this.log.debug('SleepIQ Authenticating...')
	this.snapi.login((data, err=null) => {
	    if (err) {
		this.log.debug(data, err);
	    } else {
		this.log.debug("Login result:", data);
	    }
	    this.key.emit('update')
	});
    }

    fetchData () {
	this.log.debug('Getting SleepIQ JSON Data...')
	let body = new EventEmitter()
	this.snapi.familyStatus( (data, err=null) => {
	    if (err) {
		this.log.debug(data, JSON.stringify(err));
	    } else {
	   	this.log.debug("Family Status GET results:", data);
	    }
	    body.emit('updateData');
	});

	body.on('updateData', function () {
	    if(this.snapi.json.hasOwnProperty('Error')) {
		if (this.snapi.json.Error.Code == 50002 || this.snapi.json.Error.Code == 401) {
		    this.log.debug('SleepIQ authentication failed, stand by for automatic reauthentication')
		    this.authenticate()
		    this.key.on('update', function() {
			this.fetchData()
		    }.bind(this))
		} else {
		    this.log('SleepIQ authentication failed with an unknown error code. Please report this incident at https://github.com/DeeeeLAN/homebridge-sleepiq/issues/new');
		    this.log('Exiting...');
		    process.exit(1);
		}
	    } else {
		this.log.debug('SleepIQ JSON data successfully retrieved')
		this.json.emit('updateData')
	    }
	}.bind(this))
    }

    checkOccupancy () {
	this.snapi.json.beds.forEach(async function (bed, index) {
	    let bedID = bed.bedId
	    let sides = JSON.parse(JSON.stringify(bed))
	    delete sides.status
	    delete sides.bedId

	    var foundationPositions;
	    if (this.hasFoundation) {
		await this.snapi.foundationStatus(data => foundationPositions = JSON.parse(data));
	    }
	    Object.keys(sides).forEach( function (bedside, index) {
		let sideID = bedID+bedside
		if(!this.accessories.has(sideID)) {
		    this.log("new bedside detected")
		    this.addAccessories()
		    return
		} else {
		    this.log.debug('SleepIQ Occupancy Data: {' + bedside + ':' + sides[bedside].isInBed + '}')
		    this.log.debug('SleepIQ Sleep Number: {' + bedside + ':' + sides[bedside].sleepNumber + '}')
		    let bedSideAccessory = this.accessories.get(sideID)
		    bedSideAccessory.setOccupancyDetected(sides[bedside].isInBed);
		    bedSideAccessory.updateSleepNumber(sides[bedside].sleepNumber);
		    if (this.hasFoundation) {
			if (bedSide == 'leftSide') {
			    bedSideAccessory.updateFoundation(foundationPositions.fsLeftHeadPosition, foundationPositions.fsLeftFootPosition);
			} else {
			    bedSideAccessory.updateFoundation(foundationPositions.fsRightHeadPosition, foundationPositions.fsRightFootPosition);
			}
		    }
		}
	    }.bind(this))
	}.bind(this))
    }

}

class SleepNumber {
    constructor (log, accessory, snapi) {
	this.log = log;
	this.accessory = accessory;
	this.snapi = snapi;
	this.hasFoundation = this.accessory.context.hasFoundation;
	this.sleepNumber = 50;
	this.headPosition = 0;
	this.footPosition = 0;
	this.sideName = this.accessory.context.sideId.indexOf('leftSide') !== -1 ? 'leftSide' : 'rightSide';
	
	this.numberService = this.accessory.getService(Service.Lightbulb, this.sideName+'Number');
	this.occupancyService = this.accessory.getService(Service.OccupancySensor);
	if (this.hasFoundation) {
	    this.foundationHeadService = this.accessory.getService(Service.Lightbulb, this.sideName+'FoundationHead');
	    this.foundationFootService = this.accessory.getService(Service.Lightbulb, this.sideName+'FoundationFoot');
	}
	    
	this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;

	if (!this.numberService) {
	    this.log('numberService not detected as part of accessory. Adding Now');
	    this.accessory.addService(Service.Lightbulb, this.sideName+'Number');
	    this.numberService = this.accessory.getService(Service.Lightbulb, this.sideName+'Number');
	    this.numberService.addCharacteristic(Characteristic.Brightness);
	}
	
	if (!this.foundationHeadService && this.hasFoundation) {
	    this.log('foundationHeadService not detected as part of accessory. Adding Now');
	    this.accessory.addService(Service.Lightbulb, this.sideName+'FoundationHead');
	    this.foundationHeadService = this.accessory.getService(Service.Lightbulb, this.sideName+'FoundationHead');
	    this.foundationHeadService.addCharacteristic(Characteristic.Brightness);
	}
	if (!this.foundationFootService && this.hasFoundation) {
	    this.log('foundationFootService not detected as part of accessory. Adding Now');
	    this.accessory.addService(Service.Lightbulb, this.sideName+'FoundationFoot');
	    this.foundationFootService = this.accessory.getService(Service.Lightbulb, this.sideName+'FoundationFoot');
	    this.foundationFootService.addCharacteristic(Characteristic.Brightness);
	}

	this.numberService.setCharacteristic(Characteristic.On, true);
	

	this.getSleepNumber = this.getSleepNumber.bind(this);
	this.setSleepNumber = this.setSleepNumber.bind(this);
	this.updateSleepNumber = this.updateSleepNumber.bind(this);
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

    // Send a new sleep number to the bed
    setSleepNumber (value) {
	let side = '';
	if (this.accessory.context.side) {
	    side = this.accessory.context.side;
	} else {
	    side = this.accessory.context.sideId.indexOf('leftSide') !== -1 ? 'L' : 'R';
	}
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

    // Send a new foundation position to the bed
    setFoundation (actuator, value) {
	let side = '';
	if (this.accessory.context.side) {
	    side = this.accessory.context.side;
	} else {
	    side = this.accessory.context.sideId.indexOf('leftSide') !== -1 ? 'L' : 'R';
	}
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

	this.occupancyService
	    .getCharacteristic(Characteristic.OccupancyDetected)
	    .on('get', this.getOccupancyDetected.bind(this))

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

	if (this.hasFoundation) {
	    this.foundationHeadService
		.getCharacteristic(Characteristic.Brightness)
		.on('set', function (value, callback) {
		    this.log.debug("Foundation Head -> "+value);
		    this.setFoundation('H', value);
		    callback();
		}.bind(this))
		.on('get', ((callback) => {this.getFoundation('H', callback)}).bind(this))
	    
	    this.foundationFootService
		.getCharacteristic(Characteristic.Brightness)
		.on('set', function (value, callback) {
		    this.log.debug("Foundation Foot -> "+value);
		    this.setFoundation('F', value);
		    callback();
		}.bind(this))
		.on('get', ((callback) => {this.getFoundation('F', callback)}).bind(this))
	}

	return this.hasFoundation ? [informationService, this.occupancyService, this.numberService, this.foundationHeadService, this.foundationFootService] : [informationService, this.occupancyService, this.numberService]
    }
}


