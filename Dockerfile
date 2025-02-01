FROM python:3.11-slim

WORKDIR /app

# Copy backend folder contents
COPY backend/ .

# Install dependencies
RUN pip install -r requirements.txt

# Run app
CMD uvicorn app:app --host 0.0.0.0 --port $PORT