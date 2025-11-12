#!/bin/bash
# Install system dependencies for PDF and image processing
echo "Installing system dependencies..."

# Update package list
sudo apt-get update

# Install system packages needed by Python libraries
sudo apt-get install -y \
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
    tk-dev

echo "System dependencies installed successfully"

# Install Python dependencies
cd backend
pip install -r requirements.txt

echo "Build complete!"

