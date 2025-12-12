import { GoogleGenAI, SchemaType, Type } from "@google/genai";
import { ColumnMetadata, ProcessingSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCleaningSuggestions = async (
  columns: ColumnMetadata[],
  sampleData: any[]
): Promise<ProcessingSuggestion[]> => {
  const prompt = `
    Analyze this dataset structure and sample data. 
    Columns: ${JSON.stringify(columns.map(c => ({ name: c.name, type: c.type, missing: c.missingCount })))}
    Sample Data (first 3 rows): ${JSON.stringify(sampleData.slice(0, 3))}
    
    Identify 3-5 critical data quality issues or improvements (e.g., extracting info, handling nulls, type conversion).
    Return a list of specific suggestions.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as ProcessingSuggestion[];
  } catch (e) {
    console.error("Gemini cleaning suggestions failed:", e);
    return [];
  }
};

export const getExplainableInsight = async (
  context: string,
  dataSummary: string
): Promise<string> => {
  const prompt = `
    You are a senior data scientist. Provide a concise, clear explanation for the following data visualization or statistic.
    Context: ${context}
    Data Summary: ${dataSummary}
    
    Focus on what the user should take away from this. Keep it under 3 sentences.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "No insight available.";
  } catch (e) {
    return "Could not generate insight at this time.";
  }
};

export const runFreeformAnalysis = async (
  query: string,
  columns: ColumnMetadata[],
  sampleData: any[]
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        User Query: "${query}"
        Dataset Schema: ${JSON.stringify(columns.map(c => c.name))}
        Sample Data: ${JSON.stringify(sampleData.slice(0, 5))}
        
        Answer the user's question based on the schema and sample. 
        If it requires calculation I cannot do, explain how they might do it or what trends are visible in the sample.
      `
    });
    return response.text || "No response generated.";
  } catch (e) {
    console.error(e);
    return "Error running analysis.";
  }
};