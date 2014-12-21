#!/bin/sh
if [ `(netstat -ltnop 2>/dev/null | grep 7474 | wc -l)` == 0 ]; then
    echo run neo4j please
    exit 0
fi
ant -f build.ant deploy-local
cd deploy-local
python bin/rhizi_server.py --config-dir etc
