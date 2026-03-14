import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
        return NextResponse.json({ success: false });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `recorded-${Date.now()}.webm`;

    const path = join(process.cwd(), 'public', 'videos', fileName);
    await writeFile(path, buffer);
    console.log(`Saved file to ${path}`);

    return NextResponse.json({ success: true, path: `/videos/${fileName}` });
}