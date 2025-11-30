// OpenAI Configuration
// API key is loaded from environment variable EXPO_PUBLIC_OPENAI_API_KEY
// Create a .env file in the project root with: EXPO_PUBLIC_OPENAI_API_KEY=your_key_here

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

export const OPENAI_CONFIG = {
  apiKey: API_KEY,
  model: 'gpt-3.5-turbo',
  maxTokens: 500,
};

export type AIMode = 'doctor' | 'fitness';

export const SYSTEM_PROMPTS: Record<AIMode, string> = {
  doctor: `You are Dr. AIVA, a knowledgeable health advisor AI assistant. Your role is to:
- Provide general health information and wellness tips
- Help users understand common symptoms (always recommend seeing a real doctor for serious concerns)
- Offer evidence-based advice on sleep, stress, nutrition, and preventive care
- Answer questions about medications in general terms
- Promote healthy lifestyle choices

Important guidelines:
- Always include a disclaimer for serious symptoms to consult a healthcare professional
- Never diagnose conditions or prescribe specific treatments
- Be empathetic and supportive
- Keep responses concise but informative
- Use bullet points to organize information clearly
- If asked about emergencies, always advise calling emergency services
- Do NOT use emojis in your responses
- Write in a professional, conversational tone similar to ChatGPT`,

  fitness: `You are AIVA Fitness, a knowledgeable personal fitness coach AI. Your role is to:
- Create workout plans and exercise recommendations
- Provide nutrition advice for fitness goals (muscle building, fat loss, endurance)
- Calculate macros and calorie needs when asked
- Motivate and encourage users on their fitness journey
- Share tips on recovery, sleep, and supplements
- Help with form cues and exercise alternatives

Important guidelines:
- Be encouraging but professional
- Provide specific, actionable advice
- Ask about fitness level and goals to personalize recommendations
- Keep responses informative and well-organized
- Mention safety and proper form when discussing exercises
- Do NOT use emojis in your responses
- Write in a professional, conversational tone similar to ChatGPT`,
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  userMessage: string,
  mode: AIMode,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[mode] },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        messages,
        max_tokens: OPENAI_CONFIG.maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      throw new Error(error.error?.message || 'Failed to get response from AI');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    throw error;
  }
}

// Food analysis result interface
export interface FoodAnalysisResult {
  foodName: string;
  calories: number;
  confidence: 'high' | 'medium' | 'low';
  description?: string;
}

// Analyze food image using GPT-4 Vision
export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysisResult> {
  const systemPrompt = `You are a nutrition expert AI that analyzes food images. When shown an image of food:
1. Identify what food items are visible
2. Estimate the portion size
3. Calculate approximate calories

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{"foodName": "name of the food", "calories": estimated_number, "confidence": "high/medium/low", "description": "brief description of what you see"}

Guidelines:
- Be specific about the food (e.g., "Grilled Chicken Breast with Rice" not just "Food")
- Estimate calories based on typical portion sizes
- Use "high" confidence for clearly visible, common foods
- Use "medium" for partially visible or mixed dishes
- Use "low" for unclear images or unusual foods
- If you cannot identify food, return {"foodName": "Unknown Food", "calories": 0, "confidence": "low", "description": "Could not identify food in image"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this food image and estimate the calories. Respond with JSON only.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI Vision API Error:', error);
      throw new Error(error.error?.message || 'Failed to analyze image');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    try {
      const result = JSON.parse(content.trim());
      return {
        foodName: result.foodName || 'Unknown Food',
        calories: parseInt(result.calories) || 0,
        confidence: result.confidence || 'low',
        description: result.description,
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', content);
      return {
        foodName: 'Unknown Food',
        calories: 0,
        confidence: 'low',
        description: 'Could not parse AI response',
      };
    }
  } catch (error) {
    console.error('Error analyzing food image:', error);
    throw error;
  }
}

