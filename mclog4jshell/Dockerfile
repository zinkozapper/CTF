FROM openjdk:8u181-jdk-alpine

EXPOSE 25565

ADD server.jar server.jar
RUN echo "eula=true" > eula.txt
RUN echo "online-mode=false" > server.properties
COPY flag.txt flag.txt


CMD java -Xmx1024M -Xms1024M -jar server.jar nogui
