import express from 'express';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const upload = multer({ storage: multer.memoryStorage() });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later.' }
});

app.post('/api/generate', apiLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const { style, prompt: userPrompt } = req.body;
    const mimeType = req.file.mimetype;
    const base64Image = req.file.buffer.toString("base64");

    let stylePrompt = "Transform this image into a clean clipart portrait on a white background.";
    if (style.toLowerCase() === 'pixel art') stylePrompt = "Transform this image into an 8-bit pixel art portrait, retro video game graphic style, clean background.";
    if (style.toLowerCase() === 'anime') stylePrompt = "Transform this image into a high-quality 2D anime illustration, Studio Ghibli style, vibrant colors.";
    if (style.toLowerCase() === 'cartoon') stylePrompt = "Transform this image into a 3D Disney Pixar cartoon character, smooth lighting.";
    if (style.toLowerCase() === 'flat illustration') stylePrompt = "Transform this image into a minimalist flat vector illustration, solid colors, clean geometric lines.";
    if (style.toLowerCase() === 'sketch') stylePrompt = "Transform this image into a sketch or outline drawing, clean lines, white background.";

    if (userPrompt) {
      stylePrompt += ` Additional details: ${userPrompt}`;
    }

    const prompt = [
      { text: stylePrompt },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
    });

    let outputBase64 = null;
    let outputMimeType = "image/png";

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        outputBase64 = part.inlineData.data;
        if (part.inlineData.mimeType) {
          outputMimeType = part.inlineData.mimeType;
        }
        break;
      }
    }

    if (!outputBase64) {
      throw new Error("Gemini did not return image data.");
    }

    const outputUrl = `data:${outputMimeType};base64,${outputBase64}`;

    res.json({
      success: true,
      style,
      outputUrl
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Failed to generate clipart' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));