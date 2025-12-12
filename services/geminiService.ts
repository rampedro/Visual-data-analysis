import { GoogleGenAI, Type } from "@google/genai";
import { ColumnMetadata, ProcessingSuggestion, VizSuggestion, AIProviderConfig } from "../types";

// Default Config
let aiConfig: AIProviderConfig = {
    provider: 'gemini',
    modelName: 'gemini-2.5-flash'
};

export const configureAI = (config: AIProviderConfig) => {
    aiConfig = config;
};

// Generic completion handler to switch between Gemini and Local
const generateText = async (prompt: string, schema?: any): Promise<string> => {
    if (aiConfig.provider === 'local') {
        try {
            const body: any = {
                model: aiConfig.modelName || "llama3",
                messages: [{ role: "user", content: prompt }],
                stream: false,
            };
            if(schema) {
                body.format = "json"; // Basic JSON enforcement for local models
            }

            const res = await fetch(`${aiConfig.localEndpoint}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            return data.choices?.[0]?.message?.content || "";
        } catch (e) {
            console.error("Local LLM Error:", e);
            return "";
        }
    } else {
        // Gemini
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: aiConfig.modelName || "gemini-2.5-flash",
                contents: prompt,
                config: schema ? {
                    responseMimeType: "application/json",
                    responseSchema: schema
                } : undefined
            });
            return response.text || "";
        } catch (e) {
            console.error("Gemini Error:", e);
            return "";
        }
    }
};

export const getCleaningSuggestions = async (
  columns: ColumnMetadata[],
  sampleData: any[]
): Promise<ProcessingSuggestion[]> => {
  const prompt = `
    Analyze this dataset structure and sample data. 
    Columns: ${JSON.stringify(columns.map(c => ({ name: c.name, type: c.type, missing: c.missingCount })))}
    Sample Data (first 3 rows): ${JSON.stringify(sampleData.slice(0, 3))}
    
    Identify 3-5 critical data quality issues or improvements.
    Return a JSON array of objects with keys: column, suggestion, reason, actionType (enum: impute, normalize, drop, convert_type, extract).
  `;

  // Schema for Gemini
  const schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            column: { type: Type.STRING },
            suggestion: { type: Type.STRING },
            reason: { type: Type.STRING },
            actionType: { type: Type.STRING, enum: ['impute', 'normalize', 'drop', 'convert_type', 'extract'] }
        },
        required: ["column", "suggestion", "reason", "actionType"]
    }
  };

  try {
    const text = await generateText(prompt, schema);
    if (!text) return [];
    // If local LLM returns markdown code block, strip it
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText) as ProcessingSuggestion[];
  } catch (e) {
    return [];
  }
};

export const getExplainableInsight = async (
  context: string,
  dataSummary: string
): Promise<string> => {
  const prompt = `
    You are a senior data scientist. Provide a concise, clear explanation.
    Context: ${context}
    Data Summary: ${dataSummary}
    Keep it under 3 sentences.
  `;
  return await generateText(prompt);
};

export const enrichDatasetMetadata = async (
    columns: string[],
    sampleData: any[]
): Promise<Record<string, { humanLabel: string, missingCause?: string }>> => {
    const prompt = `
      For the following columns and sample data, infer:
      1. A Human Readable Label
      2. If data is missing/sparse, hypothesize WHY.
      
      Columns: ${JSON.stringify(columns)}
      Sample: ${JSON.stringify(sampleData)}
      Return JSON object with property "metadata": array of {column, humanLabel, missingCause}.
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            metadata: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        column: { type: Type.STRING },
                        humanLabel: { type: Type.STRING },
                        missingCause: { type: Type.STRING }
                    }
                }
            }
        }
    };

    try {
        const text = await generateText(prompt, schema);
        const cleanText = text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanText);
        const map: Record<string, any> = {};
        if (result.metadata) {
            result.metadata.forEach((m: any) => {
                map[m.column] = { humanLabel: m.humanLabel, missingCause: m.missingCause };
            });
        }
        return map;
    } catch (e) {
        return {};
    }
}

export const getVisualizationSuggestions = async (
    columns: ColumnMetadata[],
    sampleData: any[]
): Promise<VizSuggestion[]> => {
    const prompt = `
      Suggest 3 interesting, distinct interactive visualizations.
      Columns: ${JSON.stringify(columns.map(c => ({ name: c.name, type: c.type })))}
      Sample: ${JSON.stringify(sampleData.slice(0, 3))}
      Return JSON array of {title, reason, type (bar, scatter, map), x, y, z}.
    `;
    
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                reason: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['bar', 'scatter', 'map'] },
                x: { type: Type.STRING },
                y: { type: Type.STRING },
                z: { type: Type.STRING }
            }
        }
    };

    try {
        const text = await generateText(prompt, schema);
        const cleanText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        return [];
    }
}