FROM postgres:16-alpine
COPY ./init.sql /docker-entrypoint-initdb.d/
# RUN apk add --no-cache postgresql-contrib
EXPOSE 5432
