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
CONFIG=res/etc/rhizi-server.conf
EXAMPLE=res/etc/rhizi-server.conf.example
HTPASSWD=res/etc/htpasswd
if [ ! -f $CONFIG ]; then
    echo "copying $EXAMPLE to $CONF"
    echo "please edit it as you see fit"
    cp $EXAMPLE $CONFIG
fi
if [ `cat $CONFIG | grep access_control | grep True | wc -l` == 1 -a ! -e $HTPASSWD ] ; then
    echo "missing htpasswd file. Please create an input file containing"
    echo "username,password"
    echo "on every line, one line per user"
    echo "place it in for instance res/etc/htpasswd-init-file"
    echo "and run"
    echo "src/local/rz_cli_tool.py  --init-htpasswd-db --config-dir res/etc --htpasswd-init-file res/etc/htpasswd-init-file"
    exit 1
fi
make # building css relies on Makefile
ant -f build.ant deploy-local
cd deploy-local
python bin/rz_server.py --config-dir etc
