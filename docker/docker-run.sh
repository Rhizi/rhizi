#!/bin/bash
if [ ! -e .git ]; then
    echo run from top level checkout of rhizi repository
    exit 0
fi
# cannot bind to localhost in docker, must bind to 0.0.0.0
PORT=8080
if [ "x$1" != "x" ]; then
    PORT=$1
fi
sed -i -e 's/listen_address = 127.0.0.1/listen_address = 0.0.0.0/' res/etc/rhizi-server.conf
sed -i -e "s/listen_port.*/listen_port = $PORT/" res/etc/rhizi-server.conf
sed -i -e "s/SERVER_NAME.*/SERVER_NAME = rhizi.local:$PORT/" res/etc/rhizi-server.conf
docker run -it -p $PORT:$PORT -v `pwd`:/home/rhizi alon/rhizi:test1 ./run-both-local.sh
