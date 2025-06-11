# GitHub Repository Setup Guide

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" button in the top right corner
3. Select "New repository"
4. Fill in the repository details:
   - **Repository name**: `agentic-rag-platform`
   - **Description**: `Advanced multi-jurisdictional AI regulatory analysis platform with intelligent document processing`
   - **Visibility**: Choose Public or Private as needed
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

## Step 2: Configure GitHub Secrets

After creating the repository, set up the required secrets for automated deployment:

### Navigate to Repository Settings
1. Go to your repository on GitHub
2. Click "Settings" tab
3. In the left sidebar, click "Secrets and variables" → "Actions"

### Required Secrets for CI/CD

Add these secrets by clicking "New repository secret":

**Docker Hub Configuration:**
- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password or access token

**Production Server (if deploying to your own server):**
- `PRODUCTION_HOST`: Your production server IP address
- `PRODUCTION_USERNAME`: SSH username for production server
- `PRODUCTION_SSH_KEY`: Private SSH key for production server access
- `PRODUCTION_URL`: Your production domain (e.g., https://yourdomain.com)

**Staging Server (optional):**
- `STAGING_HOST`: Your staging server IP address
- `STAGING_USERNAME`: SSH username for staging server
- `STAGING_SSH_KEY`: Private SSH key for staging server access
- `STAGING_URL`: Your staging domain (e.g., https://staging.yourdomain.com)

**Notifications (optional):**
- `SLACK_WEBHOOK_URL`: Slack webhook for deployment notifications

## Step 3: Upload Your Code

Since you already have all the files ready, you'll need to manually upload them:

### Option A: GitHub Web Interface
1. In your empty repository, click "uploading an existing file"
2. Drag and drop all project files or use the file chooser
3. Write a commit message: "Initial commit: Agentic RAG platform with enterprise deployment"
4. Click "Commit changes"

### Option B: GitHub CLI (if you have it installed)
```bash
gh repo clone YOUR_USERNAME/agentic-rag-platform
cd agentic-rag-platform
# Copy all your project files here
gh auth login
git add .
git commit -m "Initial commit: Agentic RAG platform"
git push origin main
```

### Option C: Manual Git Commands
```bash
# In your project directory
git remote add origin https://github.com/YOUR_USERNAME/agentic-rag-platform.git
git branch -M main
git add .
git commit -m "Initial commit: Agentic RAG platform with enterprise deployment"
git push -u origin main
```

## Step 4: Set up Docker Hub Repository

1. Go to [Docker Hub](https://hub.docker.com/)
2. Sign in or create an account
3. Click "Create Repository"
4. Name it: `agentic-rag`
5. Set visibility (public recommended for easier deployment)
6. Click "Create"

## Step 5: Configure Environment Variables

### For Local Development
```bash
cp .env.example .env
# Edit .env with your actual values
```

### For Production Deployment
Create these files on your production server:
- `.env` - Production environment variables
- `.env.staging` - Staging environment variables (if using staging)

## Step 6: Test the CI/CD Pipeline

Once your code is on GitHub:

1. **Automatic Trigger**: Push to `main` branch triggers production deployment
2. **Manual Trigger**: Push to `develop` branch triggers staging deployment
3. **Pull Requests**: Automatically run tests and security scans

## Step 7: Deploy Locally First

Before pushing to GitHub, test locally:

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run local deployment
./deploy.sh
```

This will:
- Validate your environment configuration
- Build and start all services
- Run database migrations
- Perform health checks

## Step 8: Monitor Deployment

### GitHub Actions
- Go to "Actions" tab in your repository
- Monitor build and deployment progress
- Check logs if any issues occur

### Application Health
- Local: http://localhost:5000/api/health
- Production: https://yourdomain.com/api/health

## Troubleshooting

### Common Issues

**Docker Hub Authentication:**
- Ensure Docker Hub credentials are correct in GitHub secrets
- Use access tokens instead of passwords for better security

**Server Access:**
- Verify SSH key has proper permissions (chmod 600)
- Ensure server has Docker and Docker Compose installed
- Check firewall settings allow connections on port 5000

**Environment Variables:**
- Validate all required variables are set
- Check OpenAI API key format (starts with sk-)
- Ensure database URL is correctly formatted

### Support Commands

**View deployment logs:**
```bash
docker-compose logs -f
```

**Check service status:**
```bash
docker-compose ps
```

**Restart services:**
```bash
docker-compose restart
```

**Update deployment:**
```bash
git pull origin main
docker-compose up -d --build
```

Your Agentic RAG platform is now ready for professional deployment with enterprise-grade CI/CD, monitoring, and scaling capabilities.