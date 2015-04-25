FROM fedora:21
MAINTAINER Alon Levy <alon@pobox.com>
RUN yum install -y dnf
# development requirements
RUN dnf install -y wget tar lsof git iproute make rubygem-sass ant ipython tmux strace
# runtime requirements
RUN dnf install -y python-flask net-tools python-pip python-gevent-websocket python-gevent-websocketio python-gevent-socketio
# some of these have fedora packages. some of thoes are out of date
# python-futures
RUN pip install enum futures flask-socketio
#RUN cd /root/ && wget http://neo4j.com/artifact.php?name=neo4j-community-2.2.1-unix.tar.gz -Oneo4j.tar.gz
WORKDIR /home/rhizi
ENV NEO4J_ROOT /home/neo4j-community-2.2.1
