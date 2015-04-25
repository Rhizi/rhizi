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
SED_E='s|listen_address.*|listen_address = 0.0.0.0|'
(
    ant -f build.ant deploy-local -DlocalServerUseSymlink=false &&
    docker run -it -p $PORT:8080 -v `pwd`/deploy-local:/home/rhizi rhizi/fedora-single:0.1 bash -c "\
        /home/neo4j-community-2.2.1/bin/neo4j start;\
        sed -ie \"$SED_E\" $CONFIG_FILE;\
        python2.7 bin/rz_server.py --config-dir etc"
)
