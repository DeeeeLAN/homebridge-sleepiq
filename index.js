'use strict'
var request = require("request");
var request = request.defaults({jar: true})
var EventEmitter = require("events").EventEmitter
var Service, Characteristic

module.exports = function (homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    homebridge.registerAccessory("homebridge-SleepIQ", "SleepNumber", SleepNumber)
}

class SleepNumber {
    constructor (log, config) {
	this.log = log
	this.name = config["name"]
	this.username = config["username"]
	this.password = config["password"]
	this.bedSide = config["side"]
	this.occupancyService = new Service.OccupancySensor(this.name)
	this.key = new EventEmitter()
	this.isInBed
	this.isInBedL
	this.isInBedR
	this.tryAgain = false
	this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
	this.checkOccupancy()
	setInterval(this.checkOccupancy.bind(this), 3000)
    }

    checkOccupancy () {
	this.getOccupancy()
	if (this.bedSide == "left") {
	    this.isInBed = this.isInBedL
	} else {
	    this.isInBed = this.isInBedR
	}
	if (this.isInBed == true) {
	    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
	}
	else {
	    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
	}
	this.setOccupancyDetected(this.occupancyDetected)
    }

    setOccupancyDetected (value) {
	return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
    }

    getOccupancyDetected (callback) {
	return callback(null, this.occupancyDetected)
    }
	
    authenticate () {
	console.debug('SleepIQ Authenticating...')
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
	console.debug('Getting SleepIQ Occupancy...')
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
		    console.debug('SleepIQ Authentication Failed')
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

    getServices () {
	let informationService = new Service.AccessoryInformation()
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


