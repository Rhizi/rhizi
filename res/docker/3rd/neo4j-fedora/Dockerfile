# neo4j build for rhizi
FROM fedora:21
MAINTAINER Alon Levy <alon@pobox.com>
RUN yum install -y dnf
RUN dnf install -y lsof java 
ADD neo4j-community-2.2.1-unix.tar.gz /home/
RUN sed -i -e's/dbms.security.auth_enabled=true/dbms.security.auth_enabled=false/' /home/neo4j-community-2.2.1/conf/neo4j-server.properties
RUN sed -i -e's/#org.neo4j.server.webserver.address=0.0.0.0/org.neo4j.server.webserver.address=0.0.0.0/' /home/neo4j-community-2.2.1/conf/neo4j-server.properties
#RUN cd /root/ && wget http://neo4j.com/artifact.php?name=neo4j-community-2.2.1-unix.tar.gz -Oneo4j.tar.gz
WORKDIR /home/neo4j-community-2.2.1/bin
ENV NEO4J_ROOT /home/neo4j-community-2.2.1
