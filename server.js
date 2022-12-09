// create an empty modbus client
const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();
const modbusReadDelay = 1000;

const mqtt = require("mqtt");
const mqttClient = mqtt.connect(process.env.MQTT_SERVER, {"username": process.env.MQTT_USER, "password": process.env.MQTT_PWD});
const mqttTopic = "deye-inverter/";

// helper function
async function delay(ms) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

// open connection to a serial port
client.connectRTUBuffered(process.env.DEVICE || "/dev/ttyUSB0", { baudRate: process.env.BOUDRATE || 9600 });
client.setID(process.env.CLIENTID || 1);
client.setTimeout(500);

const registers = {
    529: {"topic": "pv/power/total/day", "unit": 0.1},
    530: {"topic": "pv/power/pv1/day", "unit": 0.1},
    531: {"topic": "pv/power/pv2/day", "unit": 0.1},
    534: {"topic": "pv/power/total/all", "unit": 0.1},
    619: {"topic": "grid/power/total", "unit": 1},
    607: {"topic": "grid/power/inverter", "unit": 1},
    609: {"topic": "grid/frequency", "unit": 0.01},
    637: {"topic": "inverter/power/total", "unit": 1},
    643: {"topic": "load/power/total", "unit": 1},
    672: {"topic": "pv/power/pv1", "unit": 1},
    673: {"topic": "pv/power/pv2", "unit": 1}
};


function readRegisters(startRegister, length) {
    client.readHoldingRegisters(startRegister, length, function(err, data) {
        if (err !== null) {
            console.log(err);
            return;
        }

        // iterate over returned data and look if have a corresponding item in registers
        // if yes, save the data in registers for later use and publish the data over mqtt
        for (const index in data.data) {
            let addressIndex = parseInt(index) + startRegister;

            if (registers.hasOwnProperty(addressIndex)) {
                let value = Math.floor(((data.data[index] << 16) >> 16) * registers[addressIndex].unit*10)/10;

                // only publish new or changed values
                if (! registers[addressIndex].hasOwnProperty('lastValue') || value !== registers[addressIndex].lastValue ) {
                    mqttClient.publish(mqttTopic + registers[addressIndex].topic, value.toString());            
                }

                registers[addressIndex].lastValue = value;
            }
        }
    });
}

let lastPvPowerTotal = null;
function calculateTotals() {
    // calculate power total
    let pvPowerTotal = registers[672].lastValue + registers[673].lastValue;
    if ( lastPvPowerTotal == null || pvPowerTotal !== lastPvPowerTotal) {
        mqttClient.publish(mqttTopic + "pv/power/total", pvPowerTotal.toString());
    }
    lastPvPowerTotal = pvPowerTotal;
}

let run = async ()=>{
    while (true) {
        await delay(modbusReadDelay);   
        readRegisters(500, 90);
        await delay(modbusReadDelay);
        readRegisters(600, 90);
        calculateTotals();
    }
}
run();


