FROM alpine:3.22

RUN apk add --no-cache imagemagick imagemagick-jpeg imagemagick-webp \
    && adduser -D -u 1000 magick

COPY policy.xml /etc/ImageMagick-7/policy.xml

USER magick
WORKDIR /work
