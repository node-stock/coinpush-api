FROM mhart/alpine-node:11.11.0

ARG env

# config
COPY /_config /usr/src/app/_config

# shared
COPY /shared/modules/coinpush /usr/src/app/shared/modules/coinpush

# server
WORKDIR /usr/src/app/server-gateway
COPY /server-gateway/package.json server-gateway/tsconfig.json ./
RUN npm i --quiet --no-progress
COPY /server-gateway/src ./src

# dist build
RUN if [ "$env" = "production" ] ; then npm run build && npm prune --production && rm -rf src; fi