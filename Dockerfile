# Use Python 3.11 slim image
FROM python:3.11-slim

# Install system dependencies required by pdfplumber, Pillow, WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    gcc \
    g++ \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies (without playwright - use weasyprint only)
RUN pip install --no-cache-dir -r backend/requirements.txt

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
