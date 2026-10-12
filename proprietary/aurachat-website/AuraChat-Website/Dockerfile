FROM nginx:alpine

# Sicherheits-Updates der Alpine-Pakete einspielen (libexpat, pcre2 ...)
RUN apk upgrade --no-cache

COPY html/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
