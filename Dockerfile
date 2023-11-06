FROM python:3-alpine

WORKDIR /app

RUN pip install minimalmodbus paho-mqtt

COPY . .

CMD ["python", "-u", "main.py"]