FROM openresty/openresty:alpine

COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
RUN mkdir /p /var/log/nginx/

CMD ["/usr/local/openresty/bin/openresty", "-g", "daemon off;"]
