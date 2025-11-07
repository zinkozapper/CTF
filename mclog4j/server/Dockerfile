FROM openjdk:8u181-jdk-alpine

EXPOSE 25565
EXPOSE 25575

COPY server.jar server.jar
RUN echo "eula=true" > eula.txt
RUN echo "online-mode=false" > server.properties && echo "enable-rcon=true" >> server.properties && echo "rcon.port=25575" >> server.properties && echo "rcon.password=password" >> server.properties
COPY flag.txt flag.txt


CMD java -Xmx1024M -Xms1024M -jar server.jar nogui
