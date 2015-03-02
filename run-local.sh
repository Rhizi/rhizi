#!/bin/bash
. tools/utils.sh

quit_if_no_neo4j_running

CONFIG=res/etc/rhizi-server.conf
EXAMPLE=res/etc/rhizi-server.conf.example
HTPASSWD=res/etc/htpasswd
if [ ! -f $CONFIG ]; then
    echo "copying $EXAMPLE to $CONF"
    echo "please edit it as you see fit"
    cp $EXAMPLE $CONFIG
fi
make # building css relies on Makefile
ant -f build.ant deploy-local
cd deploy-local
python2.7 bin/rz_server.py --config-dir etc
