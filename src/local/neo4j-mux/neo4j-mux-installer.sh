#!/bin/bash

#
# Multiplexed Neo4J instance installer
#
# generated config dir structure:
#
#   /etc/neo4j/mux-conf.d/
#   └── dom-x
#       ├── neo4j.properties
#       ├── neo4j-server.properties
#       └──  ...
#
# generated root dir structure:
#
#   /var/lib/neo4j/mux-root.d/
#   └── dom-x
#       ├── data/
#       ├── bin -> /var/lib/neo4j/bin
#       ├── conf -> /etc/neo4j/mux-conf.d/dom-y
#       ├── lib -> /usr/share/neo4j/lib
#       ├── plugins -> /usr/share/neo4j/plugins
#       └── system -> /usr/share/neo4j/system
#

die() {
    echo $1 1>&2; exit 1
}

install_neo4j_instance() {

    [[ -e "/etc/init.d/${RZ_NEO4J_SVC_NAME}" ]] && die "${RZ_NEO4J_SVC_NAME} already installed."

    install -v --owner=${NEO4J_USER} --group=adm --directory /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}
    install -v --owner=${NEO4J_USER} --group=adm --directory /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}
    install -v --owner=${NEO4J_USER} --group=adm --directory /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}/ssl
    install -v --owner=${NEO4J_USER} --group=adm --directory /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}
    install -v --owner=${NEO4J_USER} --group=adm --directory /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/data

    cp /etc/neo4j/custom-logback.xml \
       /etc/neo4j/jmx.access \
       /etc/neo4j/jmx.password \
       /etc/neo4j/logging.properties \
       /etc/neo4j/neo4j-http-logging.xml \
       /etc/neo4j/neo4j.properties \
       /etc/neo4j/neo4j-server.properties \
       /etc/neo4j/neo4j-wrapper.conf \
       /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}

    cp /etc/neo4j/custom-logback.xml \
       /etc/neo4j/ssl/snakeoil.cert \
       /etc/neo4j/ssl/snakeoil.key \
       /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}/ssl

    ln -vs /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}          -T /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/conf
    ln -vs /var/lib/neo4j/bin                                      -T /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/bin
    ln -vs /usr/share/neo4j/lib                                    -T /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/lib
    ln -vs /usr/share/neo4j/plugins                                -T /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/plugins
    ln -vs /usr/share/neo4j/system                                 -T /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/system

    python /tmp/neo-m/neo4j-mux-tool.py --domain ${RZ_INSTANCE_NAME}
}

DEFAULT_USER='neo4j'

NEO4J_HOME=`(cd  $(dirname $0)/.. && pwd)`
NEO4J_USER=neo4j

SCRIPT_NAME="${NEO4J_HOME}/bin/neo4j"

RZ_NEO4J_SVC_NAME='neo4j-service__domain-x'
SVC_INIT_SCRIPT_PATH=/etc/init.d/${RZ_NEO4J_SVC_NAME}

PID_FILE=/var/run/${RZ_NEO4J_SVC_NAME}

RZ_INSTANCE_NAME=$2

[ $UID != 0 ] && die 'must be root to continue.'
[ -z ${RZ_INSTANCE_NAME} ] && die 'RZ_INSTANCE_NAME arg missing, aborting'
[ -e "$PID_FILE" ] && die '${RZ_NEO4J_SVC_NAME} already running, please stop it before continuing'

case $1 in
    install)
        install_neo4j_instance

        tree /var/lib/neo4j/mux-root.d/
        tree /etc/neo4j/mux-conf.d/
    ;;
    uninstall)
        rm ${SVC_INIT_SCRIPT_PATH}
        rm -rf /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}
        rm -rf /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}
    ;;
    *)
    echo "Usage: $0 <install|remove>"
    ;;
esac