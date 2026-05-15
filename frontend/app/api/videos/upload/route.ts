import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const normalizeEnv = (value?: string) => {
    if (!value) return '';
    return value.replace(/^['"]|['"]$/g, '');
};

const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);

const toAmzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '');

const toDateStamp = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');

const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();

const getSigningKey = (secretKey: string, dateStamp: string, region: string) => {
    const kDate = hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
};

export async function POST(request: NextRequest) {
    try {
        const accessKeyId = normalizeEnv(process.env.AWS_ACCESS_KEY_ID);
        const secretAccessKey = normalizeEnv(process.env.AWS_SECRET_ACCESS_KEY);
        const bucketName = normalizeEnv(process.env.AWS_BUCKET_NAME);
        const region = normalizeEnv(process.env.AWS_BUCKET_REGION) || 'ap-southeast-2';

        if (!accessKeyId || !secretAccessKey || !bucketName) {
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
        const now = new Date();
        const amzDate = toAmzDate(now);
        const dateStamp = toDateStamp(now);
        const credential = `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`;
        const policy = {
            expiration: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
            conditions: [
                { bucket: bucketName },
                { key: objectKey },
                { 'Content-Type': contentType },
                { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
                { 'x-amz-credential': credential },
                { 'x-amz-date': amzDate },
                ['content-length-range', 0, 1024 * 1024 * 1024],
            ],
        };

        const policyBase64 = Buffer.from(JSON.stringify(policy)).toString('base64');
        const signature = createHmac('sha256', getSigningKey(secretAccessKey, dateStamp, region))
            .update(policyBase64, 'utf8')
            .digest('hex');
        const uploadUrl = `https://${bucketName}.s3.${region}.amazonaws.com/`;
        const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`;

        return NextResponse.json({
            success: true,
            uploadUrl,
            fields: {
                key: objectKey,
                'Content-Type': contentType,
                policy: policyBase64,
                'x-amz-algorithm': 'AWS4-HMAC-SHA256',
                'x-amz-credential': credential,
                'x-amz-date': amzDate,
                'x-amz-signature': signature,
            },
            videoUrl: s3Url,
            fileName: objectKey,
        });
    } catch (error) {
        console.error('Error uploading to S3:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload file to S3' },
            { status: 500 }
        );
    }
}
