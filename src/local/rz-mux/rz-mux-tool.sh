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

install_instance__neo4j() {

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

    ln -vs -T /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}   /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/conf
    ln -vs -T /var/lib/neo4j/bin                          /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/bin
    ln -vs -T /usr/share/neo4j/lib                        /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/lib
    ln -vs -T /usr/share/neo4j/plugins                    /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/plugins
    ln -vs -T /usr/share/neo4j/system                     /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}/system

    python /tmp/neo-m/neo4j-mux-tool.py --domain ${RZ_INSTANCE_NAME}

    # set modes, ownership
    chmod +x ${SVC_INIT_SCRIPT_PATH}
}

install_instance__apache() {
    install -v --owner=${APACHE_USER} --group=${APACHE_USER} --directory /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}
    install -v --owner=${APACHE_USER} --group=${APACHE_USER} --directory /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}/webapp
    install -v --owner=${APACHE_USER} --group=${APACHE_USER} --directory /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}/auth

    ln -vs -T /etc/rhizi/mux-conf.d/${RZ_INSTANCE_NAME}   /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}/webapp/etc
    ln -vs -T /usr/share/rhizi/webapp/static/             /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}/webapp/static
    ln -vs -T /usr/share/rhizi/webapp/templates/          /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}/webapp/templates

    apache_site_conf=${RZ_INSTANCE_NAME}.${RZ_TOP_DOMAIN_NAME}
    ln -vs -T /etc/apache/sites-available/${apache_site_conf} /etc/apache/sites-enabled/${apache_site_conf}
    ln -vs -T /etc/apache/sites-available/${apache_site_conf} /etc/apache/sites-enabled/${apache_site_conf}
}

install_instance__rz() {
    install -v --owner=${NEO4J_USER} --group=adm --directory /etc/rhizi/mux-conf.d/${RZ_INSTANCE_NAME}

    cp /etc/rhizi/rhizi-server.conf.example /etc/rhizi/mux-conf.d/${RZ_INSTANCE_NAME}/
}

uninstall_instance__apache() {
    rm -rvf /srv/rhizi/mux-root.d/${RZ_INSTANCE_NAME}
}

uninstall_instance__neo4j() {
     rm ${SVC_INIT_SCRIPT_PATH}
     rm -rf /etc/neo4j/mux-conf.d/${RZ_INSTANCE_NAME}
     rm -rf /var/lib/neo4j/mux-root.d/${RZ_INSTANCE_NAME}
}

uninstall_instance__rz() {
    rm -rvf /etc/rhizi/mux-conf.d/${RZ_INSTANCE_NAME}
}

DEFAULT_USER='neo4j'

NEO4J_HOME=`(cd  $(dirname $0)/.. && pwd)`
NEO4J_USER=neo4j

APACHE_USER=www-data

SCRIPT_NAME="${NEO4J_HOME}/bin/neo4j"

RZ_TOP_DOMAIN_NAME=rhizi.net
RZ_NEO4J_SVC_NAME='neo4j-service__domain-x'
SVC_INIT_SCRIPT_PATH=/etc/init.d/${RZ_NEO4J_SVC_NAME}

PID_FILE=/var/run/${RZ_NEO4J_SVC_NAME}

RZ_INSTANCE_NAME=$2

[ $UID != 0 ] && die 'must be root to continue.'
[ -z ${RZ_INSTANCE_NAME} ] && die 'RZ_INSTANCE_NAME arg missing, aborting'
[ -e "$PID_FILE" ] && die '${RZ_NEO4J_SVC_NAME} already running, please stop it before continuing'

case $1 in
    install)
        install_instance__apache
        install_instance__neo4j
        install_instance__rz

        tree /srv/www/rhizi/
        tree /var/lib/neo4j/mux-root.d/
        tree /etc/neo4j/mux-conf.d/
        tree /srv/www/rhizi/mux-root.d/

        echo "please edit & enable rz_config at /etc/rhizi/mux-conf.d/${RZ_INSTANCE_NAME}/"
    ;;
    uninstall)
        uninstall_instance__apache
        uninstall_instance__neo4j
        uninstall_instance__rz
    ;;
    *)
    echo "Usage: $0 <install|remove>"
    ;;
esac
