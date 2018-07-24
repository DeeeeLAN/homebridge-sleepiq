'use strict'
var request = require("request");
var request = request.defaults({jar: true})
var EventEmitter = require("events").EventEmitter
var Accessory, Service, Characteristic, UUIDGen

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    UUIDGen = homebridge.hap.uuid
    homebridge.registerPlatform("homebridge-SleepIQ", "SleepNumber", SleepNumberPlatform, true)
}

class SleepNumberPlatform {
    constructor (log, config, api) {
	this.log = log
	this.config = config
	this.username = config["username"]
	this.password = config["password"]
	this.bedSides = config["sides"]
	this.refreshTime = config["refreshTime"] * 1000
	this.accessories = []
	this.key = new EventEmitter()

	this.isInBedL
	this.isInBedR

	if (api) {
	    this.api = api

	    this.api.on('didFinishLaunching', function () {
		this.log("API Finished Launching")
		this.didFinishLaunching()
	    }.bind(this))
	}

    }

    didFinishLaunching () {
	this.setupSides()
	this.checkOccupancy()
	setInterval(this.checkOccupancy.bind(this), this.refreshTime)
    }

    addAccessory () {
	this.setupSides()
    }

    removeAccessory () {
	this.log('Remove Accessories')
	this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", this.accessories)
	this.accessories = []
    }

    // called during setup, restores from cache (reconfigure instead of create new)
    configureAccessory (accessory) {
	this.log("Configuring Accessory: ", accessory.displayName)
	this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [accessory])
	//	this.accessories.push(accessory)
    }

    setupSides() {
	if (this.bedSides.includes('left')) {
	    this.log("adding left side")
	    var uuid = UUIDGen.generate('SN-Left')
	    this.bedSideL = new Accessory('SN-Left', uuid)
	    this.bedSideL.addService(Service.OccupancySensor, 'SN-Left')
	    this.SNLeft = new SleepNumber(this.log, this.bedSideL, this.occupancyDetectedL)
	    this.SNLeft.getServices()
	    this.accessories.push(this.bedSideL)
	}
	
	if (this.bedSides.includes('right')) {
	    this.log("adding right side")
	    var uuid = UUIDGen.generate('SN-Right')
	    this.bedSideR = new Accessory('SN-Right', UUIDGen.generate('SN-Right'))
	    this.bedSideR.addService(Service.OccupancySensor, 'SN-Right')
	    this.SNRight = new SleepNumber(this.log, this.bedSideR, this.occupancyDetectedR)
	    this.SNRight.getServices()
	    this.accessories.push(this.bedSideR)
	}
	this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", this.accessories)
	this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', this.accessories)
    }
    
    checkOccupancy () {
	this.getOccupancy()
	if (this.bedSides.includes('left')) {
	    if (this.isInBedL == true) {
		this.SNLeft.setOccupancyDetected(Characteristic.OccupancyDetected.OCCUPANCY_DETECTED)
	    }
	    else {
		this.SNLeft.setOccupancyDetected(Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED)
	    }
	}
	if (this.bedSides.includes('right')) {
	    if (this.isInBedR == true) {
		this.SNRight.setOccupancyDetected(Characteristic.OccupancyDetected.OCCUPANCY_DETECTED)
	    }
	    else {
		this.SNRight.setOccupancyDetected(Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED)
	    }
	}
    }

    setOccupancyDetected (value, side) {
	return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
    }



    authenticate () {
	this.log('SleepIQ Authenticating...')
	var body = new EventEmitter()
	request(
	    {
		method: 'PUT',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/login',
		body: JSON.stringify({'login': this.username, 'password': this.password})
	    }, function (err, response, data) {
		body.data = data
		body.emit('updateKey')
	    })
	body.on('updateKey', function () {
	    let json = JSON.parse(body.data)
	    this.key.key = json.key
	    this.key.emit('update')
	}.bind(this))
    }

    getOccupancy () {
	this.log('Getting SleepIQ Occupancy...')
	var body = new EventEmitter()
	request(
	    {
		method: 'GET',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/familyStatus',
		qs: {
		    _k: this.key.key
		}
	    },
	    function (err, response, data) {
		body.data = data
		body.emit('updateStat')
	    }
	)
	body.on('updateStat', function () {
	    let json = JSON.parse(body.data);
	    if(json.hasOwnProperty('Error')) {
		if (json.Error.Code == 50002) {
		    this.log('SleepIQ Authentication Failed')
		    this.authenticate()
		    this.key.on('update', function() {
			this.getOccupancy()
		    }.bind(this))
		}
	    }
	    else {
		this.isInBedL = json.beds[0].leftSide.isInBed
		this.isInBedR = json.beds[0].rightSide.isInBed
	    }
	}.bind(this))
    }


}

class SleepNumber {
    constructor (log, accessory, occupancyDetected) {
	this.log = log
	this.accessory = accessory
	this.occupancyDetected = occupancyDetected
	this.occupancyService = this.accessory.getService(Service.OccupancySensor)
    }

    setOccupancyDetected (value) {
	this.occupancyDetected = value
	return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
    }

    getOccupancyDetected (callback) {
	return callback(null, this.occupancyDetected)
    }

    getServices () {
	let informationService = this.accessory.getService(Service.AccessoryInformation)
	informationService
	    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
	    .setCharacteristic(Characteristic.Model, "SleepIQ")
	    .setCharacteristic(Characteristic.SerialNumber, "360")

	this.occupancyService
	    .getCharacteristic(Characteristic.OccupancyDetected)
	    .on('get', this.getOccupancyDetected.bind(this))
	
	return [informationService, this.occupancyService]
    }
}


