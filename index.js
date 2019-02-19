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
	this.snapi.json.beds.forEach( function (bed, index) {
	    let bedName = "bed" + index
	    let bedID = bed.bedId
	    let sides = JSON.parse(JSON.stringify(bed))
	    delete sides.status
	    delete sides.bedId
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

		    bedSide.addService(Service.Lightbulb, sideName+'Number');
		    bedSide.addService(Service.OccupancySensor, sideName+'Occupancy');
		    let numberService = bedSide.getService(Service.Lightbulb);
		    numberService.addCharacteristic(Characteristic.Brightness);

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
	this.snapi.login(() => this.key.emit('update'));
    }

    fetchData () {
	this.log.debug('Getting SleepIQ JSON Data...')
	let body = new EventEmitter()
	this.snapi.familyStatus( () => body.emit('updateData'));
	body.on('updateData', function () {
	    if(this.snapi.json.hasOwnProperty('Error')) {
		if (this.snapi.json.Error.Code == 50002) {
		    this.log.debug('SleepIQ authentication failed, stand by for automatic reauthentication')
		    this.authenticate()
		    this.key.on('update', function() {
			this.fetchData()
		    }.bind(this))
		}
	    } else {
		this.log.debug('SleepIQ JSON data successfully retrieved')
		this.json.emit('updateData')
	    }
	}.bind(this))
    }

    checkOccupancy () {
	this.snapi.json.beds.forEach( function (bed, index) {
	    let bedID = bed.bedId
	    let sides = JSON.parse(JSON.stringify(bed))
	    delete sides.status
	    delete sides.bedId
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
		    bedSideAccessory.setOccupancyDetected(sides[bedside].isInBed)
		    bedSideAccessory.updateSleepNumber(sides[bedside].sleepNumber)
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
	this.sleepNumber = 50;

	this.numberService = this.accessory.getService(Service.Lightbulb);
	this.occupancyService = this.accessory.getService(Service.OccupancySensor);

	this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;

	if (!this.numberService) {
	    let sideName = this.accessory.context.sideId.indexOf('leftSide') !== -1 ? 'leftSide' : 'rightSide';
	    this.accessory.addService(Service.Lightbulb, sideName+'Number');
	    this.numberService = this.accessory.getService(Service.Lightbulb);
	    this.numberService.addCharacteristic(Characteristic.Brightness);
	    
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

    setSleepNumber (value) {
	let side = '';
	if (this.accessory.context.side) {
	    side = this.accessory.context.side;
	} else {
	    side = this.accessory.context.sideId.indexOf('leftSide') !== -1 ? 'L' : 'R';
	}
	this.log.debug('Setting sleep number='+value+' on side='+side);
	this.snapi.sleepNumber(side, value);
    }

    updateSleepNumber(value) {
	this.sleepNumber = value;
	// this.numberService.setCharacteristic(Characteristic.On, true);

	//return this.lightService.setCharacteristic(Characteristic.Brightness, value);
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

	return [informationService, this.occupancyService, this.numberService]
    }
}


