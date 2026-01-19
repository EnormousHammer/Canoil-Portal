# Use Python 3.11 slim image
FROM python:3.11-slim

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpoppler-cpp-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies
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
ENV RENDER=true

# Expose port
EXPOSE 10000

# Start the application
CMD ["sh", "-c", "cd /app/backend && python start_hypercorn.py"]
