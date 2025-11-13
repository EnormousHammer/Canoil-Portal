# Use Python 3.11 slim image
FROM python:3.11-slim

# Install system dependencies required by pdfplumber, Pillow, and other packages
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
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the entire backend directory
COPY backend /app/backend

# Set working directory to backend
WORKDIR /app/backend

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8

# Expose port
EXPOSE 10000

# Start the application  
# Use 1 worker so cache persists in memory between requests
# Timeout 900s (15 min) to allow Google Drive initial scan to complete
CMD ["sh", "-c", "echo 'Starting Gunicorn on port' $PORT && gunicorn app:app --bind 0.0.0.0:$PORT --timeout 900 --workers 1 --log-level debug"]

