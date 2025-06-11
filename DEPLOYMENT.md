# Deployment Guide

This guide walks you through deploying the Agentic RAG platform to GitHub and Docker.

## Step 1: GitHub Repository Setup

### 1.1 Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and click "New repository"
2. Name it `agentic-rag-platform` 
3. Set to Public or Private as needed
4. Don't initialize with README (we already have one)
5. Click "Create repository"

### 1.2 Push Code to GitHub

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Agentic RAG platform"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/agentic-rag-platform.git

# Push to GitHub
git push -u origin main
```

## Step 2: Docker Hub Setup

### 2.1 Create Docker Hub Account

1. Go to [Docker Hub](https://hub.docker.com/)
2. Create an account or sign in
3. Create a new repository named `agentic-rag`

### 2.2 Local Docker Testing

```bash
# Build the Docker image locally
docker build -t agentic-rag .

# Test the image with environment variables
docker run -p 5000:5000 \
  -e DATABASE_URL="your_database_url" \
  -e OPENAI_API_KEY="your_openai_key" \
  agentic-rag
```

## Step 3: Environment Configuration

### 3.1 Create Production Environment File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:
```env
DATABASE_URL=postgresql://username:password@postgres:5432/agentic_rag
OPENAI_API_KEY=sk-your-actual-openai-key
NODE_ENV=production
PORT=5000
POSTGRES_PASSWORD=your-secure-database-password
```

### 3.2 GitHub Secrets Setup

In your GitHub repository, go to Settings > Secrets and Variables > Actions, then add:

- `DOCKER_USERNAME` - Your Docker Hub username
- `DOCKER_PASSWORD` - Your Docker Hub password/token
- `HOST` - Your production server IP address
- `USERNAME` - SSH username for your server
- `SSH_KEY` - Private SSH key for server access

## Step 4: Production Deployment Options

### Option A: Docker Compose (Recommended)

```bash
# Clone repository on your server
git clone https://github.com/YOUR_USERNAME/agentic-rag-platform.git
cd agentic-rag-platform

# Copy and configure environment
cp .env.example .env
# Edit .env with your production values

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option B: Manual Docker Deployment

```bash
# Pull the image
docker pull your-username/agentic-rag:latest

# Run with external PostgreSQL
docker run -d \
  --name agentic-rag \
  -p 5000:5000 \
  -e DATABASE_URL="your_external_db_url" \
  -e OPENAI_API_KEY="your_openai_key" \
  --restart unless-stopped \
  your-username/agentic-rag:latest
```

### Option C: Cloud Platform Deployment

#### Render.com
1. Connect your GitHub repository
2. Create a new Web Service
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables in Render dashboard

#### Railway.app
1. Connect GitHub repository
2. Add PostgreSQL service
3. Configure environment variables
4. Deploy automatically on git push

#### DigitalOcean App Platform
1. Create new app from GitHub
2. Configure build/run commands
3. Add managed PostgreSQL database
4. Set environment variables

## Step 5: Database Migration

After deployment, initialize the database:

```bash
# If using docker-compose
docker-compose exec app npm run db:push

# If using standalone Docker
docker exec agentic-rag npm run db:push
```

## Step 6: Monitoring and Maintenance

### Health Checks

```bash
# Check application status
curl http://your-domain:5000/api/health

# Check database connection
curl http://your-domain:5000/api/agents
```

### Log Monitoring

```bash
# Docker Compose logs
docker-compose logs -f app

# Standalone Docker logs
docker logs -f agentic-rag
```

### Backup Strategy

```bash
# Database backup
docker-compose exec postgres pg_dump -U postgres agentic_rag > backup.sql

# Restore database
docker-compose exec -i postgres psql -U postgres agentic_rag < backup.sql
```

## Step 7: SSL/HTTPS Setup

### Using nginx reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure port 5000 is available
2. **Database connection**: Verify DATABASE_URL format
3. **Memory issues**: Increase Docker memory limits for large document processing
4. **API rate limits**: Monitor OpenAI API usage

### Debug Commands

```bash
# Check container status
docker ps

# Inspect container
docker inspect agentic-rag

# Execute shell in container
docker exec -it agentic-rag sh

# Check environment variables
docker exec agentic-rag env
```

This completes the deployment setup. Your Agentic RAG platform should now be running in production with proper CI/CD pipeline through GitHub Actions.