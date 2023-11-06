# see https://minimalmodbus.readthedocs.io/en/stable/apiminimalmodbus.html#minimalmodbus.MODE_RTU
import serial
import minimalmodbus
import paho.mqtt.client as mqtt
import time
import os

device = os.environ['DEVICE']
mqtt_server = os.environ['MQTT_SERVER']
mqtt_topic = os.environ['MQTT_TOPIC']
mqtt_user = os.environ['MQTT_USER']
mqtt_pwd = os.environ['MQTT_PWD']

client = mqtt.Client()
client.username_pw_set(mqtt_user, password=mqtt_pwd)
client.connect(mqtt_server)
client.loop_start()

client.subscribe(mqtt_topic + '/battery/min-voltage', qos=0)
client.subscribe(mqtt_topic + '/gen', qos=0)

instrument = minimalmodbus.Instrument(port=device, slaveaddress=1, mode=minimalmodbus.MODE_RTU, close_port_after_each_call=True, debug=False)
instrument.serial.baudrate = 9600           # Baud
#instrument.serial.parity   = serial.PARITY_EVEN
#instrument.serial.bytesize = 8
#instrument.serial.stopbits = 1
#instrument.clear_buffers_before_each_transaction = True # False
instrument.serial.timeout  = 0.50           # 0.05 seconds is too fast

data = {}
previousData = {}
writeQueue = []

  # if ( topic == mqttTopic + 'pv/sell' ) {
  #   registerWriteQueue.push({"register": 145, "payload": [(payload.toString() == 1 ? 0x01 : 0x00)]});
  # }
  # if ( topic == mqttTopic + 'battery/min-voltage' ) {
  #   var volt = payload.toString();
  #   registerWriteQueue.push({"register": 160, "payload": [volt, volt, volt, volt, volt, volt]});
  # }
  # if ( topic == mqttTopic + 'gen' ) {
  #   registerWriteQueue.push({"register": 133, "payload":  [(payload.toString() == 1 ? 2 : 0)]});
  # }


def on_message(client, userdata, message):
  print("Received message '" + str(message.payload) + "' on topic '" + message.topic + "' with QoS " + str(message.qos))
  writeQueue.append(message)

def processQueue():
  for message in writeQueue[:]:
    if message.topic == mqtt_topic + '/gen':
      instrument.write_register(registeraddress=133, value=(2 if int(message.payload) == 1 else 0))

    if message.topic == mqtt_topic + '/battery/min-voltage':
      volt = int(message.payload)
      instrument.write_registers(registeraddress=160, values=[volt, volt, volt, volt, volt, volt])
    
    writeQueue.remove(message)


client.on_message = on_message

def process():
  global previousData

  try:
    ## Read value 
    data['pv/power/total/all'] = instrument.read_register(registeraddress=534, number_of_decimals=1) + instrument.read_register(registeraddress=535) * 6553.5
    data['battery/charge/total'] = instrument.read_register(registeraddress=516, number_of_decimals=1) + instrument.read_register(registeraddress=517) * 6553.5
    data['battery/discharge/total'] = instrument.read_register(registeraddress=518, number_of_decimals=1) + instrument.read_register(registeraddress=519) * 6553.5
    data['grid/buy/all'] = instrument.read_register(registeraddress=522, number_of_decimals=1) + instrument.read_register(registeraddress=523) * 6553.5
    data['grid/sell/all'] = instrument.read_register(registeraddress=524, number_of_decimals=1) + instrument.read_register(registeraddress=525) * 6553.5
    data['pv/power/total/day'] = instrument.read_register(registeraddress=529, number_of_decimals=1)
    data['load/power/total/all'] = instrument.read_register(registeraddress=527, number_of_decimals=1) + instrument.read_register(registeraddress=528) * 6553.5
    data['battery/voltage'] = instrument.read_register(registeraddress=587, number_of_decimals=2)
    data['battery/soc'] = instrument.read_register(registeraddress=588)
    data['battery/power'] = instrument.read_register(registeraddress=590, signed=True)
    data['grid/power/total'] = instrument.read_register(registeraddress=619, signed=True)
    data['grid/power/inverter'] = instrument.read_register(registeraddress=607, signed=True)
    data['grid/frequency'] = instrument.read_register(registeraddress=609, number_of_decimals=2)
    data['inverter/power/total'] = instrument.read_register(registeraddress=636, signed=True)
    data['load/power/total'] = instrument.read_register(registeraddress=643, signed=True)
    data['pv/power/pv1'] = instrument.read_register(registeraddress=672)
    data['pv/power/pv2'] = instrument.read_register(registeraddress=673)


  except IOError as e:
    print('ERROR: Failed to read from instrument:\n',e)
 
  instrument.serial.close()

  for topic, message in data.items():
    if previousData.get(topic) != message:
      client.publish(mqtt_topic + '/' + topic, payload=message, qos=0, retain=False)

  previousData = data.copy()
  # print(previousData)


while True:
  process()
  processQueue()
  time.sleep(1)
