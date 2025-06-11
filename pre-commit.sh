#!/bin/bash

# Pre-commit validation script
# Ensures code quality and deployment readiness

set -e

echo "Running pre-commit validations..."

# Check for sensitive files
echo "Checking for sensitive files..."
if [ -f .env ]; then
    echo "WARNING: .env file found. Ensure it's in .gitignore"
fi

# Validate environment template
echo "Validating environment template..."
if [ ! -f .env.example ]; then
    echo "ERROR: .env.example file missing"
    exit 1
fi

# Check TypeScript compilation
echo "Running TypeScript type check..."
npm run check

# Test Docker build
echo "Testing Docker build..."
docker build --target builder -t test-build . --quiet
docker build --target production -t test-production . --quiet

# Clean up test images
docker rmi test-build test-production --force > /dev/null 2>&1

# Validate deployment files
echo "Validating deployment configuration..."
docker-compose config > /dev/null

# Check for required files
required_files=(
    "Dockerfile"
    "docker-compose.yml" 
    "deploy.sh"
    "README.md"
    "DEPLOYMENT.md"
    ".dockerignore"
    ".gitignore"
    "package.json"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "ERROR: Required file $file is missing"
        exit 1
    fi
done

echo "All pre-commit validations passed!"
echo "Ready for GitHub deployment."