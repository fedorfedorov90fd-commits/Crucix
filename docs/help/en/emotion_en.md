
Emotion Module
Description
The Emotion module performs emotional analysis of texts. Detects 8 basic emotions in text: joy, sadness, anger, fear, surprise, disgust, trust, anticipation. Used for analyzing news, social media, and user messages.

API Endpoints
GET	/api/emotion/status	Module status
GET	/api/emotion/analyses	List of completed analyses
GET	/api/emotion/trends	Emotion trends over time
POST	/api/emotion/analyze	Analyze one text
POST	/api/emotion/analyze-all	Batch text analysis
Example Request
bash
curl -X POST http://localhost:3117/api/emotion/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "What a great day! I am so happy about this event."}'
Response Format
json
{
  "text": "What a great day! I am so happy about this event.",
  "emotions": {
    "joy": 0.85,
    "sadness": 0.02,
    "anger": 0.01,
    "fear": 0.03,
    "surprise": 0.20,
    "disgust": 0.00,
    "trust": 0.70,
    "anticipation": 0.45
  },
  "dominant": "joy",
  "timestamp": "2026-09-01T22:30:00Z"
}
Web Interface
Available at /emotion with emotion cards, analysis list, and trend charts.

Analysis Model
Uses a transformer-based model (BERT fine-tuned on GoEmotions) with ~85% accuracy on test data.

Logging
All analyses are saved to /data/emotion/analyses.json

Version: 1.0
Updated: 2026-09-02
