import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { extname, resolve } from 'path';
import { existsSync } from 'fs';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types (images only)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

export async function POST(request) {
  try {
    // Use proper authentication helper
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to upload files (products:create or products:update)
    const canCreate = hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.CREATE);
    const canUpdate = hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.UPDATE);
    
    if (!canCreate && !canUpdate) {
      return NextResponse.json(
        { error: 'Permission denied: products:create or products:update required' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file uploaded or invalid file' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = file.type;
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Get file extension
    const originalName = file.name || 'upload';
    const ext = extname(originalName).toLowerCase();
    
    // Validate extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'Invalid file extension. Only image files are allowed.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate it's actually an image by checking magic bytes
    const isValidImage = validateImageBuffer(buffer, ext);
    if (!isValidImage) {
      return NextResponse.json(
        { error: 'File content does not match file type. Possible malicious file.' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = resolve(process.cwd(), 'public', 'assets', 'category_images');
    
    // Ensure we're within the allowed directory (prevent path traversal)
    if (!uploadDir.startsWith(resolve(process.cwd(), 'public'))) {
      return NextResponse.json(
        { error: 'Invalid upload path' },
        { status: 400 }
      );
    }
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}_${randomStr}${ext}`;
    const filepath = resolve(uploadDir, filename);

    // Double-check path is within allowed directory
    if (!filepath.startsWith(uploadDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Write file
    await writeFile(filepath, buffer);

    return NextResponse.json({ 
      success: true, 
      filename: filename,
      path: `/assets/category_images/${filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Validate image buffer by checking magic bytes
function validateImageBuffer(buffer, ext) {
  if (buffer.length < 4) return false;

  // Check magic bytes for different image types
  const magicBytes = buffer.slice(0, 4);
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      // JPEG: FF D8 FF
      return magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    
    case '.png':
      // PNG: 89 50 4E 47
      return magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && 
             magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    
    case '.gif':
      // GIF: 47 49 46 38
      return magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && 
             magicBytes[2] === 0x46 && magicBytes[3] === 0x38;
    
    case '.webp':
      // WebP: Check for RIFF header
      if (buffer.length < 12) return false;
      const riffHeader = buffer.slice(0, 4).toString('ascii');
      const webpHeader = buffer.slice(8, 12).toString('ascii');
      return riffHeader === 'RIFF' && webpHeader === 'WEBP';
    
    case '.svg':
      // SVG: Check for XML declaration or <svg tag
      const svgStart = buffer.slice(0, Math.min(200, buffer.length)).toString('utf-8').toLowerCase();
      return svgStart.includes('<svg') || svgStart.includes('<?xml');
    
    default:
      return false;
  }
}

