/*
 * The following is my documentation of the available API requests that have 
 * been discovered. I pulled these from 
 *  - https://github.com/technicalpickles/sleepyq, 
 *  - https://github.com/erichelgeson/sleepiq, and 
 *  - https://github.com/natecj/sleepiq-php, 
 * removing the request links that no longer work. 
 * 
 * As of December 2018, I have discovered the additional API requests 
 * needed to control the pressure of the bed
 * 
 * If anybody discovers other features of the API, let me know!
 * 
 * To use, launch node in the same directory as this file, then create an
 * object with
 *| > API = require('./API.js') 
 *| > api = new API('username','password')
 * 
 * List of class methods:
 * - api.login()          : required first
 * - api.genURL()         : allows for passing any url extension in
 * - api.registration()   : 
 * - api.familyStatus()   : where the useful homekit information is
 * - api.sleeper()        : 
 * - api.bed()            : 
 * 
 * The next five require familyStatus() or bed() to be called first to get a bedID
 * - api.bedStatus()      : 
 * - api.bedPauseMode()   : 
 * - api.sleepNumber()    : Used to set the sleep number for a side
 * - api.forceIdle()      : Stops the pump
 * - api.pumpStatus()     : 
 *
 * The last two provide bulk sleep data. Could be fun to import into a spreadsheet
 * - api.sleeperData()    : 
 * - api.sleepSliceData() : 
 */

var request = require('request')
var request = request.defaults({jar: true})

class API {

    constructor (username, password) {
	// fill these with your SleepIQ account details
	this.username = username
	this.password = password

	this.userID = '' // also the sleeperID I think
	this.bedID = ''
	this.key = ''
	this.json = ''
	this.defaultBed = 0 // change if you want the class methods to default to a different bed in your datasets.
    }

    login (callback=null) {
	request({
	    method: 'PUT',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/login',
	    body: JSON.stringify({'login': this.username, 'password': this.password})}, function(err, resp, data) {
		this.json = JSON.parse(data)
		this.userID = this.json.userID
		this.key = this.json.key
		if (callback) {
		    callback(data);
		}
		// console.log(JSON.stringify(this.json, null, 3))
	    }.bind(this));

	/*
	  {"userId":"",
	  "key":"",
	  "registrationState":13, // not sure what registrationState is used for
	  "edpLoginStatus":200,
	  "edpLoginMessage":"not used"}
	*/
    }

    
    genURL (url) {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/' + url,
	    qs: {_k: this.key}}, function(err, resp, data) {
		console.log(data)}.bind(this))
    }

    
    registration () {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/registration',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"accountId":"", // different from userID/sleeperID 
	  "registrationState":"13"} 
	*/
    }


    familyStatus (callback=null) {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/familyStatus',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		if (this.json.beds) {
		    this.bedID = this.json.beds[this.defaultBed].bedId
		}
		if (callback) {
		    callback(data);
		}
		// console.log(JSON.stringify(this.json, null, 3))
	    }.bind(this))

	/*
	  {"beds":[ // array of beds
	  {"status":1,
	  "bedId":"", // used to identify each bed
	  "leftSide":{"isInBed":false, // used in homebridge plugin
	  "alertDetailedMessage":"No Alert",
	  "sleepNumber":30, // used in homebridge plugin
	  "alertId":0,
	  "lastLink":"00:00:00",
	  "pressure":1088},
	  "rightSide":{"isInBed":false,
	  "alertDetailedMessage":"No Alert",
	  "sleepNumber":40,
	  "alertId":0,
	  "lastLink":"00:00:00",
	  "pressure":1298}}]}
	*/
    }
    

    sleeper() {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/sleeper',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"sleepers":[
	  {"firstName":"",
	  "active":true,
	  "emailValidated":true,
	  "isChild":false,
	  "bedId":"",
	  "birthYear":"",
	  "zipCode":"",
	  "timezone":"",
	  "isMale":true, // Lol
	  "weight":###, // in lbs
	  "duration":null,
	  "sleeperId":"",
	  "height":##, // in inches
	  "licenseVersion":7,
	  "username":"",
	  "birthMonth":#,
	  "sleepGoal":###, // in minutes
	  "isAccountOwner":true,
	  "accountId":"",
	  "email":"",
	  "avatar":"", // already blank, unlike the other blank ones :)
	  "lastLogin":"2018-08-04 22:36:14 CDT",
	  "side":0},
	  {"firstName":"",
	  "active":true,
	  "emailValidated":false,
	  "isChild":false,
	  "bedId":"",
	  "birthYear":"",
	  "zipCode":"",
	  "timezone":"",
	  "isMale":false,
	  "weight":###,
	  "duration":null,
	  "sleeperId":"",
	  "height":##,
	  "licenseVersion":0,
	  "username":null,
	  "birthMonth":#,
	  "sleepGoal":###,
	  "isAccountOwner":false,
	  "accountId":"",
	  "email":"null",
	  "avatar":"",
	  "lastLogin":null,
	  "side":1}]}
	*/
    }

    bed () {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		if (this.json.beds) {
		    this.bedID = this.json.beds[this.defaultBed].bedId
		}
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"beds":[{"registrationDate":"2018-07-18T22:28:42Z",
	  "sleeperRightId":"",
	  "base":null,
	  "returnRequestStatus":0,
	  "size":"QUEEN",
	  "name":"Bed",
	  "serial":"",
	  "isKidsBed":false,
	  "dualSleep":true,
	  "bedId":"",
	  "status":1,
	  "sleeperLeftId":"",
	  "version":"",
	  "accountId":"",
	  "timezone":"",
	  "generation":"360",
	  "model":"C4",
	  "purchaseDate":"2018-07-05T03:40:30Z",
	  "macAddress":"",
	  "sku":"QZC4",
	  "zipcode":"",
	  "reference":""}]} // not sure what reference is representing
	*/
    }


    bedStatus() {
	// same information as familyStatus, but only for specified bed
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/'+this.bedID+'/status',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"status":1,
	  "leftSide":{"isInBed":false,
	  "alertDetailedMessage":"No Alert",
	  "sleepNumber":30,
	  "alertId":0,
	  "lastLink":"00:00:00",
	  "pressure":1056},
	  "rightSide":{"isInBed":false,
	  "alertDetailedMessage":"No Alert",
	  "sleepNumber":40,
	  "alertId":0,
	  "lastLink":"00:00:00",
	  "pressure":1266}}
	*/
    }


    bedPauseMode () {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/'+this.bedID+'/pauseMode',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"accountId":"",
	  "bedId":"",
	  "pauseMode":"off"} // not sure what pauseMode represents
	*/
    }


    // Side is either 'L' or 'R'. Num is any number in the range [0-100]
    sleepNumber (side, num, callback=null) {
	request({
	    method: 'PUT',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/'+this.bedID+'/sleepNumber',
	    qs: {_k: this.key},
	    body: JSON.stringify({side: side, sleepNumber: num})
	},
		function(err, resp, data) {
		    this.json = JSON.parse(data);
		    if (callback) {
			callback(data);
		    }
		    // console.log(JSON.stringify(this.json, null, 3))
		}.bind(this))
	
	/*
	  {} // feel the power
	*/
    }
    

    forceIdle (callback=null) {
	request({
	    method: 'PUT',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/'+this.bedID+'/pump/forceIdle',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		if (callback) {
		    callback(data);
		}
		// console.log(JSON.stringify(this.json, null, 3))
	    }.bind(this))

	/*
	  {} // Used to stop the pump if it is in the middle of an action (tapping the screen to stop)
	*/
    }
    

    pumpStatus () {
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/bed/'+this.bedID+'/pump/status',
	    qs: {_k: this.key}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"activeTask":0,
	  "chamberType":1,
	  "leftSideSleepNumber":40,
	  "rightSideSleepNumber":40}
	*/
    }
    

    sleeperData (date, interval) {
	// date format: 'YYYY-MM-DD'
	// interval format: 'D1' (1 day), 'M1' (1 month), etc.
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/sleepData',
	    qs: {_k: this.key, date:date, interval:interval, sleeper:this.userID}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))

	/*
	  {"sleeperId":"",
	  "message":"",
	  "tip":"Exercise generally promotes better sleep.  It reduces stress and improves circulation.",
	  "avgHeartRate":51,
	  "avgRespirationRate":16,
	  "totalSleepSessionTime":41343,
	  "inBed":38496,
	  "outOfBed":2847,
	  "restful":29791,
	  "restless":8705,
	  "avgSleepIQ":73,
	  "sleepData":[{"tip":"What you do during the day affects how well you sleep at night. Some small adjustments to your daily routine can dramatically affect how soundly you sleep at night.",
	  "message":"You had a GOOD nights sleep",
	  "date":"2018-08-01",
	  "sessions":[{"startDate":"2018-07-31T21:19:59",
	  "longest":true,
	  "sleepIQCalculating":false,
	  "originalStartDate":"2018-07-31T21:19:59",
	  "restful":29791,
	  "originalEndDate":"2018-08-01T08:49:02",
	  "sleepNumber":30,
	  "totalSleepSessionTime":41343,
	  "avgHeartRate":51,
	  "restless":8705,
	  "avgRespirationRate":16,
	  "isFinalized":true,
	  "sleepQuotient":73,
	  "endDate":"2018-08-01T08:49:02",
	  "outOfBed":2847,
	  "inBed":38496}],
	  "goalEntry":null,
	  "tags":[]}]}
	*/
    }



    sleepSliceData (date) {
	// date format: 'YYYY-MM-DD'
	// can optionally add a format:'csv' argument to get back a csv version of the data
	request({
	    method: 'GET',
	    uri: 'https://api.sleepiq.sleepnumber.com/rest/sleepSliceData',
	    qs: {_k: this.key, date:date, sleeper:this.userID}}, function(err, resp, data) {
		this.json = JSON.parse(data)
		console.log(JSON.stringify(this.json, null, 3))}.bind(this))
	/*
    {"sleepers":[
      {"days":[
        {"date":"2018-08-01",
	"sliceList":[
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":599,
	  "restfulTime":0,
	  "restlessTime":1,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":270,
	  "restlessTime":330,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":600,
	  "type":2},
	  {"outOfBedTime":587,
	  "restfulTime":7,
	  "restlessTime":6,
	  "type":1},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":600,
	  "type":2},
	  {"outOfBedTime":89,
	  "restfulTime":10,
	  "restlessTime":501,
	  "type":1},
	  {"outOfBedTime":600,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":1},
	  {"outOfBedTime":600,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":1},
	  {"outOfBedTime":515,
	  "restfulTime":0,
	  "restlessTime":85,
	  "type":2},
	  {"outOfBedTime":231,
	  "restfulTime":117,
	  "restlessTime":252,
	  "type":1},
	  {"outOfBedTime":26,
	  "restfulTime":39,
	  "restlessTime":535,
	  "type":1},
	  {"outOfBedTime":0,
	  "restfulTime":220,
	  "restlessTime":380,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":270,
	  "restlessTime":330,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":330,
	  "restlessTime":270,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":600,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":280,
	  "restlessTime":320,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":600,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":600,
	  "type":2},
	  {"outOfBedTime":199,
	  "restfulTime":144,
	  "restlessTime":257,
	  "type":1},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":600,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":50,
	  "restlessTime":550,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":570,
	  "restlessTime":30,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":560,
	  "restlessTime":40,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":570,
	  "restlessTime":30,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":460,
	  "restlessTime":140,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":420,
	  "restlessTime":180,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":570,
	  "restlessTime":30,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":600,
	  "restlessTime":0,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":590,
	  "restlessTime":10,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":580,
	  "restlessTime":20,
	  "type":3},
	  {"outOfBedTime":0,
	  "restfulTime":570,
	  "restlessTime":30,
	  "type":3},
	  {"outOfBedTime":58,
	  "restfulTime":10,
	  "restlessTime":532,
	  "type":2},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0},
	  {"outOfBedTime":0,
	  "restfulTime":0,
	  "restlessTime":0,
	  "type":0}]}],
	  "sleeperId":"",
	  "sliceSize":600}]}
	*/

    }
}

module.exports = API

