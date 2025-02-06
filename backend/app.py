
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from pathlib import Path
from models import DebateRequest, DebateConfig, Debate, Ranking
from debating import DebateGenerator, judge_debate_llm
from llm import LLM


load_dotenv()

# Initialize the data directory for storing results
DATA_DIR = Path("data")
RESULTS_DIR = DATA_DIR / "debate_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


# FastAPI setup
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Add your production domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


async def run_debate(prompt: str, config: DebateConfig, debate_id: str):
    try:
        # Add detailed logging
        print(f"Starting debate with config: {config}")
        print(f"API Key being used: {debates[debate_id]['api_key'][:5]}...")  # Only log first 5 chars
        
        debate_gen = DebateGenerator(debate_id, config)
        debate_gen.topic_statement = f"Debate topic: {prompt}\n\n"
        
        llm = LLM(api_key=debates[debate_id]["api_key"])  # Make sure API key is passed
        

        print(f"Starting debate {debate_id}")
        yield json.dumps({"type": "start_debate", "message": "Starting debate"})

        for i in range(config.numRounds):
            print(f"Starting round {i + 1}")
            async for item in debate_gen.generate_round(i, llm):
                yield json.dumps(item)
                await asyncio.sleep(0.01)
            await asyncio.sleep(0.5)

        print(f"Debate {debate_id} complete")
        print(f"Saving Debate...")
        
        debates[debate_id]["debate"] = debate_gen.dump()
        yield json.dumps({"type": "debate_complete", "message": "Debate complete"})
    except Exception as e:
        print(f"Error in generate_debate: {str(e)}")
        yield json.dumps({"type": "error", "message": "Error in debate generation"})


debates = {}


from fastapi import Header, HTTPException

@app.post("/api/debate/start")
async def start_debate(request: DebateRequest, api_key: str = Header(None)):
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")
    
    print("Start Debate Received")
    debate_id = str(len(debates) + 1)
    debates[debate_id] = {
        "request": request,
        "api_key": api_key  # Store the API key with the debate
    }
    return {"debate_id": debate_id}

# @app.get("/api/debate/{debate_id}/stream")
# async def stream(debate_id: str):
#     if debate_id not in debates:
#         return {"error": "Debate not found"}

#     debate_request: DebateRequest = debates[debate_id]["request"]
#     generator = run_debate(debate_request.prompt, debate_request.config, debate_id=debate_id)
#     return EventSourceResponse(generator)

from fastapi.responses import StreamingResponse
import asyncio
import json

@app.get("/api/debate/{debate_id}/stream")
async def stream(debate_id: str):
    async def generate():
        try:
            if debate_id not in debates:
                yield "data: " + json.dumps({"type": "error", "message": "Debate not found"}) + "\n\n"
                return

            debate_request: DebateRequest = debates[debate_id]["request"]
            
            # Send initial event
            yield "data: " + json.dumps({"type": "start_debate", "message": "Starting debate"}) + "\n\n"
            await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
            
            async for item in run_debate(debate_request.prompt, debate_request.config, debate_id):
                # Ensure each item is properly formatted and flushed
                data = "data: " + item + "\n\n"
                yield data
                await asyncio.sleep(0.01)  # Small delay between chunks
                
        except Exception as e:
            yield "data: " + json.dumps({'type': 'error', 'message': str(e)}) + "\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked"
        }
    )

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.get("/api/debate/{debate_id}/judge/llm")
async def judge_llm(debate_id: str):
    """
    Evaluate the debate using an LLM, then, download the results.
    """
    if debate_id not in debates:
        return {"error": "Debate not found", "debates": json.dumps(debates), "debate_id": debate_id}
    
    if "debate" not in debates[debate_id]:
        return {"error": "Debate not completed"}
    
    debate: Debate = debates[debate_id]["debate"]
    result = judge_debate_llm(debate)

    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
