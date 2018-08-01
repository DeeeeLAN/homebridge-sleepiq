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
	this.refreshTime = config["refreshTime"] * 1000
	this.accessories = new Map()
	this.key = new EventEmitter()
	this.json = new EventEmitter()
	
	if (api) {
	    this.api = api

	    this.api.on('didFinishLaunching', function () {
		this.log("API Finished Launching")
		this.didFinishLaunching()
	    }.bind(this))
	}

    }

    didFinishLaunching () {
	this.checkOccupancy()
	setInterval(this.checkOccupancy.bind(this), this.refreshTime)
    }

    addAccessories () {
	this.json.json.beds.forEach( function (bed, index) {
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
		    bedSide.context.sideId = bedID+bedside
		    bedSide.addService(Service.OccupancySensor, sideName)
		    
		    let bedSideAccessory = new SleepNumber(this.log, bedSide)
		    bedSideAccessory.getServices()
		    
		    this.api.registerPlatformAccessories('homebridge-SleepIQ', 'SleepNumber', [bedSide])
		    this.accessories.set(sideID, bedSideAccessory)
		} else {
		    this.log(sideName + " already added from cache")
		}
	    }.bind(this))
	}.bind(this))
    }
    
    removeAccessory (accessory) {
    	this.log('Remove Accessory: ', accessory.accessory.displayName)
    	this.api.unregisterPlatformAccessories("homebridge-SleepIQ", "SleepNumber", [accessory.accessory])
    	this.accessories.delete(accessory.accessory.context.sideId)
    }

    // called during setup, restores from cache (reconfigure instead of create new)
    configureAccessory (accessory) {
	this.log("Configuring Accessory: ", accessory.displayName)
	accessory.reachable = true
	let bedSideAccessory = new SleepNumber(this.log, accessory)
	bedSideAccessory.getServices()
	this.accessories.set(accessory.context.sideId, bedSideAccessory)

    }

/*
    beds[0..n].bedId+[left|right]
    beds[0..n].[left|right]Side.isInBed
    {"beds":
     [
	 {"status":1,
	  "bedId":"-9223372019955931774",
	  "leftSide":{"isInBed":false,
		      "alertDetailedMessage":"No Alert",
		      "sleepNumber":35,
		      "alertId":0,
		      "lastLink":"00:00:00",
		      "pressure":1304},
	  "rightSide":{"isInBed":false,
		       "alertDetailedMessage":"No Alert",
		       "sleepNumber":40,
		       "alertId":0,
		       "lastLink":"00:00:00",
		       "pressure":1265}
	 }
     ]
    }
*/        
    checkOccupancy () {
	this.fetchData()
	this.json.on('updateData', function () {
	    this.json.json.beds.forEach( function (bed, index) {
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
			let bedSideAccessory = this.accessories.get(sideID)
			bedSideAccessory.setOccupancyDetected(bedside.isInBed)
		    }			
		}.bind(this))
	    }.bind(this))
	}.bind(this))
    }

    authenticate () {
	this.log('SleepIQ Authenticating...')
	let body = new EventEmitter()
	request(
	    {
		method: 'PUT',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/login',
		body: JSON.stringify({'login': this.username, 'password': this.password})
	    }, function (err, response, data) {
		body.data = data
		body.emit('updateKey')
	    }.bind(this))
	body.on('updateKey', function () {
	    let jsonKey = JSON.parse(body.data)
	    this.key.key = jsonKey.key
	    this.key.emit('update')
	}.bind(this))
    }

    fetchData () {
	this.log('Getting SleepIQ JSON Data...')
	let body = new EventEmitter()
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
		body.emit('updateData')
	    }.bind(this)
	)
	body.on('updateData', function () {
	    this.json.json = JSON.parse(body.data);
	    if(this.json.json.hasOwnProperty('Error')) {
		if (this.json.json.Error.Code == 50002) {
		    this.log('SleepIQ Authentication Failed')
		    this.authenticate()
		    this.key.on('update', function() {
			this.fetchData()
		    }.bind(this))
		}
	    } else {
		this.json.emit('updateData')
	    }
	}.bind(this))
    }


}

class SleepNumber {
    constructor (log, accessory) {
	this.log = log
	this.accessory = accessory
	this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
	this.occupancyService = this.accessory.getService(Service.OccupancySensor)
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


