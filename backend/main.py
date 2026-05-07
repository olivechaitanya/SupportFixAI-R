import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "troubleshooting.json"

app = FastAPI(title="SupportFix AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    issue_type: str
    used_llm: bool
    model_used: str
    tool_called: bool


TOOL_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "get_troubleshooting_steps",
            "description": "Fetch troubleshooting steps for a known issue type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_type": {
                        "type": "string",
                        "description": "Known issue type such as internet_issue, login_issue, or slow_system.",
                    }
                },
                "required": ["issue_type"],
            },
        },
    }
]

ISSUE_KEYWORDS = {
    "internet_issue": [
        "wifi",
        "wi-fi",
        "internet",
        "network",
        "router",
        "modem",
        "offline",
        "connection",
    ],
    "login_issue": [
        "login",
        "log in",
        "signin",
        "sign in",
        "password",
        "username",
        "account locked",
        "credential",
    ],
    "slow_system": [
        "slow",
        "lag",
        "lagging",
        "freeze",
        "freezing",
        "performance",
        "hanging",
        "sluggish",
    ],
    "printer_issue": ["printer", "printing", "print job", "paper jam", "toner", "ink"],
    "email_issue": ["email", "mailbox", "outlook", "gmail", "inbox", "send mail"],
    "audio_issue": ["audio", "sound", "speaker", "volume", "microphone", "headphone"],
    "display_issue": ["screen", "display", "monitor", "flicker", "black screen", "resolution"],
    "battery_issue": ["battery", "charging", "charger", "power adapter", "drains fast"],
    "bluetooth_issue": ["bluetooth", "pairing", "wireless headset", "wireless mouse"],
    "update_issue": ["update", "upgrade", "patch", "install update", "windows update"],
    "storage_issue": ["storage", "disk full", "space", "low storage", "drive full"],
    "browser_issue": ["browser", "chrome", "edge", "firefox", "website", "tab crash"],
    "vpn_issue": ["vpn", "remote access", "secure tunnel", "cannot connect vpn"],
    "security_alert": ["virus", "malware", "security", "hacked", "phishing", "suspicious"],
    "app_crash": ["app crash", "application crash", "stopped working", "not responding", "crash"],
    "webcam_issue": ["camera", "webcam", "video call", "zoom camera", "teams camera"],
    "keyboard_issue": ["keyboard", "keys not working", "typing issue", "cannot type"],
    "network_drive_issue": ["shared drive", "network drive", "mapped drive", "file share"],
}


@lru_cache
def load_troubleshooting_data() -> dict[str, Any]:
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_troubleshooting_steps(issue_type: str) -> dict[str, Any]:
    data = load_troubleshooting_data()
    issue = data.get(issue_type)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Unknown issue type: {issue_type}")
    return issue


def classify_issue(message: str) -> str:
    normalized_message = message.lower()
    for issue_type, keywords in ISSUE_KEYWORDS.items():
        if any(keyword in normalized_message for keyword in keywords):
            return issue_type
    return "internet_issue"


def format_troubleshooting_response(issue_type: str, issue: dict[str, Any]) -> str:
    steps = "\n".join(f"{index}. {step}" for index, step in enumerate(issue["steps"], start=1))
    return (
        f"I found a likely match: {issue['title']}.\n\n"
        f"Try these steps:\n{steps}\n\n"
        "If the problem still continues after these steps, share what changed and I can narrow it down further."
    )


def build_llm_client() -> OpenAI | None:
    if not os.getenv("GEMINI_API_KEY"):
        return None

    return OpenAI(
        api_key=os.getenv("GEMINI_API_KEY"),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )


def get_gemini_model_candidates() -> list[str]:
    configured_model = os.getenv("GEMINI_MODEL", "").strip()
    candidate_models = [
        configured_model,
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-pro",
        "gemini-3-flash-preview",
    ]
    return [model for index, model in enumerate(candidate_models) if model and model not in candidate_models[:index]]


def create_gemini_completion(
    client: OpenAI,
    messages: list[dict[str, Any]],
    error_message: str,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | None = None,
) -> tuple[Any, str]:
    last_error = None

    for model in get_gemini_model_candidates():
        try:
            request_payload: dict[str, Any] = {"model": model, "messages": messages}
            if tools is not None:
                request_payload["tools"] = tools
            if tool_choice is not None:
                request_payload["tool_choice"] = tool_choice

            completion = client.chat.completions.create(**request_payload)
            return completion, model
        except Exception as exc:
            last_error = {"model": model, "error": str(exc)}
            logger.warning("Gemini model %s failed, trying next fallback: %s", model, exc)

    logger.error(error_message)
    raise HTTPException(
        status_code=502,
        detail={
            "message": error_message,
            "provider_error": last_error,
        },
    )


def generate_llm_response(message: str, fallback_issue_type: str) -> dict[str, Any]:
    client = build_llm_client()
    if not client:
        raise HTTPException(status_code=503, detail="Gemini is not configured. Set GEMINI_API_KEY first.")

    tool_prompt = (
        "You are SupportFix AI, an intelligent troubleshooting assistant. "
        "Identify the most likely issue type from the user's message, call the tool "
        "`get_troubleshooting_steps`, and choose the best matching issue type."
    )

    first_pass, first_pass_model = create_gemini_completion(
        client=client,
        messages=[
            {"role": "system", "content": tool_prompt},
            {"role": "user", "content": message},
        ],
        error_message="Gemini failed while identifying the issue type.",
        tools=TOOL_SPEC,
        tool_choice="auto",
    )

    assistant_message = first_pass.choices[0].message
    tool_calls = assistant_message.tool_calls or []

    if not tool_calls:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Gemini did not return a tool call, so no troubleshooting response was generated.",
                "provider_error": "No tool call returned from Gemini.",
            },
        )

    tool_call = tool_calls[0]
    try:
        arguments = json.loads(tool_call.function.arguments or "{}")
    except json.JSONDecodeError:
        logger.warning("Tool arguments were not valid JSON, using fallback issue type.")
        arguments = {}
    issue_type = arguments.get("issue_type", fallback_issue_type)

    try:
        issue = get_troubleshooting_steps(issue_type)
    except HTTPException:
        issue_type = fallback_issue_type
        issue = get_troubleshooting_steps(issue_type)

    final_response_prompt = (
        "You are SupportFix AI. Write the final troubleshooting answer for the user. "
        "Use a short friendly intro, then a numbered step-by-step list, and finish with one concise follow-up sentence. "
        "Do not mention JSON, tool calls, or internal system details."
    )

    formatted_issue_payload = {
        "user_message": message,
        "issue_type": issue_type,
        "issue_title": issue["title"],
        "steps": issue["steps"],
    }

    second_pass, second_pass_model = create_gemini_completion(
        client=client,
        messages=[
            {"role": "system", "content": final_response_prompt},
            {
                "role": "user",
                "content": (
                    "Create the final troubleshooting response using this data:\n"
                    f"{json.dumps(formatted_issue_payload, indent=2)}"
                ),
            },
        ],
        error_message="Gemini failed while generating the final troubleshooting response.",
    )

    response_text = second_pass.choices[0].message.content
    if not response_text or not response_text.strip():
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Gemini returned an empty final troubleshooting response.",
                "provider_error": {
                    "model": second_pass_model,
                    "error": "No text content returned from Gemini.",
                },
            },
        )

    return {
        "response": response_text.strip(),
        "issue_type": issue_type,
        "used_llm": True,
        "model_used": second_pass_model,
        "tool_called": bool(tool_calls),
        "tool_model_used": first_pass_model,
    }


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "SupportFix AI backend is running."}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    initial_issue_type = classify_issue(message)
    llm_result = generate_llm_response(message, initial_issue_type)

    return ChatResponse(
        response=llm_result["response"],
        issue_type=llm_result["issue_type"],
        used_llm=llm_result["used_llm"],
        model_used=llm_result["model_used"],
        tool_called=llm_result["tool_called"],
    )
