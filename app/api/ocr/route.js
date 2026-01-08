import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - Extract text from image using OCR.space API
export async function POST(request) {
  console.log('=== OCR API CALLED ===');
  console.log('Time:', new Date().toISOString());
  
  try {
    // Get session to verify authentication
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      console.log('❌ Unauthorized - No session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('✅ Session verified');

    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!imageFile) {
      console.log('❌ No image file provided');
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    console.log('Image file received:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    });

    // Get API key from environment variable or use demo key
    const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
    console.log('Using API key:', apiKey ? `${apiKey.substring(0, 5)}...` : 'none');
    
    // Try OCR.space API with correct endpoint
    const apiUrl = 'https://api.ocr.space/parse/image';
    console.log('OCR.space API URL:', apiUrl);
    
    // Convert File to base64 for OCR.space API
    console.log('Converting image to base64...');
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    console.log('Base64 length:', base64Image.length);
    
    // Get file type
    const fileType = imageFile.type || 'image/jpeg';
    console.log('File type:', fileType);
    
    // Create FormData for OCR.space
    const formDataToSend = new URLSearchParams();
    formDataToSend.append('base64Image', `data:${fileType};base64,${base64Image}`);
    formDataToSend.append('language', 'eng');
    formDataToSend.append('isOverlayRequired', 'false');
    formDataToSend.append('detectOrientation', 'true');
    formDataToSend.append('scale', 'true');
    formDataToSend.append('OCREngine', '2');
    formDataToSend.append('iscreatesearchablepdf', 'false');
    formDataToSend.append('issearchablepdfhidetextlayer', 'false');
    
    console.log('Sending request to OCR.space API...');
    console.log('Request body size:', formDataToSend.toString().length);

    let response;
    let data;
    
    const requestStartTime = Date.now();
    try {
      console.log('=== SENDING REQUEST TO OCR.SPACE ===');
      console.log('Method: POST');
      console.log('Headers:', {
        'apikey': apiKey ? `${apiKey.substring(0, 5)}...` : 'none',
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formDataToSend.toString(),
      });
      
      const requestEndTime = Date.now();
      console.log(`Request completed in ${requestEndTime - requestStartTime}ms`);
      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          // Try to parse as JSON
          try {
            const errorJson = JSON.parse(errorText);
            console.error('OCR.space API error (JSON):', errorJson);
            return NextResponse.json({
              success: false,
              error: errorJson.ErrorMessage?.[0] || errorJson.error || 'OCR service failed',
              details: `Status: ${response.status} - ${response.statusText}`,
              raw: errorJson
            }, { status: response.status });
          } catch {
            // Not JSON, use as text
            console.error('OCR.space API error (text):', errorText.substring(0, 500));
            return NextResponse.json({
              success: false,
              error: 'OCR service failed',
              details: `Status: ${response.status} - ${response.statusText}`,
              raw: { error: errorText.substring(0, 500) }
            }, { status: response.status });
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          return NextResponse.json({
            success: false,
            error: 'OCR service failed',
            details: `Status: ${response.status} - ${response.statusText}`,
            raw: { error: 'Could not parse error response' }
          }, { status: response.status });
        }
      }

      data = await response.json();
      
      // Log full response for debugging
      console.log('=== OCR.SPACE API RESPONSE ===');
      console.log('Full response:', JSON.stringify(data, null, 2));
      console.log('ParsedResults count:', data.ParsedResults?.length || 0);
      if (data.ParsedResults && data.ParsedResults.length > 0) {
        console.log('Extracted text length:', data.ParsedResults[0].ParsedText?.length || 0);
        console.log('Extracted text preview:', data.ParsedResults[0].ParsedText?.substring(0, 200) || 'none');
      }
      
      // Check for API errors in response
      if (data.ErrorMessage && data.ErrorMessage.length > 0) {
        console.error('OCR.space API returned error:', data.ErrorMessage);
        return NextResponse.json({
          success: false,
          error: data.ErrorMessage[0] || 'OCR processing failed',
          details: data.ErrorMessage.join(', '),
          raw: data
        });
      }
      
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

