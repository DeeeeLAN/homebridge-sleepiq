# Change Log

All notable changes to this project will be documented in this file.

## v5.0.0 (2020-11-14)

In my original readme, I had a statement: 

> So far, I have not seen Sleep Number get upset with too many requests, but in theory they could at some point in time if we flood their network.

Unfortunately, that day has come. I received a call from Sleep Number requesting I take down this plugin as it is overwhelming their network and making the SleepIQ experience worse for everybody, and it is a direct violation of their User Agreement. This update removes all functionality (you will need to remove the accessories from HomeKit). If you choose not to update, Sleep Number will likely blacklist your IP Address and reach out to you directly as they work through the list of users with massive amounts of API requests. 

I requested that they keep our small community in mind and give us a proper API with local network access in the future. I don't know if they ever will, but if they call you, please add your request to mine, make our voices heard. 

Thanks for all the good times and keep sleeping,

Dillan

## v4.2.0 (2020-10-16)

### Changes

- Add a "bothSidesOccupied" sensor that will trigger if both sides of the bed are occupied

## v4.1.16 (2020-09-23)

### Bug Fixes

- Fixed right lightstrip and outlet controlling the left side

## v4.1.15 (2020-09-22)

### Bug Fixes

- Fixed bug with outlet and light controls not updating the bed state

## v4.1.14 (2020-09-22)

### Bug Fixes

- Fixed `sideName is not defined` error
- Cleaned up error message output some

### API Features

- Added testing switch to simulate foundation devices when they are unavailable on your account to assist with development

## v4.1.13 (2020-09-22)

### Bug Fixes

- Fixed outlets and lightstrips not getting created and causing homebridge to restart

## v4.1.12 (2020-09-22)

### Bug Fixes

- Fixed refresh time not working issue (#29)

## v4.1.11 (2020-09-22)

### Bug Fixes

- Fixed bed0privacy cache issues

## v4.1.10 (2020-09-21)

### Bug Fixes

- Fixed `sideName is not defined` bug

## v4.1.9 (2020-09-21)

### Bug Fixes

- Fixed bug with foot warmer causing UUID collision

## v4.1.8 (2020-09-21)

### Bug Fixes

- Fixed bug causing homebridge crash when foundation only has one outlet or lightstrip available

## v4.1.7 (2020-09-21)

### Bug Fixes

- Fixed bug in the outlets, lightstrips, and foot warmer foundation code that was crashing homebridge.

## v4.1.6 (2020-09-20)

### Bug Fixes

- Fixed bug in foot-warmer data processor. 

## v4.1.5 (2020-09-20)

### Bug Fixes

- You no longer need to manually clear cache or remove `bed0privacy` from the cache if you are updating from a pre-v4.0.0 release to this release. 
  - Sorry to everybody who has already done this! I should have fixed this the first time around to save you the trouble, but I wasn't thinking about it at the time. 

## v4.1.4 (2020-09-19)

### Bug Fixes

- Fixed `updateLightStrip` error that was crashing homebridge

## v4.1.3 (2020-09-19)

### Bug Fixes

- Fixed a bug breaking the outlets, lightstrips, and foot warmer from functioning. 

## v4.1.2 (2020-09-18)

### Bug Fixes

- Fixed a bug preventing the foot warming service from sending changes to the bed. 

## v4.1.1 (2020-09-17)

### Note

- You will like run into an issue when updating that is preventing homebridge from running. Try removing the bed0privacy device from the device cache (or just clear the full cache). I updated how I handled this device in the plugin and it is conflicting with the version stored in the cache. 

## v4.1.0 (2020-09-17)

### Changes

- Added initial foot warmer support for flexfit 3 foundations. I don't have a foundation, so if you find any bugs, or something isn't working right, please file a ticket.
- Set a step size for the sleep number slider so it is easier to hit the number you are aiming for.

## v4.0.1 (2020-09-17)

### Bug Fixes

- Fixed bug in API call for foundation outlets and light strips

## v4.0.0 (2020-09-17)

### Changes

- Added initial support for foundation outlets and light strips
  - This release introduces initial support for the outlets and light strips on the flex fit foundations that have them. I don't personally have one, so please report any issues when using them. If the light strips are capable of brightness control, I do not support that either. I need REST data to add that capability.

## v3.4.1 - v3.4.17 (2020-09-17)

### Bug Fixes

- Various

### Changes

- Add support for Homebridge UI

## v3.4.0 (2020-09-16)

### Changes

- Add support for having the foundations return to flat when the Homekit lightbulb is turned off
- Debounce the sleep number update request so it doesn't trigger while attempting to set the slider to the desired value

### Bug Fixes

- Fixes for the various promise errors that have been reported
- Set the minimum sleep number value to 5

## Older

- Refer to github commit details if you are interested. 