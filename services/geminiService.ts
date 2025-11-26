import { GoogleGenAI } from "@google/genai";

// Ensure API key is present
const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const fixMermaidCode = async (brokenCode: string, errorMessage: string): Promise<string> => {
  if (!API_KEY) {
    throw new Error("Missing API Key. Please provide a valid Gemini API Key.");
  }

  const prompt = `
    You are an expert Mermaid.js diagram developer.
    The user has provided Mermaid code that is failing to render.
    
    Error Message: "${errorMessage}"
    
    Broken Code:
    \`\`\`mermaid
    ${brokenCode}
    \`\`\`
    
    Task:
    1. Analyze the syntax error.
    2. Fix the code so it renders correctly while preserving the original intent.
    3. Return ONLY the corrected Mermaid code. Do not wrap it in markdown code blocks (no \`\`\`). Do not add explanations. Just the raw code string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Using the powerful model for code logic
      contents: prompt,
      config: {
        temperature: 0.1, // Low temperature for deterministic code output
      }
    });

    const fixedCode = response.text?.trim();
    
    if (!fixedCode) {
      throw new Error("Gemini returned empty response");
    }

    // Strip markdown code blocks if the model accidentally included them despite instructions
    const cleanCode = fixedCode.replace(/^```mermaid\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');

    return cleanCode;
  } catch (error) {
    console.error("Gemini fix failed:", error);
    throw error;
  }
};