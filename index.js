var request = reuire("request");
var request = request.defaults({jar: true})
const Service, Characteristic;


module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-sleepiq", "SleepNumber", SleepNumberBed)
};

class SleepNumberBed {
    function constructor(log, config) {
	this.username = config["username"];
	this.password = config["password"];
	this.log = log;
	this.occupancyService = new Service.OccupancySensor(this.name);
	this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
	this.checkOccupancy()
	setInterval(this.checkOccupancy.bind(this), 1800 * 1000)
    }

    function checkOccupancy() {
	bedStatus = getOccupancy().bind(this)
	if bedStatus[0] == true {
	    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED∑
	}
	else {
	    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
	}
	this.setOccupancyDetected(this.occupancyDetected)
    }

    function setOccupancyDetected(value) {
	return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
    }

    function getOccupancyDetected (callback) {
	return callback(null, this.occupancyDetected)
    }

    function authenticate() {
	r = request(
	    {
		method: 'PUT',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/login',
		body: JSON.stringify({'login': this.username, 'password': this.password})
	    }, function(err, response, body) {
		var json = JSON.parse(body);
		var key = json.key;
	    }.bind(this)
	);
    }

    function getOccupancy() {
	r = request(
	    {
		method: 'GET',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/familyStatus' + '?_k=' + this.key
	    }, function(err, response, body) {
		var json = JSON.parse(body);
		if json.Error.Code == 50002 {
		    authenticate();
		    return getOccupancy();
		}
		else {
		    this.isInBedL = JSON.parse(r.response.body).beds[0].leftSide.isInBed;
		    this.isInBedR = JSON.pares(r.response.body).beds[0].rightSide.isInBed;
		    return [this.isInBedL, this.isInBedR]
		}
	    }
	);
    }    
    

    SleepNumberBed.prototype.getState = function(callback) {
	this.log("Getting current state...");

	getOccupancy();
	
	getServices: function () {
	    let informationService = new Service.AccessoryInformation();
	    informationService
		.setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
		.setCharacteristic(Characteristic.Model, "SleepIQ")
		.setCharacteristic(Characteristic.SerialNumber, "360");

	    this.occupancyService
		.getCharacteristic(Characteristic.OccupancyDetected)
		.on('get', this.getOccupancy.bind(this))
	    return [informationService, this.occupancyService]
	}
    }
