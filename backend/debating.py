from typing import List, Dict
import asyncio
from models import DebateConfig, Debate, Score, Ranking, DebateScoreRequest, DebateScore, DebaterMessage
from llm import LLM
import os
import json

with open(os.path.join(os.getcwd(),"backend/prompt.json"), "r+") as f:
    prompt_dict: dict[str, str] = json.load(f)


class DebateGenerator:
    def __init__(self, debate_id: str, config: DebateConfig):
        self.debate_id = debate_id
        self.config = config
        self.topic_statement = ""
        self.debate_history = []

    def dump(self) -> Debate:
        return Debate(debateId=self.debate_id, config=self.config, topicStatement=self.topic_statement, debateHistory=self.debate_history)

    async def generate_prompt(self, prompt: str, context: List[Dict], llm: LLM):
        try:
            stream = llm.generate(
                query=prompt,
                context=context,
                model="gpt-4o",
                stream=True,
                max_tokens=self.config.maxTokensPerResponse,
                temperature=self.config.temperature,
                presence_penalty=0.6,
                frequency_penalty=0.6,
            )
            
            collected_message = ""
            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    collected_message += token
                    yield {"message": token, "type": "token"}
                    
            if collected_message:
                yield {"message": "", "type": "token_end"}
                    
        except Exception as e:
            print(f"Error in generate_prompt: {str(e)}")
            yield {"message": "Error generating response", "type": "error"}

    async def generate_message(self, message: str, context: List[Dict], message_num: int, llm: LLM):
        try:
            yield {"type": "message_start", "message": f"Response {message_num + 1}"}
            
            async for token in self.generate_prompt(message, context, llm):
                yield token
                await asyncio.sleep(0.01)
                    
            yield {"type": "message_complete", "message": f"Message {message_num + 1} complete"}
                
        except Exception as e:
            print(f"Error in generate_message: {str(e)}")
            yield {"type": "error", "message": "Failed to generate message"}

    async def generate_round(self, round_num: int, llm: LLM):
        try:
            yield {"type": "round_start", "message": f"Round {round_num + 1}"}
            
            for debater_num in range(self.config.numDebaters):
                system_prompt = self.config.systemPrompts[debater_num]
                context = [{"role": "system", "content": system_prompt.content}]
                
                prompt = prompt_dict["debater"]["prompt"].format(topic_statement=self.topic_statement, round_num=round_num+1, debater_num=debater_num+1)
                
                response = ""
                async for token in self.generate_message(prompt, context, debater_num + 1, llm):
                    if token["type"] == "token":
                        response += token["message"]
                    yield token
                    await asyncio.sleep(0.01)

                self.debate_history.append({"debater": debater_num+1, "round_num":round_num+1, "response": response})
                self.topic_statement += f"Debater {debater_num + 1}: {response}\n"

                if debater_num < self.config.numDebaters - 1:
                    await asyncio.sleep(0.5)

            yield {"type": "round_complete", "message": f"Round {round_num + 1} complete"}
                
        except Exception as e:
            print(f"Error in generate_round: {str(e)}")
            yield {"type": "error", "message": "Failed to complete round"}


def judge_debate_llm(debate: Debate):
    # LLM
    llm = LLM()

    # Prepare debate as string
    messages = ""
    for message in debate.debateHistory:
        messages += f"Debater: {message['debater']}\n"
        messages += f"{message['response']}\n\n"
    
    print(f"Debate Messages Len: {len(messages)}")

    # Perform Scoring
    system_prompt = prompt_dict["judge"]["system_prompt"]
    score_prompt = prompt_dict["judge"]["score_prompt"]
    ranking_prompt = prompt_dict["judge"]["ranking_prompt"]

    scores = []
    history = []

    for debater_id in range(1, debate.config.numDebaters+1):
        query = score_prompt.format(debate_topic=debate.topicStatement, messages=messages, i=debater_id)
        res = llm.generate_structured(
            query=query,
            context=[{"role": "system", "content": system_prompt}],
            response_format=Score
        )
        print(type(res.choices[0].message.parsed))
        print("Scored: ", res.choices[0].message.parsed)
        scores.append(res.choices[0].message.parsed)

        history.append({"role": "user", "content": query})
        history.append({"role": "assistant", "content": str(res.choices[0].message.parsed)})
    
    # generate ranking
    query = ranking_prompt.format(debate_topic=debate.topicStatement)
    res = llm.generate_structured(
        query=query,
        context=[{"role": "system", "content": system_prompt}, *history],
        response_format=Ranking
    )
    ranking = res.choices[0].message.parsed



    
