import { put } from '@vercel/blob';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authResult = verifyToken(req);
    if (!authResult.success) {
        return res.status(401).json({ error: authResult.error });
    }

    try {
        const filename = req.headers['x-filename'] || `invoice-${Date.now()}.pdf`;
        
        // Read the request body into a buffer to ensure we have the data
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        console.log(`Uploading file: ${filename}, Size: ${buffer.length} bytes`);

        if (buffer.length === 0) {
            return res.status(400).json({ error: 'Empty file content' });
        }

        // Upload to Vercel Blob
        const blob = await put(filename, buffer, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
            contentType: 'application/pdf'
        });

        return res.status(200).json(blob);
    } catch (error) {
        console.error('Upload failed:', error);
        return res.status(500).json({ error: 'Failed to upload file' });
    }
}
