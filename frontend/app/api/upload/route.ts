import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const normalizeEnv = (value?: string) => {
    if (!value) return '';
    return value.replace(/^['"]|['"]$/g, '');
};

const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);

const s3Client = new S3Client({
    region: normalizeEnv(process.env.AWS_BUCKET_REGION) || 'ap-southeast-2',
    credentials: {
        accessKeyId: normalizeEnv(process.env.AWS_ACCESS_KEY_ID) || '',
        secretAccessKey: normalizeEnv(process.env.AWS_SECRET_ACCESS_KEY) || '',
    },
});

export async function POST(request: NextRequest) {
    try {
        // Validate AWS configuration
        if (!normalizeEnv(process.env.AWS_ACCESS_KEY_ID) || !normalizeEnv(process.env.AWS_SECRET_ACCESS_KEY) || !normalizeEnv(process.env.AWS_BUCKET_NAME)) {
            return NextResponse.json(
                { success: false, error: 'AWS configuration is missing' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
        const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : '';

        if (!fileName || !contentType) {
            return NextResponse.json(
                { success: false, error: 'fileName and contentType are required' },
                { status: 400 }
            );
        }

        if (!allowedVideoTypes.has(contentType)) {
            return NextResponse.json(
                { success: false, error: 'Unsupported video type' },
                { status: 400 }
            );
        }

        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '-');
        const objectKey = `${Date.now()}-${safeName}`;

        const command = new PutObjectCommand({
            Bucket: normalizeEnv(process.env.AWS_BUCKET_NAME),
            Key: objectKey,
            ContentType: contentType,
            ACL: 'public-read', // Make file publicly accessible
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        const s3Url = `https://${normalizeEnv(process.env.AWS_BUCKET_NAME)}.s3.${normalizeEnv(process.env.AWS_BUCKET_REGION) || 'ap-southeast-2'}.amazonaws.com/${objectKey}`;

        console.log(`Issued presigned upload URL for S3 object: ${s3Url}`);

        return NextResponse.json({
            success: true,
            uploadUrl,
            videoUrl: s3Url,
            fileName: objectKey
        });
    } catch (error) {
        console.error('Error uploading to S3:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload file to S3' },
            { status: 500 }
        );
    }
}