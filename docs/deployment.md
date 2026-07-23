# Value Finder - Deployment Guide

## Overview

This document describes how to deploy the Value Finder application using Docker.

The application consists of:

- React + TanStack Start frontend/server
- PostgreSQL database
- Docker containers managed with Docker Compose

---

# Prerequisites

Ensure the following software is installed on the deployment server:

- Docker Engine 24+
- Docker Compose v2+
- Git

Verify the installation:

```bash
docker --version
docker compose version
git --version
```

---

# Clone Repository

Clone the repository from GitHub.

```bash
git clone <repository-url>
cd value-finder
```

---

# Configure Environment Variables

Copy the example environment file.

```bash
cp .env.example .env
```

Update the values in `.env`.

Example:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3001

DB_HOST=postgres
DB_PORT=5432
DB_NAME=value_finder
DB_USER=postgres
DB_PASSWORD=change_this_password

JWT_SECRET=your_secure_random_secret
JWT_EXPIRES_IN=8h
```

> **Important**
>
> Never commit the `.env` file to Git.

---

# Build Docker Image

Build the Docker image.

```bash
docker build -t value-finder:latest .
```

If your environment uses TLS interception or an internal certificate chain for
registry access, you may need to set Docker build args or trusted certificates
so npm can install packages inside the container.

---

# Start Application

Start the application using Docker Compose.

```bash
docker compose up -d
```

This starts:

- `postgres` using the official PostgreSQL image
- `value-finder` using the application Dockerfile

On first startup, PostgreSQL automatically runs `db-init.sql` from
`/docker-entrypoint-initdb.d/` and creates the application schema.

Verify the container is running.

```bash
docker ps
```

---

# Verify Deployment

Open the application in your browser.

```
http://localhost:3001
```

If deployed on another server:

```
http://<server-ip>:3001
```

---

# View Logs

View application logs.

```bash
docker compose logs -f
```

View logs for a specific service.

```bash
docker compose logs -f value-finder
```

---

# Stop Application

Stop the application.

```bash
docker compose down
```

---

# Restart Application

Restart the application.

```bash
docker compose restart
```

---

# Update Application

Pull the latest source code.

```bash
git pull
```

Rebuild the Docker image.

```bash
docker compose build --no-cache
```

Start the updated container.

```bash
docker compose up -d
```

---

# Database

The PostgreSQL database is included in `docker-compose.yml`.

Ensure:

- Database credentials in `.env` are correct.
- `DB_HOST=postgres` when using the bundled Compose database.
- `db-init.sql` contains the desired schema before first startup.

## Schema initialization behavior

`db-init.sql` is executed automatically only when the PostgreSQL data directory
is empty.

If you need to recreate the database from scratch and re-run the schema:

```bash
docker compose down -v
docker compose up -d
```

This removes the named PostgreSQL volume and initializes a fresh database on
the next start.

---

# Troubleshooting

## Application does not start

Check container logs.

```bash
docker compose logs -f
```

---

## Database connection failed

Verify:

- PostgreSQL is running: `docker compose ps`
- Database credentials are correct.
- `DB_HOST=postgres` in `.env` when using the bundled database.
- The PostgreSQL container is healthy before the app starts.

---

## Port already in use

Check which process is using the port.

Linux:

```bash
sudo lsof -i :3001
```

Windows:

```cmd
netstat -ano | findstr 3001
```

Change the port in:

- `.env`
- `docker-compose.yml`

if required.

---

# Security Recommendations

For production deployments:

- Use a strong `JWT_SECRET`.
- Never commit `.env`.
- Use a strong `DB_PASSWORD`.
- Restrict database access if you later expose PostgreSQL outside the Docker network.
- Enable HTTPS using Nginx or another reverse proxy.
- Regularly update Docker images.
- Monitor container logs.
- Perform regular PostgreSQL backups.

---

# Future Enhancements

Future production infrastructure may include:

- Shared Nginx reverse proxy
- HTTPS (Let's Encrypt)
- Multiple applications behind one Nginx instance
- Health endpoints
- Automated backups
- CI/CD pipeline
- Monitoring and alerting

---

# Version

Document Version: **1.0**

Application: **Value Finder**

Last Updated: July 2026
