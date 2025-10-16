# Use a slim Python image as a base
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Update package lists and install necessary system libraries
# FIX: Added ffmpeg for audio conversion with pydub
RUN apt-get update && apt-get install -y libgomp1 ffmpeg

# Copy the requirements file and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Set the entrypoint script as the startup command
ENTRYPOINT ["./entrypoint.sh"]