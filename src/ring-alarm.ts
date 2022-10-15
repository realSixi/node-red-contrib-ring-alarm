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

            this.setMaxListeners(0);

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
                try {

                    let tmpApi = new RingApi({ refreshToken: getToken() });

                    // make call to verify token / trigger refresh
                    tmpApi.getProfile().then().catch(e => {
                        RED.log.error(e);
                        resetToken();
                    });


                    let subscription = tmpApi.onRefreshTokenUpdated.subscribe(tokenUpdate => {
                        updateToken(tokenUpdate.newRefreshToken);
                        console.log(tokenUpdate);
                        this.api = tmpApi;
                        this.emit('ring-config-token-fetched');

                    });


                    this.on('close', () => {
                        subscription.unsubscribe();
                        this.api.disconnect();
                    });
                } catch (e) {
                    RED.log.error(e);
                }
            } else {
                RED.log.error('No Token!');
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

            configNode.once('ring-config-token-fetched', () => {
                    if (configNode && configNode.api) {

                        const api = configNode.api;

                        api.getLocations().then(locations => {
                            locations.forEach(location => {

                                let subscription = location.onDeviceDataUpdate.subscribe(deviceUpdate => {
                                    if (deviceUpdate.deviceType === RingDeviceType.SecurityPanel) {
                                        location.getDevices().then(devices => {
                                            let device = devices.find(d => d.deviceType === RingDeviceType.SecurityPanel);
                                            this.send({
                                                topic: `ring/${location.id}/security-panel/${deviceUpdate.zid}/security-mode`,
                                                payload: {
                                                    ...device.data,
                                                },
                                            });

                                        }).catch(e => RED.log.error(e));
                                    }
                                });


                                this.on('close', () => {
                                    subscription.unsubscribe();
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
                },
            );
        };

        RED.nodes.registerType('Alarm Mode Listener', RingSecurityPanelMode);


        function RingCameraMotion(this: nodeRed.Node, config: DefaultConfiguredNodeType) {
            RED.nodes.createNode(this, config);

            let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
            configNode.once('ring-config-token-fetched', () => {
                if (configNode && configNode.api) {
                    const api = configNode.api;

                    api.getLocations().then(locations => {
                        locations.forEach(location => {
                            location.cameras.forEach(cam => {
                                let subscription = cam.onMotionDetected.subscribe(motion => {
                                    this.send({
                                        topic: `ring/${location.id}/camera/${cam.id}/motion`,
                                        payload: {
                                            cameraData: cam.data,
                                            motion: motion,
                                        },
                                    });
                                });
                                this.on('close', () => {
                                    subscription.unsubscribe();
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
            });
        };

        RED.nodes.registerType('Camera Motion', RingCameraMotion);


        RED.nodes.registerType('Device Listener', function(this: nodeRed.Node, config: { config: string } & NodeDef) {
            RED.nodes.createNode(this, config);


            let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
            configNode.once('ring-config-token-fetched', () => {
                if (configNode && configNode.api) {
                    const api = configNode.api;

                    try {
                        api.getLocations().then(locations => {
                            locations.forEach((location) => {

                                let subscription = location.onDeviceDataUpdate.subscribe(deviceUpdate => {
                                    location.getDevices().then(devices => {
                                        let device = devices.find(d => d.zid === deviceUpdate.zid);
                                        if (deviceUpdate.faulted !== undefined || deviceUpdate.tamperStatus) {
                                            this.send({
                                                topic: `ring/${location.id}/device/${deviceUpdate.zid}`,
                                                payload: {
                                                    locationId: location.locationId,
                                                    ...device.data,
                                                },
                                            });
                                        } else {
                                        }
                                    }).catch(e => RED.log.error(e));

                                });
                                this.on('close', () => {
                                    subscription.unsubscribe();
                                });
                            });

                            this.status({
                                fill: 'green',
                                text: 'connected',
                            });
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
        });


        function RingSecurityCamera(this: nodeRed.Node, config: DefaultConfiguredNodeType & { imagetype: 'video' | 'photo', videoduration: number }) {
            RED.nodes.createNode(this, config);
            this.status({
                text: 'waiting for token',
                fill: 'yellow',
            });

            let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
            configNode.once('ring-config-token-fetched', () => {
                    this.status({
                        text: 'ready',
                        fill: 'green',
                    });


                    try {
                        this.on('input', (msg, send, done) => {


                            if (configNode && configNode.api) {
                                const api = configNode.api;

                                api.getCameras().then(cameras => {
                                    cameras.forEach(camera => {
                                        // camera.onMotionDetected.subscribe(msg => {
                                        //     console.log('Cam motion detected');
                                        // });

                                        if (config.imagetype === 'video') {

                                            this.status({
                                                text: 'recording video',
                                                fill: 'green',
                                            });


                                            const filename = `/tmp/ring-video-${(new Date().getTime())}.mp4`;

                                            camera.recordToFile(filename, config.videoduration || 10)
                                                .then(record => {
                                                    console.log('Record DONE!', record);
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

                                                }).catch(e => {
                                                this.status({
                                                    text: e.message,
                                                    fill: 'red',
                                                });
                                                done();
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
                                            }).catch(e => {
                                                this.status({
                                                    text: e.message,
                                                    fill: 'red',
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
                },
            );
        };

        RED.nodes.registerType('Camera', RingSecurityCamera);


        function RingSetAlarmMode(this: nodeRed.Node, config: DefaultConfiguredNodeType & { locationId: string, bypass: string }) {
            RED.nodes.createNode(this, config);

            try {
                console.log('ArarmModeConfig', config);
                let configNode: RingConfigNodeType = RED.nodes.getNode(config.config) as RingConfigNodeType;
                configNode.once('ring-config-token-fetched', () => {
                    if (configNode && configNode.api) {
                        const api = configNode.api;

                        let l = api.getLocations().then(locations => {
                            let location = locations.find(l => l.locationId === config.locationId);
                            if (location) {

                                location.getAlarmMode()
                                    .catch(e => location.getLocationMode())
                                    .then((mode) => {
                                        let alarmMode = mode === 'all' ? 'arm' : mode === 'some' ? 'home' : 'disarm';
                                        this.status({
                                            fill: alarmMode === 'disarm' ? 'grey' : alarmMode === 'home' ? 'yellow' : 'red',
                                            text: `${location.name}: ${alarmMode}`,
                                        });
                                    })
                                    .catch(e => RED.log.error(e));

                                // location.getAlarmMode().then(mode => {
                                //     let alarmMode = mode === 'all' ? 'arm' : mode === 'some' ? 'home' : 'disarm';
                                //     this.status({
                                //         fill: alarmMode === 'disarm' ? 'grey' : alarmMode === 'home' ? 'yellow' : 'red',
                                //         text: `${location.name}: ${alarmMode}`,
                                //     });
                                // }).catch(e => {
                                //     RED.log.error(e);
                                // });
                                let subscription = location.onDeviceDataUpdate.subscribe(deviceData => {
                                    if (deviceData.deviceType === 'security-panel') {
                                        location.getAlarmMode()
                                            .catch(e => location.getLocationMode())
                                            .then(mode => {
                                                let alarmMode = mode === 'all' ? 'arm' : mode === 'some' ? 'home' : 'disarm';
                                                this.status({
                                                    fill: alarmMode === 'disarm' ? 'grey' : alarmMode === 'home' ? 'yellow' : 'red',
                                                    text: `${location.name}: ${alarmMode}`,
                                                });
                                            }).catch(e => {
                                            RED.log.error(e);
                                        });
                                    }
                                });

                                this.on('close', () => {
                                    subscription.unsubscribe();
                                });


                            } else {
                                this.status({
                                    fill: 'red',
                                    text: `Location not found`,
                                });

                                let locationIds = locations.map(location => `${location.id} (${location.name})`).join(', ');

                                RED.log.error(`Select one location to filter: ${locationIds}`);
                            }
                        }).catch(e => RED.log.error(e));

                        this.on('input', (msg, send, done) => {

                                console.log('RingSetAlarmMode Config', config);
                                let payload = msg.payload as string;
                                if (!payload) {
                                    RED.log.error(`Invalid Mode: ${msg.payload}`);
                                }

                                api.getLocations()
                                    .then(locations => locations.find(location => location.id === config.locationId))
                                    .then(location => {
                                        location.getDevices()
                                            .then(devices => {
                                                return config.bypass && devices.filter(d => d.data.faulted)
                                                    .map(d => d.data.zid);
                                            })
                                            .then(devicesToIgnore => {
                                                console.log('devicesToIgnore', devicesToIgnore);


                                                switch (payload) {
                                                    case 'some':
                                                    case 'home': {
                                                        location.armHome(devicesToIgnore).then(res => {
                                                            done();
                                                        }).catch(e => {
                                                            RED.log.error(e);
                                                            return location.setLocationMode('home');
                                                        }).then(res => {
                                                            done();
                                                        }).catch(e => {
                                                            RED.log.error(e);
                                                        });
                                                        break;
                                                    }
                                                    case 'all':
                                                    case 'arm': {
                                                        location.armAway(devicesToIgnore).then(res => {
                                                            done();
                                                        }).catch(e => {
                                                            RED.log.error(e);
                                                            return location.setLocationMode('away');
                                                        }).then(res => {
                                                            done();
                                                        }).catch(e => {
                                                            RED.log.error(e);
                                                        });
                                                        break;
                                                    }
                                                    case 'none':
                                                    case 'disarm' : {
                                                        location.disarm().then(res => {
                                                            done();
                                                        }).catch(e => {
                                                            RED.log.error(e);
                                                            return location.setLocationMode('disarmed');
                                                        }).then(res => {
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

                                    })
                                    .catch(e => RED.log.error(e));
                            },
                        );
                    } else {
                        this.status({
                            fill: 'red',
                            text: 'no credentials',
                        });
                    }
                });
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
                configNode.once('ring-config-token-fetched', () => {
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
                                }))
                                .then(subscription => {
                                    this.on('close', () => {
                                        subscription.unsubscribe();
                                    });
                                });

                            this.status({
                                fill: 'green',
                                text: 'connected',
                            });
                        }));

                    }
                });
            } catch (e) {
                this.status({
                    fill: 'red',
                    text: `Error: ${e.error}`,
                });
            }
        }

        RED.nodes.registerType('Alarm Status', RingAlarmStatus);

    }
;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = init;