# deye-hybrid-modbus2mqtt
Reads values from a 3 phase deye hybrid inverter via modbus and pushes them to mqtt.


## How to run this
You can run this via docker as a service:

```
docker run -d \
  --device /dev/ttyUSB0 \
  --name deye-inverter \
  --restart unless-stopped \
  --env MQTT_SERVER="mqtt://192.168.x.x" \
  --env MQTT_USER="xxxx" \
  --env MQTT_PWD="xxxx" \
  --env MQTT_TOPIC_PREFIX="deye-inverter/" \
  --env DEVICE="/dev/ttyUSB0" \
  deye-hybrid-modbus2mqtt
```

