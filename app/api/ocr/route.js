import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - Extract text from image using OCR.space API
export async function POST(request) {
  try {
    // Get session to verify authentication
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Convert File to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // Try OCR.space API with correct endpoint
    // Using the standard /parse/image endpoint with FormData
    const apiUrl = 'https://api.ocr.space/parse/image';
    
    // Create FormData for OCR.space
    const formDataToSend = new URLSearchParams();
    formDataToSend.append('base64Image', `data:${imageFile.type};base64,${base64Image}`);
    formDataToSend.append('language', 'eng');
    formDataToSend.append('isOverlayRequired', 'false');
    formDataToSend.append('detectOrientation', 'true');
    formDataToSend.append('scale', 'true');
    formDataToSend.append('OCREngine', '2');

    let response;
    let data;
    
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': 'helloworld', // Free demo key
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formDataToSend.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OCR.space API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500) // Limit error text length
        });
        
        // Return error but don't throw - let it fall through
        return NextResponse.json({
          success: false,
          error: 'OCR service failed',
          details: `Status: ${response.status} - ${response.statusText}`,
          raw: { error: errorText.substring(0, 500) }
        });
      }

      data = await response.json();
      
      // Log full response for debugging
      console.log('OCR.space API Full Response:', JSON.stringify(data, null, 2));
      
    } catch (fetchError) {
      console.error('OCR API fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to OCR service',
        details: fetchError.message,
        raw: { error: fetchError.toString() }
      });
    }

    // Format the response
    if (data.ParsedResults && data.ParsedResults.length > 0) {
      const parsedText = data.ParsedResults[0].ParsedText || '';
      
      return NextResponse.json({
        success: true,
        text: parsedText,
        raw: data, // Full API response as object
        extractedText: parsedText,
        confidence: data.ParsedResults[0].TextOverlay?.HasOverlay || false,
      });
    } else if (data.ErrorMessage) {
      return NextResponse.json({
        success: false,
        text: '',
        raw: data,
        error: data.ErrorMessage[0] || 'OCR processing failed',
      });
    } else {
      return NextResponse.json({
        success: false,
        text: '',
        raw: data,
        error: 'No text found in image',
      });
    }
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

