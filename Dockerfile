FROM node:14

COPY . /app
WORKDIR /app

EXPOSE 4200

RUN cd ocr-test && npm install
