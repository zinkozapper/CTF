FROM python:3.11-slim
WORKDIR /web
COPY web.py .
COPY marshalsec-0.0.3-SNAPSHOT-all.jar .
COPY jdk1.8.0_181 ./jdk1.8.0_181

EXPOSE 8080
EXPOSE 1389

CMD ["python", "web.py"]
