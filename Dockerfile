FROM python:3.10-slim

# Install system dependencies required for Headless Chromium / Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    gnupg \
    git \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn playwright && playwright install chromium

# Copy application files
COPY . .

# HuggingFace Spaces uses port 7860 by default
EXPOSE 7860
ENV PORT=7860

CMD ["python", "server.py"]
