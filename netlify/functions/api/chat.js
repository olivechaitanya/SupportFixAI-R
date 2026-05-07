const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Troubleshooting data
const troubleshootingData = {
  "internet_issue": {
    "title": "Internet Connection Problem",
    "steps": [
      "Check whether your router and modem are powered on and all status lights look normal.",
      "Restart the router and modem by unplugging them for 30 seconds, then plug them back in.",
      "Make sure Wi-Fi is enabled on your device and reconnect to the correct network.",
      "Test another website or app to confirm whether the issue is with the internet or one specific service.",
      "Move closer to the router or remove obstacles that may weaken the wireless signal.",
      "If the issue continues on all devices, contact your internet service provider."
    ]
  },
  "login_issue": {
    "title": "Login or Password Problem",
    "steps": [
      "Confirm that the username or email address is typed correctly.",
      "Check that Caps Lock is off and re-enter the password carefully.",
      "Use the password reset option if you cannot remember your credentials.",
      "Clear browser cache and cookies if the login page keeps rejecting valid credentials.",
      "Try logging in from another browser or device to rule out a browser-specific issue.",
      "If your account is locked, contact the administrator or support team."
    ]
  },
  "slow_system": {
    "title": "Slow Computer or System Performance",
    "steps": [
      "Close unnecessary apps and browser tabs that may be consuming memory or CPU.",
      "Restart the system to clear temporary processes and free up resources.",
      "Check available disk space and remove unused files if storage is almost full.",
      "Run a malware or antivirus scan to detect harmful software affecting performance.",
      "Install pending system and driver updates.",
      "If the system remains slow, review startup apps and disable non-essential ones."
    ]
  }
};

function classifyIssue(message) {
  const ISSUE_KEYWORDS = {
    "internet_issue": ["wifi", "wi-fi", "internet", "network", "router", "modem", "offline", "connection"],
    "login_issue": ["login", "log in", "signin", "sign in", "password", "username", "account locked", "credential"],
    "slow_system": ["slow", "lag", "lagging", "freeze", "freezing", "performance", "hanging", "sluggish"]
  };
  
  const normalizedMessage = message.toLowerCase();
  for (const [issueType, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    if (keywords.some(keyword => normalizedMessage.includes(keyword))) {
      return issueType;
    }
  }
  return "internet_issue";
}

async function generateLLMResponse(message, fallbackIssueType) {
  if (!GEMINI_API_KEY) {
    // Fallback to rule-based response
    const issueType = classifyIssue(message);
    const issue = troubleshootingData[issueType];
    const steps = issue.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
    const responseText = `I found a likely match: ${issue.title}.\n\nTry these steps:\n${steps}\n\nIf the problem still continues after these steps, share what changed and I can narrow it down further.`;
    
    return {
      response: responseText.trim(),
      issueType: issueType,
      used_llm: false,
      model_used: "Rule-based",
      tool_called: false,
    };
  }

  try {
    const toolSpec = [
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
    ];

    // First pass: Identify issue type
    const toolPrompt = (
      "You are SupportFix AI, an intelligent troubleshooting assistant. " +
      "Identify the most likely issue type from the user's message, call the tool " +
      "`get_troubleshooting_steps`, and choose the best matching issue type."
    );

    const completion = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages: [
          {"role": "system", "content": toolPrompt},
          {"role": "user", "content": message},
        ],
        tools: toolSpec,
        tool_choice: "auto",
      }),
    });

    const data = await completion.json();
    const assistantMessage = data.choices[0].message;
    const toolCalls = assistantMessage.tool_calls || [];

    let issueType = fallbackIssueType;
    if (toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      try {
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        issueType = toolArgs.issue_type || fallbackIssueType;
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }

    const issue = troubleshootingData[issueType] || troubleshootingData[fallbackIssueType];

    // Second pass: Generate response
    const finalResponsePrompt = (
      "You are SupportFix AI. Write the final troubleshooting answer for the user. " +
      "Use a short friendly intro, then a numbered step-by-step list, and finish with one concise follow-up sentence. " +
      "Do not mention JSON, tool calls, or internal system details."
    );

    const formattedIssuePayload = {
      user_message: message,
      issue_type: issueType,
      issue_title: issue.title,
      steps: issue.steps,
    };

    const secondCompletion = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages: [
          {"role": "system", "content": finalResponsePrompt},
          {
            "role": "user",
            "content": `Create the final troubleshooting response using this data:\n${JSON.stringify(formattedIssuePayload, null, 2)}`,
          },
        ],
      }),
    });

    const secondData = await secondCompletion.json();
    let responseText = secondData.choices[0].message.content;
    
    if (!responseText || !responseText.trim()) {
      // Fallback response
      const steps = issue.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
      responseText = `I found a likely match: ${issue.title}.\n\nTry these steps:\n${steps}\n\nIf the problem still continues after these steps, share what changed and I can narrow it down further.`;
    }

    return {
      response: responseText.trim(),
      issue_type: issueType,
      used_llm: true,
      model_used: GEMINI_MODEL,
      tool_called: toolCalls.length > 0,
    };

  } catch (error) {
    console.error("LLM Error:", error);
    // Fallback to rule-based response
    const issueType = classifyIssue(message);
    const issue = troubleshootingData[issueType];
    const steps = issue.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
    const responseText = `I found a likely match: ${issue.title}.\n\nTry these steps:\n${steps}\n\nIf the problem still continues after these steps, share what changed and I can narrow it down further.`;
    
    return {
      response: responseText.trim(),
      issue_type: issueType,
      used_llm: false,
      model_used: "Rule-based fallback",
      tool_called: false,
    };
  }
}

exports.handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      const message = body.message?.trim();
      
      if (!message) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({detail: "Message cannot be empty."})
        };
      }

      const initialIssueType = classifyIssue(message);
      const llmResult = await generateLLMResponse(message, initialIssueType);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response: llmResult.response,
          issue_type: llmResult.issue_type,
          used_llm: llmResult.used_llm,
          model_used: llmResult.model_used,
          tool_called: llmResult.tool_called,
        })
      };

    } catch (error) {
      console.error("Handler Error:", error);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({detail: `Internal server error: ${error.message}`})
      };
    }
  }

  return {
    statusCode: 405,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({detail: "Method not allowed."})
  };
};
