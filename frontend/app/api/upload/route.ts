import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export async function POST(request: NextRequest) {
    try {
        // Validate AWS configuration
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
            return NextResponse.json(
                { success: false, error: 'AWS configuration is missing' },
                { status: 500 }
            );
        }

        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;

        // Upload to S3
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
            ACL: 'public-read', // Make file publicly accessible
        });

        await s3Client.send(command);

        // Generate S3 URL
        const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;

        console.log(`File uploaded to S3: ${s3Url}`);

        return NextResponse.json({
            success: true,
            videoUrl: s3Url,
            fileName: fileName
        });
    } catch (error) {
        console.error('Error uploading to S3:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload file to S3' },
            { status: 500 }
        );
    }
}