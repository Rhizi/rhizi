FROM fedora:22
MAINTAINER Alon Levy <alon@pobox.com>
RUN yum install -y dnf
# development requirements
RUN dnf install -y wget tar lsof git iproute make rubygem-sass ant ipython tmux strace
RUN dnf install lsof java
# runtime requirements
RUN dnf install -y python-flask net-tools python-pip python-gevent-websocket python-gevent-websocketio python-gevent-socketio
# some of these have fedora packages. some of thoes are out of date
# python-futures
RUN pip install enum futures flask-socketio
ADD neo4j-community-2.2.1-unix.tar.gz /home/
RUN sed -i -e's/dbms.security.auth_enabled=true/dbms.security.auth_enabled=false/' /home/neo4j-community-2.2.1/conf/neo4j-server.properties
RUN sed -i -e's/#org.neo4j.server.webserver.address=0.0.0.0/org.neo4j.server.webserver.address=0.0.0.0/' /home/neo4j-community-2.2.1/conf/neo4j-server.properties
#RUN cd /root/ && wget http://neo4j.com/artifact.php?name=neo4j-community-2.2.1-unix.tar.gz -Oneo4j.tar.gz
WORKDIR /home/rhizi
ENV NEO4J_ROOT /home/neo4j-community-2.2.1
