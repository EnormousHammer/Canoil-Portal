# Use Python 3.11 slim image
FROM python:3.11-slim

# Install system dependencies required by pdfplumber, Pillow, Playwright, WeasyPrint
RUN apt-get update && apt-get install -y \
    libpoppler-cpp-dev \
    poppler-utils \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libwebp-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    tcl-dev \
    tk-dev \
    gcc \
    g++ \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    # Playwright dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Install Playwright browsers (Chromium only for smaller image)
RUN playwright install chromium --with-deps || echo "Playwright browser install failed - will use WeasyPrint fallback"

# Copy the entire backend directory
COPY backend /app/backend

# Create uploads directory for logistics automation
RUN mkdir -p /app/backend/uploads/logistics && chmod 777 /app/backend/uploads/logistics

# Set working directory to backend
WORKDIR /app/backend

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8
# Tell Render this is a cloud environment (skip G: Drive checks)
ENV RENDER=true

# Expose port (Render sets PORT via environment variable, default 10000)
EXPOSE 10000

# Start the application with Hypercorn (supports HTTP/2)
CMD ["sh", "-c", "cd /app/backend && python start_hypercorn.py"]
