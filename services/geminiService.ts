import { GoogleGenAI, SchemaType, Type } from "@google/genai";
import { ColumnMetadata, ProcessingSuggestion, VizSuggestion } from "../types";

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

export const enrichDatasetMetadata = async (
    columns: string[],
    sampleData: any[]
): Promise<Record<string, { humanLabel: string, missingCause?: string }>> => {
    const prompt = `
      For the following columns and sample data, infer:
      1. A Human Readable Label (e.g. 'cust_id' -> 'Customer ID')
      2. If data is missing or sparse in the sample, hypothesize WHY (e.g. 'Optional field', 'System generated', 'Data entry error').
      
      Columns: ${JSON.stringify(columns)}
      Sample: ${JSON.stringify(sampleData)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
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
                }
            }
        });
        
        const result = JSON.parse(response.text || "{}");
        const map: Record<string, any> = {};
        if (result.metadata) {
            result.metadata.forEach((m: any) => {
                map[m.column] = { humanLabel: m.humanLabel, missingCause: m.missingCause };
            });
        }
        return map;
    } catch (e) {
        console.error("Metadata enrichment failed", e);
        return {};
    }
}

export const getVisualizationSuggestions = async (
    columns: ColumnMetadata[],
    sampleData: any[]
): Promise<VizSuggestion[]> => {
    const prompt = `
      Suggest 3 interesting, distinct interactive visualizations for this data.
      Columns: ${JSON.stringify(columns.map(c => ({ name: c.name, type: c.type })))}
      Sample: ${JSON.stringify(sampleData.slice(0, 3))}
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
                            title: { type: Type.STRING },
                            reason: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ['bar', 'scatter', 'map'] },
                            x: { type: Type.STRING },
                            y: { type: Type.STRING },
                            z: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}