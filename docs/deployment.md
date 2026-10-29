# Value Finder deployment guide

## Configuration boundaries

Value Finder uses separate Compose configuration for local development and
production:

- `docker-compose.yml` is the local development stack. It contains the
  `postgres` and `value-finder` services, the `value-finder-network` network,
  and the existing `postgres_data` volume.
- `docker-compose.server.yml` is the production-only overlay. It attaches the
  `value-finder` service to the external `shared_proxy` network with the alias
  `iti-valuefinder-web`.

Production commands must always specify both Compose files, in that order.
Do not rename the services, the internal network, or the PostgreSQL volume.

## Prerequisites

The deployment server requires Docker Engine 24+, Docker Compose v2+, and Git.
The shared reverse-proxy network must already exist:

```bash
docker network inspect shared_proxy
```

Creating or managing the shared proxy network is an infrastructure operation
and is outside this application's deployment procedure.

## Environment configuration

Environment files containing real credentials are server-local configuration.
They must never be copied from production into the repository or committed.

The repository intentionally ignores `.env` and `.env.*`, except for these
placeholder-only templates:

- `.env.example`
- `.env.local.example`
- `.env.server.example`

For a new server installation, create the runtime file from the server
template and replace every placeholder on the server:

```bash
cp .env.server.example .env
chmod 600 .env
```

Keep the existing production variable names and values during an upgrade.
In particular, `DB_HOST=postgres` remains compatible with the bundled database
service. Never overwrite a working production `.env` with an example file.

## Deploy a specific release

Production must deploy an immutable release tag, not an unpinned branch head.
Replace `<release-tag>` with an approved tag such as `v1.1.1`:

```bash
git fetch origin --tags
git checkout --detach <release-tag>
git describe --tags --exact-match
```

The final command must print the intended release tag before deployment.

Validate the combined configuration before making any container changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml config --quiet
```

Deploy only the application service. `--no-deps` prevents this command from
recreating or replacing PostgreSQL:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build --no-deps value-finder
```

Do not use single-file Compose commands in production. Do not run
`docker compose down -v` during deployment; `-v` deletes the persistent
PostgreSQL volume and its data.

## Verification

Confirm the merged project state and review the application logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
docker compose -f docker-compose.yml -f docker-compose.server.yml logs --tail=100 value-finder
```

Confirm the health endpoint reports `UP` and the expected release version:

```bash
curl --fail http://127.0.0.1:3001/api/health
```

## Database safeguards

The `postgres_data` named volume and the `postgres` service are defined only in
the base Compose file and are preserved by the application-only deployment
command. `db-init.sql` runs only when PostgreSQL initializes an empty data
directory; it does not replace or reset an existing production database.

Before any separately approved database maintenance, take and verify a backup.
Database resets and volume deletion are not deployment steps.

## Local development

Local development continues to use only the base file:

```bash
docker compose up -d --build
docker compose ps
```

Local configuration may be based on `.env.local.example`. Placeholder values
must be changed only in ignored, developer-local environment files.
