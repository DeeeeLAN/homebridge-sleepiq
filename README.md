# homebridge-SleepIQ
SleepIQ plugin for [HomeBridge](https://github.com/nfarina/homebridge)

This repository contains a SleepIQ plugin for homebridge that exposes bed occupancy. In theory it is capable of detecting all the beds on your account, and automatically configuring a sensor for each bedside. I was only able to test with a single queen bed so I don't actually know what will happen with multiple beds or with a twin/full mattress. Let me know!

It works by taking advantage of the (undocumented) SleepIQ API found at [http://api.sleepiq.sleepnumber.com](http://api.sleepiq.sleepnumber.com). Unfortunately, this requires regular API network requests. So far, I have not seen Sleep Number get upset with too many requests, but in theory they could at some point in time if we flood their network. If anybody has this happen, file a ticket. I tried scanning my network to see if the SleepIQ hub exposed any network interface so I could access the data locally, but I couldn't find anything. If anybody has better luck, please contact me!

See [API.js](API.js) for my attempt at documenting the SleepIQ API, based on [https://github.com/technicalpickles/sleepyq](https://github.com/technicalpickles/sleepyq), [https://github.com/erichelgeson/sleepiq](https://github.com/erichelgeson/sleepiq), and [https://github.com/natecj/sleepiq-php](https://github.com/natecj/sleepiq-php). I consolidated all the functions and removed the ones that no longer seem to work. Please contact me if you find any new information about the API. 

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-sleepiq`
3. Update your configuration file. See the `sample-config.json` snippet below.

# Configuration

Configuration sample:

 ```
"platforms": [
		{
			"platform"    : "SleepNumber",
			"username"    : "Your SleepIQ Email Address",
			"password"    : "Your SleepIQ Password"
		}
]

```

Fields:

* "platform": Must always be "SleepNumber" (required)
* "username": SleepIQ account email address
* "Password": SleepIQ account password
* "refreshTime": Optional number of seconds between each network request (in digits, 0-9). If not specified, defaults to 5 seconds.
# Issues/Future Work
* Allow for different refresh times based on the time of day
* Verify everything still works will twin/full beds (If anybody has one, contact me)
* File a ticket or submit a pull request if you find any problems!
