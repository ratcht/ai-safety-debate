from openai import OpenAI
from typing import List, Dict, AsyncGenerator
from pydantic import BaseModel
import os

class LLM:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def generate(self, query: str, context: list[dict], model="gpt-4o", **kwargs):
        res = self.client.chat.completions.create(
                    model=model,
                    messages=[*context, {"role": "user", "content": query}],
                    **kwargs
                )
        return res 
    
    def generate_structured(self, query: str, context: list[dict], response_format: BaseModel, model="gpt-4o-2024-08-06", **kwargs):
        res = self.client.beta.chat.completions.parse(
                    model=model,
                    messages=[*context, {"role": "user", "content": query}],
                    response_format=response_format,
                    **kwargs
                )
        return res 

