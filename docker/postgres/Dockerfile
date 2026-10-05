# postgis/postgis is published for amd64 only; build PostGIS on the multi-arch Postgres image
# so it runs natively on Apple Silicon too.
FROM postgres:17-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-postgis-3 \
  && rm -rf /var/lib/apt/lists/*
