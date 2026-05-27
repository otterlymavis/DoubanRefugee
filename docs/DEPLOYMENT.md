# Deployment

## Docker

Use Docker Compose for a complete self-hosted stack:

```bash
cp .env.example .env
docker compose up --build
```

## Production Notes

- Use managed PostgreSQL and Redis.
- Set a real `APP_SECRET_KEY` and `COOKIE_ENCRYPTION_KEY`.
- Configure object storage for export artifacts if local disk is ephemeral.
- Run API and worker services separately.
- Put the FastAPI service behind TLS and restrict CORS to the frontend origin.
- Keep export retention short unless the user explicitly requests archival
  hosting.

## Vercel Frontend

The frontend can be deployed independently. Install the Vercel CLI with:

```bash
npm i -g vercel
```

Then configure `NEXT_PUBLIC_API_BASE_URL` and deploy from `frontend/`.

