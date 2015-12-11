#!/bin/bash
. src/local/utils.sh

quit_if_no_neo4j_running

CONFIG=res/etc/rhizi-server.conf
EXAMPLE=res/etc/rhizi-server.conf.example
HTPASSWD=res/etc/htpasswd
if [ "x$DOMAIN" == "x" ]; then
    echo using default domain
    DOMAIN=default.rhizi.net
else
    echo using $DOMAIN domain
fi
if [ ! -f $CONFIG ]; then
    echo "copying $EXAMPLE to $CONF"
    echo "please edit it as you see fit"
    cp $EXAMPLE $CONFIG
fi
make # building css relies on Makefile
ant -f build.ant deploy-local -DdefaultDomain=$DOMAIN -DtargetDomain=$DOMAIN && (
    cd deploy-local
    PYTHONPATH=. ./bin/rz-user-tool init --config-dir etc --user-db-path user_db.db --user-db-ugid `whoami`
    echo test | PYTHONPATH=. ./bin/rz-user-tool add --config-dir etc --user-db-path user_db.db --first-name test --last-name test --email test@example.com --password-file - --username test
    PYTHONPATH=. python ./bin/rz-server --config-dir etc
)
