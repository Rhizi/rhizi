#!/bin/sh
if [ `uname` == "Darwin" ]; then
    neo4j_count=`netstat -na -ptcp 2>/dev/null | grep 7474 | wc -l`
else
    neo4j_count=`netstat -ltnop 2>/dev/null | grep 7474 | wc -l`
fi
if [ $neo4j_count == "0" ]; then
    echo run neo4j please
    exit 0
fi
make # building css relies on Makefile
ant -f build.ant deploy-local
cd deploy-local
python bin/rz_server.py --config-dir etc
