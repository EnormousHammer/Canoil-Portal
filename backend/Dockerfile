FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including Playwright dependencies)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (for PDF generation)
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p cache uploads/logistics so_cache gmail_credentials templates

# Environment variables (will be overridden by Cloud Run)
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV USE_GOOGLE_DRIVE_API=true
ENV FLASK_ENV=production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Run application with Hypercorn for HTTP/2 support (removes 32MB limit)
# Local development still uses Flask's server (app.run in app.py)
CMD ["python", "start_hypercorn.py"]

