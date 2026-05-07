import json
import os
from pathlib import Path
from typing import Any

from openai import OpenAI
from python_http_client.exceptions import HTTPError

# Load environment variables
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Base directory for data
BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "troubleshooting.json"

# Load troubleshooting data
def load_troubleshooting_data() -> dict[str, Any]:
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return {}

def get_troubleshooting_steps(issue_type: str) -> dict[str, Any]:
    data = load_troubleshooting_data()
    issue = data.get(issue_type)
    if not issue:
        return {
            "title": "General Technical Support",
            "steps": [
                "Restart your device and try again.",
                "Check if the issue persists across different applications.",
                "Update your software to the latest version.",
                "Contact technical support if the problem continues."
            ]
        }
    return issue

def classify_issue(message: str) -> str:
    ISSUE_KEYWORDS = {
        "internet_issue": ["wifi", "wi-fi", "internet", "network", "router", "modem", "offline", "connection"],
        "login_issue": ["login", "log in", "signin", "sign in", "password", "username", "account locked", "credential"],
        "slow_system": ["slow", "lag", "lagging", "freeze", "freezing", "performance", "hanging", "sluggish"],
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
    
    normalized_message = message.lower()
    for issue_type, keywords in ISSUE_KEYWORDS.items():
        if any(keyword in normalized_message for keyword in keywords):
            return issue_type
    return "internet_issue"

def build_llm_client() -> OpenAI | None:
    if not GEMINI_API_KEY:
        return None
    return OpenAI(
        api_key=GEMINI_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )

def generate_llm_response(message: str, fallback_issue_type: str) -> dict[str, Any]:
    client = build_llm_client()
    if not client:
        # Fallback to rule-based response
        issue_type = classify_issue(message)
        issue = get_troubleshooting_steps(issue_type)
        steps = "\n".join(f"{index}. {step}" for index, step in enumerate(issue["steps"], start=1))
        response_text = f"I found a likely match: {issue['title']}.\n\nTry these steps:\n{steps}\n\nIf the problem still continues after these steps, share what changed and I can narrow it down further."
        
        return {
            "response": response_text.strip(),
            "issue_type": issue_type,
            "used_llm": False,
            "model_used": "Rule-based",
            "tool_called": False,
        }

    try:
        tool_spec = [
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

        # First pass: Identify issue type
        tool_prompt = (
            "You are SupportFix AI, an intelligent troubleshooting assistant. "
            "Identify the most likely issue type from the user's message, call the tool "
            "`get_troubleshooting_steps`, and choose the best matching issue type."
        )

        completion = client.chat.completions.create(
            model=GEMINI_MODEL,
            messages=[
                {"role": "system", "content": tool_prompt},
                {"role": "user", "content": message},
            ],
            tools=tool_spec,
            tool_choice="auto",
        )

        assistant_message = completion.choices[0].message
        tool_calls = assistant_message.tool_calls or []

        if not tool_calls:
            # Fallback to classification
            issue_type = classify_issue(message)
        else:
            tool_call = tool_calls[0]
            try:
                arguments = json.loads(tool_call.function.arguments or "{}")
                issue_type = arguments.get("issue_type", fallback_issue_type)
            except json.JSONDecodeError:
                issue_type = fallback_issue_type

        issue = get_troubleshooting_steps(issue_type)

        # Second pass: Generate response
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

        second_completion = client.chat.completions.create(
            model=GEMINI_MODEL,
            messages=[
                {"role": "system", "content": final_response_prompt},
                {
                    "role": "user",
                    "content": f"Create the final troubleshooting response using this data:\n{json.dumps(formatted_issue_payload, indent=2)}",
                },
            ],
        )

        response_text = second_completion.choices[0].message.content
        if not response_text or not response_text.strip():
            # Fallback response
            steps = "\n".join(f"{index}. {step}" for index, step in enumerate(issue["steps"], start=1))
            response_text = f"I found a likely match: {issue['title']}.\n\nTry these steps:\n{steps}\n\nIf the problem still continues after these steps, share what changed and I can narrow it down further."

        return {
            "response": response_text.strip(),
            "issue_type": issue_type,
            "used_llm": True,
            "model_used": GEMINI_MODEL,
            "tool_called": bool(tool_calls),
        }

    except Exception as e:
        # Fallback to rule-based response
        issue_type = classify_issue(message)
        issue = get_troubleshooting_steps(issue_type)
        steps = "\n".join(f"{index}. {step}" for index, step in enumerate(issue["steps"], start=1))
        response_text = f"I found a likely match: {issue['title']}.\n\nTry these steps:\n{steps}\n\nIf the problem still continues after these steps, share what changed and I can narrow it down further."
        
        return {
            "response": response_text.strip(),
            "issue_type": issue_type,
            "used_llm": False,
            "model_used": "Rule-based fallback",
            "tool_called": False,
        }

def handler(request):
    # Handle CORS
    if request.method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": ""
        }

    if request.method == "POST":
        try:
            body = json.loads(request.body)
            message = body.get("message", "").strip()
            
            if not message:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Content-Type": "application/json",
                    },
                    "body": json.dumps({"detail": "Message cannot be empty."})
                }

            initial_issue_type = classify_issue(message)
            llm_result = generate_llm_response(message, initial_issue_type)

            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                "body": json.dumps({
                    "response": llm_result["response"],
                    "issue_type": llm_result["issue_type"],
                    "used_llm": llm_result["used_llm"],
                    "model_used": llm_result["model_used"],
                    "tool_called": llm_result["tool_called"],
                })
            }

        except Exception as e:
            return {
                "statusCode": 500,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                "body": json.dumps({"detail": f"Internal server error: {str(e)}"})
            }

    return {
        "statusCode": 405,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        "body": json.dumps({"detail": "Method not allowed."})
    }

# Vercel serverless function entry point
def handler_vercel(request):
    return handler(request)
