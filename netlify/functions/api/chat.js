exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ detail: "Method not allowed." })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const message = body.message?.trim();
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: "Message cannot be empty." })
      };
    }

    // Simple rule-based responses for now
    const responses = {
      "wifi": "I can help with WiFi issues! Try these steps: 1. Check if router is powered on 2. Restart router by unplugging for 30 seconds 3. Check if WiFi is enabled on your device 4. Move closer to router 5. Contact your ISP if issue persists.",
      "internet": "For internet issues: 1. Check router/modem lights 2. Restart both devices 3. Test different websites 4. Check if other devices have internet 5. Call your internet provider if needed.",
      "password": "For password issues: 1. Check Caps Lock is off 2. Use password reset option 3. Clear browser cache 4. Try different browser 5. Contact support if account is locked.",
      "slow": "For slow performance: 1. Close unnecessary apps 2. Restart your computer 3. Check disk space 4. Run antivirus scan 5. Update system and drivers.",
      "printer": "For printer issues: 1. Check power and connections 2. Look for paper jams 3. Check ink/toner levels 4. Set as default printer 5. Update printer drivers.",
      "default": "I'm here to help! Please describe your technical issue in more detail, such as: WiFi not working, forgot password, computer is slow, printer won't print, etc."
    };

    const lowerMessage = message.toLowerCase();
    let response = responses.default;
    
    // Check for keywords
    if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi') || lowerMessage.includes('network')) {
      response = responses.wifi;
    } else if (lowerMessage.includes('internet') || lowerMessage.includes('connection')) {
      response = responses.internet;
    } else if (lowerMessage.includes('password') || lowerMessage.includes('login') || lowerMessage.includes('signin')) {
      response = responses.password;
    } else if (lowerMessage.includes('slow') || lowerMessage.includes('lag') || lowerMessage.includes('performance')) {
      response = responses.slow;
    } else if (lowerMessage.includes('printer') || lowerMessage.includes('print')) {
      response = responses.printer;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: response,
        issue_type: "general",
        used_llm: false,
        model_used: "Rule-based",
        tool_called: false
      })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        detail: "Internal server error",
        error: error.message 
      })
    };
  }
};
