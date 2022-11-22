// create an empty modbus client
const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

const mqtt = require("mqtt");
const mqttClient = mqtt.connect(process.env.MQTT_SERVER, {"username": process.env.MQTT_USER, "password": process.env.MQTT_PWD});
const mqttTopic = "deye-inverter/";

let timeoutModbusRead = null;


// open connection to a serial port
client.connectRTUBuffered(process.env.DEVICE || "/dev/ttyUSB0", { baudRate: process.env.BOUDRATE || 9600 });
client.setID(process.env.CLIENTID || 1);
client.setTimeout(500);


const registers = [
    {"address": 619, "topic": "grid/power/total", "unit": 1},
    {"address": 607, "topic": "grid/power/inverter", "unit": 1},
    {"address": 609, "topic": "grid/frequency", "unit": 0.01},
    {"address": 637, "topic": "inverter/power/total", "unit": 1},
    {"address": 643, "topic": "load/power/total", "unit": 1},
    {"address": 672, "topic": "pv/power/pv1", "unit": 1},
    {"address": 673, "topic": "pv/power/pv2", "unit": 1}
];


const startRegister = 600;
let lastData = null;
let lastPvPowerTotal = null;

setInterval(function() {

    client.readHoldingRegisters(startRegister, 90, function(err, data) {

        for (register of registers) {
            let index = register.address - startRegister;

            // only update value to mqtt if it has changed
            if (lastData == null || lastData[index] !== data.data[index]) {
                let value = ((data.data[index] << 16) >> 16) * register.unit;

                mqttClient.publish(mqttTopic + register.topic, value.toString());            
            }
        }

        // calculate power total
        let pvPowerTotal = data.data[72] + data.data[73];
        if ( lastPvPowerTotal == null || pvPowerTotal !== lastPvPowerTotal) {
            mqttClient.publish(mqttTopic + "pv/power/total", pvPowerTotal.toString());
        }

        lastData = data.data;
        lastPvPowerTotal = pvPowerTotal;
    });

}, 1000);

