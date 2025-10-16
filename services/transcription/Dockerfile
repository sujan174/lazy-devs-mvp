# Use a slim Python image as a base
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Update package lists and install necessary system libraries
# Added: gcc, g++, make, portaudio19-dev, python3-dev for PyAudio compilation
RUN apt-get update && apt-get install -y \
    libgomp1 \
    ffmpeg \
    gcc \
    g++ \
    make \
    portaudio19-dev \
    python3-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install Python dependencies
COPY requirements.txt .

# Install PyTorch for CPU first, as it's a large dependency
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install the rest of the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Set the entrypoint script as the startup command for the container
ENTRYPOINT ["./entrypoint.sh"]