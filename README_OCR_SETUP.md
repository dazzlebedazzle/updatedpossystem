# OCR.space API Setup

This application uses OCR.space API for text extraction from images. OCR.space provides a free tier with **25,000 requests per month** (approximately 800 requests per day).

## Getting Your Free API Key

1. Visit [OCR.space API Free Key](https://ocr.space/ocrapi/freekey)
2. Enter your email address
3. Check your email for the API key
4. Copy the API key

## Setting Up the API Key

1. Create a `.env.local` file in the root directory (if it doesn't exist)
2. Add your OCR.space API key:

```env
OCR_SPACE_API_KEY=your_api_key_here
```

3. Restart your development server:

```bash
npm run dev
```

## How It Works

- **Primary Method**: OCR.space API (faster, more accurate)
- **Fallback Method**: Tesseract.js (client-side, works offline)

The application will automatically:
1. Try OCR.space API first
2. Fall back to Tesseract.js if the API fails
3. Extract product codes from scanned text
4. Automatically add products to cart if found

## API Limits

- **Free Tier**: 25,000 requests/month (~800/day)
- **No credit card required**
- **Rate limiting**: 2 requests per second

## Notes

- The API key is stored in environment variables for security
- If no API key is provided, the demo key will be used (limited functionality)
- For production, always use your own API key

