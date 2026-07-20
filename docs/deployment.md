# Value Finder - Deployment Guide

## Overview

This document describes how to deploy the Value Finder application using Docker.

The application consists of:

- React + TanStack Start frontend/server
- PostgreSQL database
- Docker container

> **Note:** PostgreSQL is currently hosted outside the Docker container. The application connects to it using the configured database connection settings.

---

# Prerequisites

Ensure the following software is installed on the deployment server:

- Docker Engine 24+
- Docker Compose v2+
- Git
- PostgreSQL (or access to an existing PostgreSQL server)

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

DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=value_finder
DB_USER=postgres
DB_PASSWORD=your_password

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

---

# Start Application

Start the application using Docker Compose.

```bash
docker compose up -d
```

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

The application requires a PostgreSQL database.

Ensure:

- PostgreSQL service is running.
- Database credentials in `.env` are correct.
- The configured database exists.
- Required tables have been created.

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

- PostgreSQL is running.
- Database credentials are correct.
- Database host is reachable.
- Firewall rules allow the connection.

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
- Restrict database access.
- Enable HTTPS using Nginx or another reverse proxy.
- Regularly update Docker images.
- Monitor container logs.
- Perform regular PostgreSQL backups.

---

# Future Enhancements

The current deployment uses a single Docker container.

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