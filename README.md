<p align="center">
  <img src="homebridge-sleepiq.png" height="200px">  
</p>
<span align="center">

# Homebridge SleepIQ
[![Downloads](https://img.shields.io/npm/dt/homebridge-sleepiq)](https://www.npmjs.com/package/homebridge-sleepiq)
[![Version](https://img.shields.io/npm/v/homebridge-sleepiq)](https://www.npmjs.com/package/homebridge-sleepiq)
[![GitHub issues](https://img.shields.io/github/issues/DeeeeLAN/homebridge-sleepiq)](https://github.com/DeeeeLAN/homebridge-sleepiq/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/DeeeeLAN/homebridge-sleepiq)](https://github.com/DeeeeLAN/homebridge-sleepiq/pulls)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![donate-with-paypal](hhttps://img.shields.io/badge/donate-%2410-blueviolet)](https://paypal.me/DeeeeLAN)

</span>

## SleepIQ plugin for [HomeBridge](https://github.com/nfarina/homebridge)
Copyright © 2018-2020 Dillan Mills. All rights reserved.

This repository contains a SleepIQ plugin for homebridge that exposes bed occupancy, allows you to control the sleep number setting (modeled as a lightbulb), and is gaining support for the different foundation features (adjust head/foot position, outlets, foot warming, massage, etc.). In theory it is capable of detecting all the beds on your account, and automatically configuring a sensor for each bedside. I was only able to test with a single queen bed so I don't actually know what will happen with multiple beds or with a twin/full mattress. Let me know!

It works by taking advantage of the (undocumented) SleepIQ API found at [http://api.sleepiq.sleepnumber.com](http://api.sleepiq.sleepnumber.com). Unfortunately, this requires regular API network requests. So far, I have not seen Sleep Number get upset with too many requests, but in theory they could at some point in time if we flood their network. If anybody has this happen, file a ticket. I tried scanning my network to see if the SleepIQ hub exposed any network interface so I could access the data locally, but I couldn't find anything. If anybody has better luck, please contact me!

See [API.js](API.js) for my attempt at documenting the SleepIQ API, based on [https://github.com/technicalpickles/sleepyq](https://github.com/technicalpickles/sleepyq), [https://github.com/erichelgeson/sleepiq](https://github.com/erichelgeson/sleepiq), and [https://github.com/natecj/sleepiq-php](https://github.com/natecj/sleepiq-php), plus a lot of additional effort on my own and with the help of @400HPMustang, @dppeak, and @64Spaces. I consolidated all the functions, removed the ones that no longer seem to work, and added lots of new ones. Please contact me if you find any new information about the API. 

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-sleepiq`
3. Update your configuration file. See the `sample-config.json` snippet below. If you use Homebridge UI, you can change settings through the UI instead. 

# Configuration

Configuration sample:

 ```
"platforms": [
		{
			"platform"    : "SleepIQ",
			"email"       : "Your SleepIQ Email Address",
			"password"    : "Your SleepIQ Password",
			"refreshTime" : 5,
			"sendDelay"   : 2,
		}
]

```

Fields:

* "platform": Must always be "SleepIQ" (required)
* "email": SleepIQ account email address
* "Password": SleepIQ account password
* "refreshTime": Optional number of seconds between each network request. If not specified, defaults to 5 seconds. I have found little value in going below 5 seconds. The base only updates every 2-3 seconds, and the plugin isn't always in sync with that. Increasing the limit would cause the occupancy to not update as quickly, but it would greatly decrease the number of network requests made.
* "sendDelay": Optional number of seconds to 'debounce' your sleep number updates. This is to allow you to adjust the slider in Homekit without the bed constantly trying to change to the intermediate numbers and possibly ending up on a wrong number in the end. It will wait until the number of seconds specified in sendDelay after no more changes were made before sending an updated value to your bed. Defaults to 2, but you can play around with setting it lower or higher.
# Issues/Future Work
* Foundation settings (If you have a flexfit foundation, please reach out to help, I need data from all the different bases):
  * Verify different configurations (split head/split foot, split head/single foot, single head/single foot)
  * Set up outlets for all bases that have them
  * Set up foot heater for flexfit 3
  * ?
* Allow for different refresh times based on the time of day
* Verify everything still works will twin/full beds (If anybody has one, contact me)
* Verify support for multiple beds (Does anybody have multiple beds?)
* File a ticket or submit a pull request if you find any problems!
