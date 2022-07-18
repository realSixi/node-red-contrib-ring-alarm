import nodeRed, { NodeAPI, NodeDef } from 'node-red';
import { RingApi, RingDeviceType } from 'ring-client-api';
import * as fs from 'fs';

type RingConfigCredentialType = { initialToken: string, token: string };
type RingConfigNodeType = { api: RingApi } & nodeRed.Node<RingConfigCredentialType>;
type RingConfigConfigType = {} & NodeDef;

type DefaultConfiguredNodeType = { config: string } & NodeDef

const init = (RED: NodeAPI) => {

    function RingConfigNode(this: RingConfigNodeType, config: RingConfigConfigType) {
        RED.nodes.createNode(this, config);

        const resetToken = () => {
            this.context().set('token', undefined);
        };

        const updateToken = (newToken: string) => {
            this.context().set('token', newToken);
        };

        const getToken = () => this.context().get('token') as string;

        if (!getToken() && this.credentials.initialToken) {
            updateToken(this.credentials.initialToken);
        }

        if (getToken()) {
            this.api = new RingApi({ refreshToken: getToken() });
            this.api.onRefreshTokenUpdated.subscribe(tokenUpdate => {
                console.log('Refreshed Token', tokenUpdate);
                updateToken(tokenUpdate.newRefreshToken);
            });
        } else {
            console.error('No Token!');
        }

    }

    RED.nodes.registerType('ring-config', RingConfigNode, {
        credentials: {
            initialToken: { type: 'text' },
            token: { type: 'text' },
        },
    });


    function RingSecurityPanelMode(this: nodeRed.Node, config: DefaultConfiguredNodeType) {
        RED.nodes.createNode(this, config);

        let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
        if (configNode && configNode.api) {
            const api = configNode.api;

            api.getLocations().then(locations => {
                locations.forEach(location => {
                    location.getDevices().then();

                    location.onDeviceDataUpdate.subscribe(deviceUpdate => {
                        if (deviceUpdate.deviceType === RingDeviceType.SecurityPanel && deviceUpdate.mode) {
                            this.send({
                                topic: `ring/${location.id}/security-panel/${deviceUpdate.zid}/security-mode`,
                                payload: deviceUpdate,
                            });

                        }
                    });

                });
                this.status({
                    fill: 'green',
                    text: 'connected',
                });
            });


        } else {
            this.status({
                fill: 'red',
                text: 'no credentials',
            });
        }
    }

    RED.nodes.registerType('Alarm Mode Listener', RingSecurityPanelMode);


    function RingCameraMotion(this: nodeRed.Node, config: DefaultConfiguredNodeType) {
        RED.nodes.createNode(this, config);

        let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
        if (configNode && configNode.api) {
            const api = configNode.api;

            api.getCameras().then(cameras => {
                cameras.forEach(cam => {
                    // console.log('Subscribing for cam', cam);

                    cam.onMotionStarted.subscribe(motionStarted => {
                        // console.log('motionStarted', motionStarted, cam);
                    });
                    cam.onMotionDetected.subscribe(motion => {
                        // console.log('onMotionDetected', motion, cam);
                    });
                });
            });

            api.getLocations().then(locations => {
                locations.forEach(location => {
                    location.cameras.forEach(cam => {
                        cam.onMotionDetected.subscribe(motion => {
                            this.send({
                                topic: `ring/${location.id}/camera/${cam.id}/motion`,
                                payload: {
                                    cameraData: cam.data,
                                    motion: motion,
                                },
                            });
                        });
                    });
                });
                this.status({
                    fill: 'green',
                    text: 'connected',
                });
            });


        } else {
            this.status({
                fill: 'red',
                text: 'no credentials',
            });
        }
    }

    RED.nodes.registerType('Camera Motion', RingCameraMotion);


    RED.nodes.registerType('Device Listener', async function(this: nodeRed.Node, config: { config: string } & NodeDef) {
        RED.nodes.createNode(this, config);

        let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
        if (configNode && configNode.api) {
            const api = configNode.api;

            try {
                let locations = await api.getLocations();
                locations.forEach((location) => {

                    location.getDevices().then(devices => {
                    });

                    location.onDeviceDataUpdate.subscribe(deviceUpdate => {
                        if (deviceUpdate.faulted !== undefined || deviceUpdate.tamperStatus) {
                            this.send({
                                topic: `ring/${location.id}/device/${deviceUpdate.zid}`,
                                payload: {
                                    locationId: location.locationId,
                                    ...deviceUpdate,
                                },
                            });
                        } else {
                            console.log('other device update', deviceUpdate);
                        }
                    });
                });

                this.status({
                    fill: 'green',
                    text: 'connected',
                });

            } catch (e) {
                this.status({
                    fill: 'red',
                    text: `Error: ${e.message}`,
                });
            }

        } else {
            this.status({
                fill: 'red',
                text: 'no credentials',
            });
        }


    });


    function RingSecurityCamera(this: nodeRed.Node, config: DefaultConfiguredNodeType & { imagetype: 'video' | 'photo' }) {
        RED.nodes.createNode(this, config);

        try {
            this.on('input', (msg, send, done) => {

                console.log('Camera Config', config);

                let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
                if (configNode && configNode.api) {
                    const api = configNode.api;

                    api.getCameras().then(cameras => {
                        cameras.forEach(camera => {
                            camera.onMotionDetected.subscribe(msg => {
                                console.log('Cam motion detected');
                            });

                            if (config.imagetype === 'video') {

                                this.status({
                                    text: 'recording video',
                                    fill: 'green',
                                });

                                // camera.onNewNotification.subscribe(notification => {
                                //     console.log('not', notification);
                                // });

                                const filename = `/tmp/ring-video-${(new Date().getTime())}.mp4`;

                                camera.recordToFile(filename, 10)
                                    .then(record => {
                                        console.log('Record DONE!', record);

                                        try {
                                            let data = fs.readFileSync(filename);
                                            send({
                                                payload: {
                                                    type: 'video',
                                                    buffer: data,
                                                },
                                            });

                                            fs.unlink(filename, () => {
                                                console.log('UNlink done!', filename);
                                            });

                                            this.status({
                                                text: 'ready',
                                                fill: 'green',
                                            });

                                            done();
                                        } catch (e) {
                                            console.log('read file error');
                                        }
                                    });
                            } else if (config.imagetype === 'photo') {
                                this.status({
                                    text: 'taking snapshot',
                                    fill: 'green',
                                });

                                camera.getSnapshot().then(buffer => {
                                    let base64 = buffer.toString('base64');

                                    send({
                                        topic: 'image',
                                        payload: {
                                            type: 'photo',
                                            base64: base64,
                                            buffer: buffer,
                                        },

                                    });
                                    this.status({
                                        text: 'ready',
                                        fill: 'green',
                                    });
                                    done();
                                });
                            } else {
                                console.log('type not recognized -> aborting');
                                this.status({
                                    text: 'unknown type',
                                    fill: 'yellow',
                                });
                                done();
                            }
                        });
                    });

                }
            });
        } catch (e) {
            console.log(e);
        }
    }

    RED.nodes.registerType('Camera', RingSecurityCamera);


    function RingSetAlarmMode(this: nodeRed.Node, config: DefaultConfiguredNodeType & { locationId: string, bypass: string }) {
        RED.nodes.createNode(this, config);

        try {
            console.log('ArarmModeConfig', config);
            let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
            if (configNode && configNode.api) {
                const api = configNode.api;

                let l = api.getLocations().then(locations => {
                    let location = locations.find(l => l.locationId === config.locationId);
                    if (location) {

                        location.getAlarmMode().then(mode => {
                            let alarmMode = mode === 'all' ? 'arm' : mode === 'some' ? 'home' : 'disarm';
                            this.status({
                                fill: alarmMode === 'disarm' ? 'grey' : alarmMode === 'home' ? 'yellow' : 'red',
                                text: `${location.name}: ${alarmMode}`,
                            });
                        });
                        location.onDeviceDataUpdate.subscribe(deviceData => {
                            if (deviceData.deviceType === 'security-panel') {
                                location.getAlarmMode().then(mode => {
                                    let alarmMode = mode === 'all' ? 'arm' : mode === 'some' ? 'home' : 'disarm';
                                    this.status({
                                        fill: alarmMode === 'disarm' ? 'grey' : alarmMode === 'home' ? 'yellow' : 'red',
                                        text: `${location.name}: ${alarmMode}`,
                                    });
                                });
                            }
                        });


                    } else {
                        this.status({
                            fill: 'red',
                            text: `Location not found`,
                        });

                        let locationIds = locations.map(location => `${location.id} (${location.name})`).join(', ');

                        RED.log.error(`Select one location to filter: ${locationIds}`);
                    }
                });

                this.on('input', (msg, send, done) => {

                    console.log('RingSetAlarmMode Config', config);
                    let payload = msg.payload as string;
                    if (!payload) {
                        RED.log.error(`Invalid Mode: ${msg.payload}`);
                    }

                    api.getLocations().then(async locations => {
                        let location = locations.find(location => location.id === config.locationId);


                        const devicesToIgnore = config.bypass === 'true' && (await location.getDevices())
                            .filter(d => d.data.faulted)
                            .map(d => d.data.zid);

                        console.log('devicesToIgnore', devicesToIgnore);

                        let currentAlarmMode = await location.getAlarmMode();
                        RED.log.warn('current alarm mode ' + currentAlarmMode);


                        switch (payload) {
                            case 'home': {
                                location.armHome(devicesToIgnore).then(res => {
                                    done();
                                }).catch(e => {
                                    RED.log.error(e);
                                });
                                break;
                            }
                            case 'arm': {
                                location.armAway(devicesToIgnore).then(res => {
                                    done();
                                }).catch(e => {
                                    RED.log.error(e);
                                });
                                break;
                            }
                            case 'disarm' : {
                                location.disarm().then(res => {
                                    done();
                                }).catch(e => {
                                    RED.log.error(e);
                                });
                                break;
                            }
                            default: {
                                RED.log.error(`Invalid Mode: ${msg.payload}`);

                                break;
                            }
                        }
                    });
                });
            } else {
                this.status({
                    fill: 'red',
                    text: 'no credentials',
                });
            }
        } catch (e) {
            this.status({
                fill: 'red',
                text: `Error: ${e.message}`,
            });
        }
    };
    RED.nodes.registerType('Alarm Mode', RingSetAlarmMode);


    function RingAlarmStatus(this: nodeRed.Node, config: DefaultConfiguredNodeType) {
        RED.nodes.createNode(this, config);

        try {
            console.log('ArarmModeConfig', config);
            let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
            if (configNode && configNode.api) {
                const api = configNode.api;

                api.getLocations().then(locations => locations.forEach(location => {
                    location.getDevices().then(devices => devices.find(d => d.deviceType === 'security-panel')
                        .onData.subscribe(deviceData => {
                            if (deviceData.alarmInfo) {

                                let triggeredDevices = devices.filter(device => deviceData.alarmInfo.faultedDevices.includes(device.id))
                                    .map(device => device.data);

                                this.send({
                                    payload: {
                                        locationId: location.locationId,
                                        locationName: location.name,
                                        ...deviceData.alarmInfo,
                                        faultedDevices: triggeredDevices,
                                    },
                                });
                            }
                        }));

                    this.status({
                        fill: 'green',
                        text: 'connected',
                    });
                }));

            }
        } catch (e) {
            this.status({
                fill: 'red',
                text: `Error: ${e.error}`,
            });
        }
    }

    RED.nodes.registerType('Alarm Status', RingAlarmStatus);

};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = init;