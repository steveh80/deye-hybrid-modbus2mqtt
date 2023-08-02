FROM python:3-alpine

WORKDIR /app

RUN pip install minimalmodbus paho-mqtt

COPY . .

CMD [ "/app/python.sh" ]
