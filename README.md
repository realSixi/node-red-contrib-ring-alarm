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
```javascript
{
  "locationId": "a44a1234-66a9-4a25-b1ca-dbff7123456",
  "adapterType": "zwave",
  "catalogId": "3ec71234-735c-4a07-b718-44475812345",
  "deviceType": "sensor.contact",
  "lastCommTime": 1658095897290,
  "lastUpdate": 1658095897342,
  "zid": "0ef01234-91c2-4a43-ba2d-ebc5ad123456",
  "faulted": true
}
```

### Alarm Mode Listener
Sends a message when the alarm mode changes. In the Ring.com app those states are `disarm` (inactive), `home` and `arm`. In the API the states are called `none` (=disarm), `some` (= home) and `all` (=arm).

### Camera Motion

When the camera detects motion, this node will be triggered.

### Camera

Can be configured to either take **photo** or a **video**.  

The *Photo* message will contain the image as Base64-encoded String and as a buffer. The *Video* message contains only a Buffer.

Currently videos have a length of 10s (will be configurable in the future).

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
