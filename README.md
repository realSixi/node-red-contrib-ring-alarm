# node-red-contrib-ring-alarm

[![npm](https://badgen.net/npm/v/@realsixi/node-red-contrib-ring-alarm)](https://www.npmjs.com/package/@realsixi/node-red-contrib-ring-alarm)
[![npm](https://badgen.net/npm/dt/@realsixi/node-red-contrib-ring-alarm)](https://www.npmjs.com/package/@realsixi/node-red-contrib-ring-alarm)
[![npm](https://badgen.net/badge/NodeRED/published/red)](https://flows.nodered.org/node/@realsixi/node-red-contrib-ring-alarm)



Unofficial [Node-RED](https://nodered.org/) nodes to interact with [Ring](https://ring.com) Alarm System and Ring Cameras.

This project uses the great [ring-client-api](https://github.com/dgreif/ring) to interact with the Ring System.

*this version is a first draft - not all functions may work reliable.*

## Description

This projects adds the following nodes to Node-RED

### Device Listener

Sends a message, if a device changes - either because it's `faulted` (= triggered) or because it's `tamperStatus` changed.

*Example Message*
```json
{
    "locationId": "a44aaaaa-66b9-4225-baaa-dbfc7aaaaaaa",
        "adapterType": "zwave",
        "adapterZid": "b226cccc-6ae1-4bbb-9bbb-6124cabbbbbb",
        "batteryLevel": 100,
        "batteryStatus": "full",
        "catalogId": "3ec4dddd-725c-4957-bddd-414758aadddd",
        "categoryId": 5,
        "commStatus": "ok",
        "commandTypes": {
        "communication-poll": {
            "requiresTrust": false
        },
        "led-indicator-sensor.cancel": {
            "requiresTrust": true
        },
        "led-indicator-sensor.set": {
            "requiresTrust": false
        },
        "reconfigure.start": {
            "requiresTrust": false
        },
        "update-node-neighbors.start": {
            "requiresTrust": false
        }
    },
    "deviceFoundTime": 1657985780389,
        "deviceType": "sensor.contact",
        "fingerprint": "838.513.1025",
        "firmwareUpdate": {
        "eligibility": "eligible",
            "state": "up-to-date"
    },
    "impulseTypes": {
        "clear": {
            "trusted": true
        },
        "comm.ping.received": {
            "trusted": false
        },
        "fault": {
            "trusted": true
        },
        "tampered": {
            "trusted": true
        },
        "tampered-cleared": {
            "trusted": true
        }
    },
    "lastCommTime": 1658351029807,
        "lastUpdate": 1658351029862,
        "linkQuality": "ok",
        "managerId": "zwave",
        "manufacturerName": "Ring",
        "name": "Main Entrance Contact Sensor",
        "nextExpectedWakeup": 1658396974043,
        "placement": "main-door",
        "pollInterval": 43200,
        "roomId": 1,
        "serialNumber": "G2Q1L49188640XXX",
        "setupByPluginStatus": "complete",
        "setupByUserStatus": "unset",
        "subCategoryId": 1,
        "tags": [
            "sleepy",
            "scanned",
            "kitted"
        ],
        "tamperStatus": "ok",
        "zid": "0ef00000-9222-4e44-bbbb-ebc666665805",
        "faulted": true,
        "ledIndicatorMode": "fault"
}
```

### Alarm Mode Listener
Sends a message when the alarm mode changes. In the Ring.com app those states are `disarm` (inactive), `home` and `arm`. In the API the states are called `none` (=disarm), `some` (= home) and `all` (=arm).

The message-format is the same as for the *Device Listener* node.

### Camera Motion

When the camera detects motion, this node will be triggered.

### Camera

Can be configured to either take **photo** or a **video**. If video mode is selected, you can also configure the duration of the video.

The *Photo* message will contain the image as Base64-encoded String and as a buffer. The *Video* message contains only a Buffer.

### Alarm Status

Triggered, when the alarm status changes, e.g.: `state: "entry-delay"` in the message is set for a delayed alarm.

TODO: Test with real alarms

### Alarm Mode

Sets the alarm mode for a configured `locationId` by sending `home`, `arm` or `disarm` as payload. You can find your `locationId` e.g. in the *Device Listener* Messages.
Also accepts `some`, `none` and `all`.

Node can be configured to bypass faulting sensors, like the app does.

## Getting Started

For the initial connection, you need to set the `refreshToken` in the configuration node. See [Refresh Token Wiki](https://github.com/dgreif/ring/wiki/Refresh-Tokens) at the ring-client-api Repository, how to get a token. 

## License

This project is licensed under the MIT License - see the LICENSE file for details

## Acknowledgments

Inspiration, code snippets, etc.

* [ring-client-api](https://github.com/dgreif/ring)
