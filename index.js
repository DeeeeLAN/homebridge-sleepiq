var request = reuire("request");
var request = request.defaults({jar: true})
const Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-SleepIQ", "SleepNumber", SleepNumber)
}

SleepNumber.prototype = {
    getServices: function () {
	let informationService = new Service.AccessoryInformation();
	informationService
	    .setCharacteristic(Characteristic.Manufacturer, "Sleep Number")
	    .setCharacteristic(Characteristic.Model, "SleepIQ")
	    .setCharacteristic(Characteristic.SerialNumber, "360");

	let occupancyService = new Service.OccupancySensor("SleepNumber");
	occupancyService
	    .getCharacteristic(Characteristic.occupancyDetected)
	    .on('get', this.checkOccupancy.bind(this));

	this.informationService = informationService;
	this.occupancyService = occupancyService;
	return [informationService, occupancyService]
    }
};

function SleepNumber(log, config) {
    this.log = log
    this.username = config["username"];
    this.password = config["password"];
    var key, isInBedL, isInBedR
    var tryAgain = false
    var that = this
}

SleepNumber.prototype = {
    checkOccupancy: function (callback) {
	getOccupancy()
	if (this.isInBedL == true) {
	    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
	}
	else {
	    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
	}
	return callback(this.occupancyDetected)
    }
	
    authenticate: function () {
	console.log('SleepIQ Authenticating...')
	request(
	    {
		method: 'PUT',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/login',
		body: JSON.stringify({'login': that.username, 'password': that.password})
	    }, function(err, response, body) {
		let json = JSON.parse(body)
		that.key = json.key
		if(that.tryAgain == true) {
		    that.tryAgain = false
		    that.getOccupancy()
		}
	    }
	)
    }

    getOccupancy: function () {
	console.log('Getting SleepIQ Occupancy...')
	request(
	    {
		method: 'GET',
		uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/familyStatus' + '?_k=' + that.key
	    }, function(err, response, body) {
		let json = JSON.parse(body);
		if(json.hasOwnProperty('Error')) {
		    if (json.Error.Code == 50002) {
			console.log('SleepIQ Authentication Failed')
			that.tryAgain = true
			that.authenticate()
		    }
		}
		else {
		    that.isInBedL = json.beds[0].leftSide.isInBed
		    that.isInBedR = json.beds[0].rightSide.isInBed
		}
	    }
	);
    }    
}


    // function setOccupancyDetected(value) {
    // 	return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
    // }

    // function getOccupancyDetected (callback) {
    // 	return callback(null, this.occupancyDetected)
    // }

