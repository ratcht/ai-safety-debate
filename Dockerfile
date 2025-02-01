FROM python:3.11-slim

WORKDIR /app

# Copy backend folder contents
COPY backend/ .

# Install dependencies
RUN pip install -r requirements.txt

# Fix prompt.json path in debating.py
RUN sed -i 's|os.path.join(os.getcwd(),"backend/prompt.json")|"prompt.json"|' debating.py

# Run app
CMD uvicorn app:app --host 0.0.0.0 --port $PORT