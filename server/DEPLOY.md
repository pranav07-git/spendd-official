# Deploying the Spendd server

The server keeps accounts (`users.json`) and the merchant cache (`merchants.json`) as files, so for
real users it needs a disk that survives restarts and deploys. Two ways to host it:

- [Render](#render): free plan, kept awake by the server pinging itself.
- [Google Cloud](#google-cloud-compute-engine): a VM you manage yourself.

## Render

The repo's [`render.yaml`](../render.yaml) sets up one web service on Render's **free** plan.

**Staying awake:** free services sleep after 15 minutes without inbound requests. On Render the
server finds its public address in `RENDER_EXTERNAL_URL` (Render sets it) and requests its own
`/health` through it every 10 minutes, so it never goes idle. A service that never sleeps uses about
744 hours a month, inside the 750 free hours each workspace gets. Don't run a second free service
in the same workspace: when the hours run out, Render suspends free services until the next month.

> **Warning: accounts don't survive on the free plan.** Free services can't have a disk; their files
> are wiped on every deploy and whenever Render restarts them, which it may do at any time. That
> deletes `users.json`: every account is gone, phones get signed out and people have to sign up
> again. Fine for testing; before real users, move accounts into a database (a free Postgres such as
> Neon or Supabase) or switch to a paid instance with a disk.

### 1. Push the code

Commit and push `render.yaml` and `server/` to GitHub (`main`).

### 2. Create the service from the Blueprint

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with GitHub and give Render
   access to the `spendd-official` repo.
2. **New → Blueprint**, pick the repo, branch `main`. Render reads `render.yaml` and shows one free
   web service, `spendd-server`, in Singapore (the closest region to India).
3. It asks for `GEMINI_API_KEY`: paste your key from [AI Studio](https://aistudio.google.com/apikey).
   `JWT_SECRET` is generated for you.
4. **Apply**. The first build takes a few minutes. No payment method is needed.

### 3. Check it

When the deploy shows **Live**, your URL is on the service page, e.g.
`https://spendd-server.onrender.com`:

```sh
curl https://spendd-server.onrender.com/health      # {"ok":true,...}
```

The **Logs** tab should show `Keep-alive: pinging https://spendd-server.onrender.com/health every 10
min`. If the deploy fails, `Set JWT_SECRET...` or `Set GEMINI_API_KEY...` means an environment
variable is missing (Environment tab).

### 4. Point the app at it

In `src/config.ts`, set `PRODUCTION_API_URL = 'https://spendd-server.onrender.com'` (your URL, no
trailing slash), then build a release APK.

### Good to know

- **Deploys:** every push to `main` that changes `server/` redeploys, which wipes accounts (see the
  warning above).
- **Never change `JWT_SECRET`** in the Environment tab: it would sign everyone out.
- **To stop the self-pings,** set `KEEP_ALIVE=0` in the Environment tab.
- **Custom domain:** Settings → Custom Domains, e.g. `api.yourdomain.com`; Render issues the
  certificate. Update `PRODUCTION_API_URL` to match.

## Google Cloud (Compute Engine)

One VM, not Cloud Run (Cloud Run's filesystem is wiped on every restart and deploy, so every account
would be lost). A small VM in Mumbai runs the server in Docker, with Caddy in front for HTTPS.

```
phone ──HTTPS──▶ Caddy :443 ──▶ spendd container 127.0.0.1:8787 ──▶ /srv/spendd/data (persistent disk)
```

### 1. One-time setup on your Mac

```sh
brew install --cask google-cloud-sdk
gcloud auth login
gcloud config set project YOUR_PROJECT_ID     # from console.cloud.google.com
gcloud services enable compute.googleapis.com
```

### 2. Create the VM

```sh
gcloud compute addresses create spendd-ip --region=asia-south1

gcloud compute instances create spendd \
  --zone=asia-south1-a \
  --machine-type=e2-small \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=20GB \
  --address=spendd-ip \
  --tags=http-server,https-server

gcloud compute firewall-rules create allow-web \
  --allow=tcp:80,tcp:443 --target-tags=http-server,https-server

gcloud compute addresses describe spendd-ip --region=asia-south1 --format='value(address)'
```

Note the IP address. Port 8787 is never opened to the internet; only Caddy talks to it.

`e2-small` (2 GB) is plenty. `e2-micro` is cheaper but tight for password hashing under load.

### 3. Pick a hostname

HTTPS needs a hostname. Either:

- **Your own domain**: add an `A` record such as `api.yourdomain.com` pointing at the IP, or
- **No domain yet**: use `<ip-with-dashes>.sslip.io`, e.g. `34-93-12-7.sslip.io` for `34.93.12.7`.
  It resolves to that IP automatically and gets a real certificate.

### 4. Install Docker and Caddy on the VM

```sh
gcloud compute ssh spendd --zone=asia-south1-a
```

Then, on the VM:

```sh
sudo apt-get update
sudo apt-get install -y docker.io caddy
sudo mkdir -p /srv/spendd/data && sudo chown 1000:1000 /srv/spendd/data   # 1000 = "node" in the container
```

### 5. Copy the server and set its secrets

From your Mac, in the repo root:

```sh
gcloud compute scp --recurse --zone=asia-south1-a \
  server/package.json server/package-lock.json server/Dockerfile server/docker-entrypoint.sh server/.dockerignore server/src \
  spendd:~/spendd-server/
```

On the VM, create the env file (only root can read it):

```sh
sudo tee /srv/spendd/.env >/dev/null <<EOF
GEMINI_API_KEY=your-key
JWT_SECRET=$(openssl rand -hex 32)
TRUST_PROXY=1
EOF
sudo chmod 600 /srv/spendd/.env
```

Keep `JWT_SECRET` the same from now on: changing it signs everyone out.

### 6. Run it

```sh
cd ~/spendd-server
sudo docker build -t spendd-server .
sudo docker run -d --name spendd --restart unless-stopped \
  --env-file /srv/spendd/.env \
  -v /srv/spendd/data:/data \
  -p 127.0.0.1:8787:8787 \
  spendd-server
curl localhost:8787/health          # {"ok":true,...}
```

Point Caddy at it (replace the hostname):

```sh
echo 'api.yourdomain.com {
  reverse_proxy 127.0.0.1:8787
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

From your Mac: `curl https://api.yourdomain.com/health`.

### 7. Point the app at it

In `src/config.ts`:

```ts
const PRODUCTION_API_URL = 'https://api.yourdomain.com';
```

Then build a release APK. Debug builds keep using the server on your Mac.

### 8. Back up accounts

`/srv/spendd/data/users.json` is your user database. Snapshot the disk daily:

```sh
gcloud compute resource-policies create snapshot-schedule spendd-daily \
  --region=asia-south1 --max-retention-days=14 --daily-schedule --start-time=20:00
gcloud compute disks add-resource-policies spendd \
  --zone=asia-south1-a --resource-policies=spendd-daily
```

### Updating

Copy `src` again (step 5), then on the VM:

```sh
cd ~/spendd-server && sudo docker build -t spendd-server . \
  && sudo docker rm -f spendd \
  && sudo docker run -d --name spendd --restart unless-stopped \
       --env-file /srv/spendd/.env -v /srv/spendd/data:/data -p 127.0.0.1:8787:8787 spendd-server
```

Logs: `sudo docker logs -f spendd`.

### Later: Cloud Run

To run on Cloud Run (scales to zero, several instances) instead, accounts first have to move from
`users.json` into a database such as Cloud SQL (Postgres) or Firestore, and the rate limit into
something shared. The Dockerfile already works there; only storage has to change.
