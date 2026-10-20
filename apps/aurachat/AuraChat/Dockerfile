FROM nginx:alpine

# Sicherheits-Updates der Alpine-Pakete einspielen (libexpat, pcre2 ...)
RUN apk upgrade --no-cache

# Optionaler Fallback, falls kein Volume gemountet wird
COPY ./html /usr/share/nginx/html

# Kopiert unsere Nginx-Konfiguration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
