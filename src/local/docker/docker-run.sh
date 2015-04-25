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
CONFIG_FILE=etc/rhizi-server.conf
SED_1='s|neo4j_url.*|neo4j_url = http:\/\/$N4_PORT_7474_TCP_ADDR:7474|'
SED_2='s|listen_address.*|listen_address = 0.0.0.0|'
(
    ant -f build.ant deploy-local -DlocalServerUseSymlink=false &&
    docker run --name rhizi.devel.$PORT -it -p $PORT:8080 --link rhizi.neo4j:n4 -v `pwd`/deploy-local:/home/rhizi rhizi/fedora:0.1 bash -c "\
        sed -ie \"$SED_1\" -e \"$SED_2\" $CONFIG_FILE;\
        python2.7 bin/rz_server.py --config-dir etc"
)
